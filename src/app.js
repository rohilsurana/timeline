let map;
let routeLayer;
let currentMarker;
let currentPolyline = null;
let timelineData = [];
let currentDateData = [];
let selectedTimezone = 'UTC';
let rawJsonData = null;
let availableDates = [];
let playInterval = null;
let isPlaying = false;
let db = null;
let lastRenderedIndex = -1;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TimelineDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('timeline')) {
        db.createObjectStore('timeline');
      }
    };
  });
}

// Save data to IndexedDB
function saveToDB(key, value) {
  if (!db) return Promise.reject('DB not initialized');
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['timeline'], 'readwrite');
    const store = transaction.objectStore('timeline');
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Load data from IndexedDB
function loadFromDB(key) {
  if (!db) return Promise.reject('DB not initialized');
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['timeline'], 'readonly');
    const store = transaction.objectStore('timeline');
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Initialize map
function initMap() {
  map = L.map('map', {
    zoomControl: false,
  }).setView([37.7749, -122.4194], 13);

  // Add zoom control to bottom right
  L.control
    .zoom({
      position: 'bottomright',
    })
    .addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  routeLayer = L.featureGroup().addTo(map);
}

// Parse E7 coordinates
function parseE7(coord) {
  return coord / 10000000;
}

// Parse timestamp
function parseTimestamp(ts) {
  return new Date(ts);
}

// Extract location from semantic segment
function extractLocations(segment) {
  const locations = [];

  // Handle activity segment
  if (segment.activity) {
    const activity = segment.activity;
    const startTime = parseTimestamp(segment.startTime);
    const endTime = parseTimestamp(segment.endTime);

    // Add waypoints if available
    if (segment.timelinePath) {
      segment.timelinePath.forEach(point => {
        if (point.point) {
          const lat = parseFloat(point.point.split(',')[0].replace('geo:', ''));
          const lng = parseFloat(point.point.split(',')[1]);
          locations.push({
            lat: lat,
            lng: lng,
            timestamp: startTime,
            type: 'activity',
            activity: activity.topCandidate?.type || 'UNKNOWN',
          });
        }
      });
    }

    // Fallback to start/end locations
    if (segment.startLocation) {
      locations.push({
        lat: parseFloat(segment.startLocation.latLng.split(',')[0]),
        lng: parseFloat(segment.startLocation.latLng.split(',')[1]),
        timestamp: startTime,
        type: 'activity',
        activity: activity.topCandidate?.type || 'UNKNOWN',
        name: segment.startLocation.name,
      });
    }
    if (segment.endLocation) {
      locations.push({
        lat: parseFloat(segment.endLocation.latLng.split(',')[0]),
        lng: parseFloat(segment.endLocation.latLng.split(',')[1]),
        timestamp: endTime,
        type: 'activity',
        activity: activity.topCandidate?.type || 'UNKNOWN',
        name: segment.endLocation.name,
      });
    }
  }

  // Handle place visit
  if (segment.visit) {
    const visit = segment.visit;
    const startTime = parseTimestamp(segment.startTime);
    if (visit.topCandidate && visit.topCandidate.placeLocation) {
      const latLng = visit.topCandidate.placeLocation.latLng.split(',');
      locations.push({
        lat: parseFloat(latLng[0]),
        lng: parseFloat(latLng[1]),
        timestamp: startTime,
        type: 'place',
        name:
          visit.topCandidate.placeLocation.name ||
          visit.topCandidate.placeLocation.address ||
          'Unknown Place',
        placeId: visit.topCandidate.placeId,
      });
    }
  }

  // Fallback for old format (timelineObjects)
  if (segment.activitySegment) {
    const seg = segment.activitySegment;
    if (seg.waypointPath && seg.waypointPath.waypoints) {
      seg.waypointPath.waypoints.forEach(wp => {
        if (wp.latE7 && wp.lngE7) {
          locations.push({
            lat: parseE7(wp.latE7),
            lng: parseE7(wp.lngE7),
            timestamp: parseTimestamp(seg.duration.startTimestamp),
            type: 'activity',
            activity: seg.activityType || 'UNKNOWN',
          });
        }
      });
    } else if (seg.startLocation) {
      locations.push({
        lat: parseE7(seg.startLocation.latitudeE7),
        lng: parseE7(seg.startLocation.longitudeE7),
        timestamp: parseTimestamp(seg.duration.startTimestamp),
        type: 'activity',
        activity: seg.activityType || 'UNKNOWN',
      });
    }
    if (seg.endLocation) {
      locations.push({
        lat: parseE7(seg.endLocation.latitudeE7),
        lng: parseE7(seg.endLocation.longitudeE7),
        timestamp: parseTimestamp(seg.duration.endTimestamp),
        type: 'activity',
        activity: seg.activityType || 'UNKNOWN',
      });
    }
  }

  if (segment.placeVisit) {
    const place = segment.placeVisit;
    if (place.location) {
      locations.push({
        lat: parseE7(place.location.latitudeE7),
        lng: parseE7(place.location.longitudeE7),
        timestamp: parseTimestamp(place.duration.startTimestamp),
        type: 'place',
        name: place.location.name || place.location.address || 'Unknown Place',
        placeId: place.location.placeId,
      });
    }
  }

  return locations;
}

// Display timeline data for current date
function displayTimelineData(data) {
  const consoleDiv = document.getElementById('console');
  const consoleContent = document.getElementById('consoleContent');
  consoleDiv.style.display = 'block';

  let html = '<div class="section"><strong>📊 Summary:</strong><pre>';
  html += `Total points: ${data.length}\n`;

  if (data.length > 0) {
    const startTime = data[0].timestamp.toLocaleTimeString('en-US', {
      timeZone: selectedTimezone,
      hour: '2-digit',
      minute: '2-digit',
    });
    const endTime = data[data.length - 1].timestamp.toLocaleTimeString('en-US', {
      timeZone: selectedTimezone,
      hour: '2-digit',
      minute: '2-digit',
    });
    html += `Time range: ${startTime} - ${endTime}\n`;

    // Count activities and places
    const activities = data.filter(d => d.type === 'activity').length;
    const places = data.filter(d => d.type === 'place').length;
    html += `Activities: ${activities}, Places: ${places}`;
  }
  html += '</pre></div>';

  html += '<div class="section"><strong>📍 Locations:</strong><pre>';
  data.forEach((loc, idx) => {
    const time = loc.timestamp.toLocaleTimeString('en-US', {
      timeZone: selectedTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const icon = loc.type === 'place' ? '📍' : loc.type === 'raw' ? '📡' : '🚶';
    const name = loc.name || `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
    const activity = loc.activity ? ` [${loc.activity}]` : '';
    const accuracy = loc.accuracy ? ` (±${loc.accuracy})` : '';
    const source = loc.source ? ` ${loc.source}` : '';
    html += `<span class="timeline-item" data-timestamp="${loc.timestamp.getTime()}">${idx + 1}. ${icon} ${time} - ${name}${activity}${accuracy}${source}</span>\n`;
  });
  html += '</pre></div>';

  consoleContent.innerHTML = html;

  // Add click handlers to timeline items
  document.querySelectorAll('.timeline-item').forEach(item => {
    item.addEventListener('click', function () {
      const timestamp = parseInt(this.dataset.timestamp);
      jumpToTimestamp(timestamp);
    });
  });
}

// Extract location from rawSignals
function extractRawSignal(signal) {
  // Handle nested signal.position or direct position
  const pos = signal.position || (signal.signal && signal.signal.position);
  if (!pos) {
    return null;
  }

  let lat, lng;

  // Handle LatLng string format: "22.6993465°, 75.8717841°"
  if (pos.LatLng) {
    const parts = pos.LatLng.replace(/°/g, '')
      .split(',')
      .map(s => s.trim());
    if (parts.length === 2) {
      lat = parseFloat(parts[0]);
      lng = parseFloat(parts[1]);
    }
  }
  // Handle E7 format
  else if (pos.point && pos.point.latE7 && pos.point.lngE7) {
    lat = parseE7(pos.point.latE7);
    lng = parseE7(pos.point.lngE7);
  }
  // Handle latitudeE7/longitudeE7
  else if (pos.latitudeE7 && pos.longitudeE7) {
    lat = parseE7(pos.latitudeE7);
    lng = parseE7(pos.longitudeE7);
  }

  if (!lat || !lng) {
    return null;
  }

  return {
    lat: lat,
    lng: lng,
    timestamp: parseTimestamp(pos.timestamp || signal.additionalTimestamp),
    type: 'raw',
    accuracy: pos.accuracyMeters
      ? pos.accuracyMeters.toFixed(0) + 'm'
      : pos.accuracyMm
        ? (pos.accuracyMm / 1000).toFixed(0) + 'm'
        : undefined,
    source: pos.source,
    altitude: pos.altitudeMeters,
    speed: pos.speedMetersPerSecond,
  };
}

// Parse JSON file
function parseTimelineJSON(jsonData, useRaw = true) {
  const locations = [];

  // Handle rawSignals (most detailed, raw GPS data) if enabled
  if (useRaw && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    jsonData.rawSignals.forEach(signal => {
      const loc = extractRawSignal(signal);
      if (loc) {
        locations.push(loc);
      }
    });
  }
  // Fallback to semanticSegments if raw disabled or no rawSignals
  else if (jsonData.semanticSegments) {
    jsonData.semanticSegments.forEach(segment => {
      locations.push(...extractLocations(segment));
    });
  }
  // Handle old format (timelineObjects)
  else if (jsonData.timelineObjects) {
    jsonData.timelineObjects.forEach(obj => {
      locations.push(...extractLocations(obj));
    });
  }

  // Sort by timestamp
  locations.sort((a, b) => a.timestamp - b.timestamp);

  return locations;
}

// Get unique dates in selected timezone
function getUniqueDates(data) {
  const dates = new Set();
  data.forEach(loc => {
    const date = loc.timestamp.toLocaleString('en-US', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const parts = date.split(',')[0].split('/');
    const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    dates.add(isoDate);
  });
  return Array.from(dates).sort();
}

// Filter data by date in selected timezone
function filterByDate(data, dateStr) {
  return data.filter(loc => {
    const date = loc.timestamp.toLocaleString('en-US', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = date.split(',')[0].split('/');
    const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    return isoDate === dateStr;
  });
}

// Interpolate between two points
function interpolate(start, end, factor) {
  return {
    lat: start.lat + (end.lat - start.lat) * factor,
    lng: start.lng + (end.lng - start.lng) * factor,
  };
}

// Find the closest data points for a given timestamp
function findDataPointsForTimestamp(timestamp) {
  if (currentDateData.length === 0) return null;

  // If timestamp is before first point, return first point
  if (timestamp <= currentDateData[0].timestamp.getTime()) {
    return { index: 0, interpolation: 0, data: currentDateData[0] };
  }

  // If timestamp is after last point, return last point
  if (timestamp >= currentDateData[currentDateData.length - 1].timestamp.getTime()) {
    return {
      index: currentDateData.length - 1,
      interpolation: 0,
      data: currentDateData[currentDateData.length - 1],
    };
  }

  // Find the two points that bracket this timestamp
  for (let i = 0; i < currentDateData.length - 1; i++) {
    const t1 = currentDateData[i].timestamp.getTime();
    const t2 = currentDateData[i + 1].timestamp.getTime();

    if (timestamp >= t1 && timestamp <= t2) {
      const factor = (timestamp - t1) / (t2 - t1);
      return { index: i, interpolation: factor, data: currentDateData[i] };
    }
  }

  return { index: 0, interpolation: 0, data: currentDateData[0] };
}

// Update map visualization based on time of day (0-1 representing 00:00 to 23:59)
function updateMap(progress) {
  if (currentDateData.length === 0) return;

  // Convert progress (0-1) to time of day in minutes
  const totalMinutes = progress * (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  // Update time display
  document.getElementById('timeText').textContent =
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // Get the date string from current data
  const dateStr = currentDateData[0].timestamp.toLocaleString('en-US', {
    timeZone: selectedTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dateStr.split(',')[0].split('/');
  const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;

  // Create a timestamp for this time on the selected date
  const targetTimestamp = new Date(
    `${isoDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  ).getTime();

  // Find relevant data points
  const result = findDataPointsForTimestamp(targetTimestamp);
  if (!result) return;

  const targetIndex = result.index;
  const interpolationFactor = result.interpolation;

  // Add interpolated point if between two data points
  let currentPos;
  if (targetIndex < currentDateData.length - 1 && interpolationFactor > 0) {
    currentPos = interpolate(
      currentDateData[targetIndex],
      currentDateData[targetIndex + 1],
      interpolationFactor
    );
  } else {
    currentPos = currentDateData[targetIndex];
  }

  // Only update polyline if we've moved to a new data point
  if (targetIndex !== lastRenderedIndex) {
    // Build complete route up to current point
    const routePoints = [];
    for (let i = 0; i <= targetIndex; i++) {
      routePoints.push([currentDateData[i].lat, currentDateData[i].lng]);
    }

    // Remove old polyline and add new one
    if (currentPolyline) {
      routeLayer.removeLayer(currentPolyline);
    }
    if (routePoints.length > 1) {
      currentPolyline = L.polyline(routePoints, {
        color: '#4285f4',
        weight: 4,
        opacity: 0.7,
        smoothFactor: 1,
      });
      routeLayer.addLayer(currentPolyline);
    }

    lastRenderedIndex = targetIndex;
  }

  // Always update marker position (even for interpolated positions)
  if (currentMarker) {
    currentMarker.setLatLng([currentPos.lat, currentPos.lng]);
  } else {
    const markerIcon = L.divIcon({
      className: 'activity-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    currentMarker = L.marker([currentPos.lat, currentPos.lng], {
      icon: markerIcon,
    }).addTo(routeLayer);
  }

  // Update info panel
  const currentData = currentDateData[targetIndex];
  const locationText =
    currentData.name || `${currentData.lat.toFixed(6)}, ${currentData.lng.toFixed(6)}`;
  const accuracyText = currentData.accuracy ? ` (±${currentData.accuracy})` : '';
  document.getElementById('locationName').textContent = locationText + accuracyText;

  let activityText = currentData.activity || currentData.type || '-';
  if (currentData.source) activityText += ` [${currentData.source}]`;
  document.getElementById('activityType').textContent = activityText;
  document.getElementById('info').style.display = 'block';

  // Center map on current position if needed (less frequently)
  if (targetIndex === 0 || !map.getBounds().contains([currentPos.lat, currentPos.lng])) {
    map.setView([currentPos.lat, currentPos.lng], map.getZoom());
  }
}

// Timezone selector handler
document.getElementById('timezoneSelect').addEventListener('change', function (e) {
  selectedTimezone = e.target.value;
  // If data is already loaded, refresh the date list
  if (timelineData.length > 0) {
    const dates = getUniqueDates(timelineData);
    const dateSelect = document.getElementById('dateSelect');
    const currentDate = dateSelect.value;
    dateSelect.innerHTML = '';

    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        timeZone: selectedTimezone,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      dateSelect.appendChild(option);
    });

    // Try to maintain the current date selection if still available
    if (dates.includes(currentDate)) {
      dateSelect.value = currentDate;
      loadDate(currentDate);
    } else if (dates.length > 0) {
      loadDate(dates[0]);
    }
  }
});

// Auto-detect user's timezone on page load
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timezoneSelect = document.getElementById('timezoneSelect');

// Check if user's timezone exists in dropdown
if ([...timezoneSelect.options].some(opt => opt.value === userTimezone)) {
  timezoneSelect.value = userTimezone;
  selectedTimezone = userTimezone;
} else {
  // If not in dropdown, add it as an option
  const option = document.createElement('option');
  option.value = userTimezone;
  option.textContent = userTimezone;
  option.selected = true;
  timezoneSelect.insertBefore(option, timezoneSelect.firstChild);
  selectedTimezone = userTimezone;
}

// Load timeline data from parsed JSON
async function loadTimelineData(jsonData, filename, saveToCache = true) {
  rawJsonData = jsonData;
  const useRaw = document.getElementById('useRawData').checked;
  timelineData = parseTimelineJSON(rawJsonData, useRaw);

  if (timelineData.length === 0) {
    alert('No location data found in file');
    return;
  }

  // Update filename display
  document.getElementById('filename').textContent = filename;

  // Save to IndexedDB
  if (saveToCache) {
    try {
      await saveToDB('timelineData', jsonData);
      await saveToDB('timelineFilename', filename);
    } catch {
      // Silently fail if DB not available
    }
  }

  // Populate date selector
  availableDates = getUniqueDates(timelineData);
  const dateSelect = document.getElementById('dateSelect');
  dateSelect.innerHTML = '';
  dateSelect.disabled = false;

  availableDates.forEach(date => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      timeZone: selectedTimezone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    dateSelect.appendChild(option);
  });

  // Load first date or previously selected date
  const savedDate = await loadFromDB('selectedDate').catch(() => null);
  if (savedDate && availableDates.includes(savedDate)) {
    dateSelect.value = savedDate;
    loadDate(savedDate);
  } else if (availableDates.length > 0) {
    loadDate(availableDates[0]);
  }
}

// File upload handler
document.getElementById('fileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const jsonData = JSON.parse(event.target.result);
      loadTimelineData(jsonData, file.name);
    } catch (error) {
      alert('Error parsing JSON file: ' + error.message);
    }
  };
  reader.readAsText(file);
});

// Raw data checkbox handler
document.getElementById('useRawData').addEventListener('change', function (e) {
  if (!rawJsonData) return; // No file loaded yet

  const useRaw = e.target.checked;
  const currentDate = document.getElementById('dateSelect').value;

  // Re-parse with new setting
  timelineData = parseTimelineJSON(rawJsonData, useRaw);

  if (timelineData.length === 0) {
    alert('No location data found with current setting');
    return;
  }

  // Refresh date list
  availableDates = getUniqueDates(timelineData);
  const dateSelect = document.getElementById('dateSelect');
  dateSelect.innerHTML = '';

  availableDates.forEach(date => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      timeZone: selectedTimezone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    dateSelect.appendChild(option);
  });

  // Try to maintain current date or load first
  if (availableDates.includes(currentDate)) {
    dateSelect.value = currentDate;
    loadDate(currentDate);
  } else if (availableDates.length > 0) {
    loadDate(availableDates[0]);
  }
});

// Date selector handler
document.getElementById('dateSelect').addEventListener('change', function (e) {
  loadDate(e.target.value);
});

// Update date navigation buttons
function updateDateNavButtons(currentDate) {
  const currentIndex = availableDates.indexOf(currentDate);
  const prevBtn = document.getElementById('prevDateBtn');
  const nextBtn = document.getElementById('nextDateBtn');

  // Disable/enable previous button
  if (currentIndex <= 0) {
    prevBtn.disabled = true;
  } else {
    prevBtn.disabled = false;
  }

  // Disable/enable next button
  if (currentIndex >= availableDates.length - 1) {
    nextBtn.disabled = true;
  } else {
    nextBtn.disabled = false;
  }
}

// Load specific date
async function loadDate(dateStr) {
  currentDateData = filterByDate(timelineData, dateStr);

  if (currentDateData.length === 0) {
    alert('No data for selected date');
    return;
  }

  // Save selected date to IndexedDB
  try {
    await saveToDB('selectedDate', dateStr);
  } catch {
    // Silently fail if DB not available
  }

  // Display timeline data for this date
  displayTimelineData(currentDateData);

  // Reset slider
  document.getElementById('timeSlider').value = 0;

  // Update map
  updateMap(0);

  // Fit bounds
  const bounds = currentDateData.map(loc => [loc.lat, loc.lng]);
  map.fitBounds(bounds, { padding: [50, 50] });

  // Update navigation buttons
  updateDateNavButtons(dateStr);
}

// Jump to a specific timestamp on the slider
function jumpToTimestamp(timestamp) {
  if (currentDateData.length === 0) return;

  // Get the date string from current data
  const dateStr = currentDateData[0].timestamp.toLocaleString('en-US', {
    timeZone: selectedTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dateStr.split(',')[0].split('/');
  const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;

  // Get start of day timestamp
  const startOfDay = new Date(`${isoDate}T00:00:00`).getTime();
  const endOfDay = new Date(`${isoDate}T23:59:59`).getTime();

  // Calculate progress (0-1) for this timestamp
  const progress = (timestamp - startOfDay) / (endOfDay - startOfDay);

  // Clamp to 0-1
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Update slider and map
  document.getElementById('timeSlider').value = clampedProgress * 100;
  updateMap(clampedProgress);
}

// Controls expand/collapse handler
document.getElementById('controlsHeader').addEventListener('click', function () {
  const controlsDiv = document.getElementById('controls');
  if (controlsDiv.classList.contains('minimized')) {
    controlsDiv.classList.remove('minimized');
    controlsDiv.classList.add('expanded');
  } else {
    controlsDiv.classList.remove('expanded');
    controlsDiv.classList.add('minimized');
  }
});

// Console expand/collapse handler
document.getElementById('consoleHeader').addEventListener('click', function () {
  const consoleDiv = document.getElementById('console');
  if (consoleDiv.classList.contains('minimized')) {
    consoleDiv.classList.remove('minimized');
    consoleDiv.classList.add('expanded');
  } else {
    consoleDiv.classList.remove('expanded');
    consoleDiv.classList.add('minimized');
  }
});

// Slider handler
document.getElementById('timeSlider').addEventListener('input', function (e) {
  const progress = parseFloat(e.target.value) / 100;
  updateMap(progress);

  // If playing, restart from new position
  if (isPlaying) {
    const wasPlaying = isPlaying;
    stopPlayback();
    if (wasPlaying) {
      startPlayback(progress);
    }
  }
});

// Previous date button handler
document.getElementById('prevDateBtn').addEventListener('click', function () {
  const dateSelect = document.getElementById('dateSelect');
  const currentDate = dateSelect.value;
  const currentIndex = availableDates.indexOf(currentDate);

  if (currentIndex > 0) {
    const prevDate = availableDates[currentIndex - 1];
    dateSelect.value = prevDate;
    loadDate(prevDate);
  }
});

// Next date button handler
document.getElementById('nextDateBtn').addEventListener('click', function () {
  const dateSelect = document.getElementById('dateSelect');
  const currentDate = dateSelect.value;
  const currentIndex = availableDates.indexOf(currentDate);

  if (currentIndex < availableDates.length - 1) {
    const nextDate = availableDates[currentIndex + 1];
    dateSelect.value = nextDate;
    loadDate(nextDate);
  }
});

// Play animation
function startPlayback(startProgress = 0) {
  if (currentDateData.length === 0) return;

  // Reset rendering state
  lastRenderedIndex = -1;

  isPlaying = true;
  const playBtn = document.getElementById('playBtn');
  playBtn.textContent = '⏸';
  playBtn.classList.add('playing');

  // Start from specified position or beginning
  const startValue = startProgress * 100;
  document.getElementById('timeSlider').value = startValue;
  updateMap(startProgress);

  // Calculate duration based on remaining progress
  // Total animation time is 60 seconds for full day (0-100%)
  const totalAnimationTime = 60000; // 60 seconds for full day
  const remainingProgress = 1 - startProgress;
  const duration = totalAnimationTime * remainingProgress;

  const startTime = performance.now();
  const startProgressValue = startProgress;

  function animate(currentTime) {
    if (!isPlaying) return;

    const elapsed = currentTime - startTime;
    const progressDelta = (elapsed / duration) * (1 - startProgressValue);
    const progress = (startProgressValue + progressDelta) * 100;

    if (progress >= 100) {
      document.getElementById('timeSlider').value = 100;
      updateMap(1);
      stopPlayback();
      return;
    }

    document.getElementById('timeSlider').value = progress;
    updateMap(progress / 100);
    playInterval = requestAnimationFrame(animate);
  }

  playInterval = requestAnimationFrame(animate);
}

function stopPlayback() {
  isPlaying = false;
  if (playInterval) {
    cancelAnimationFrame(playInterval);
    playInterval = null;
  }

  const playBtn = document.getElementById('playBtn');
  playBtn.textContent = '▶';
  playBtn.classList.remove('playing');
}

// Play button handler
document.getElementById('playBtn').addEventListener('click', function () {
  if (isPlaying) {
    stopPlayback();
  } else {
    // Start from current slider position
    let currentProgress = parseFloat(document.getElementById('timeSlider').value) / 100;
    // If at the end, restart from beginning
    if (currentProgress >= 0.999) {
      currentProgress = 0;
    }
    startPlayback(currentProgress);
  }
});

// Initialize app
async function initApp() {
  initMap();
  try {
    await initDB();
    // Try to load saved data
    const savedData = await loadFromDB('timelineData');
    const savedFilename = await loadFromDB('timelineFilename');
    if (savedData && savedFilename) {
      await loadTimelineData(savedData, savedFilename, false);
    }
  } catch {
    // Silently fail if DB not available
  }
}

initApp();
