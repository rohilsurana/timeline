import { icons } from './icons.js';

let map;
let routeLayer;
let currentMarker;
let currentPolyline = null;
let currentPolylineSegments = [];
let timelineData = [];
let currentDateData = [];
let selectedTimezone = 'UTC';
let rawJsonData = null;
let availableDates = [];
let playInterval = null;
let isPlaying = false;
let db = null;
let lastRenderedIndex = -1;
let routeColorMode = 'none';

// Color utility functions
function getSpeedColor(speed) {
  // Speed in meters per second
  // < 1 m/s (3.6 km/h) = red (stationary/very slow)
  // 1-5 m/s (3.6-18 km/h) = yellow (walking/slow)
  // 5-15 m/s (18-54 km/h) = green (cycling/moderate)
  // > 15 m/s (> 54 km/h) = blue (driving/fast)
  if (speed < 1) return '#ef4444'; // red
  if (speed < 5) return '#eab308'; // yellow
  if (speed < 15) return '#22c55e'; // green
  return '#3b82f6'; // blue
}

function getActivityColor(activity) {
  const activityColors = {
    WALKING: '#22c55e', // green
    RUNNING: '#f97316', // orange
    CYCLING: '#8b5cf6', // purple
    MOTORCYCLING: '#d946ef', // fuchsia
    IN_VEHICLE: '#3b82f6', // blue
    IN_PASSENGER_VEHICLE: '#3b82f6', // blue
    IN_ROAD_VEHICLE: '#3b82f6', // blue
    DRIVING: '#3b82f6', // blue
    IN_SUBWAY: '#a855f7', // purple
    IN_RAIL_VEHICLE: '#06b6d4', // cyan
    IN_BUS: '#f59e0b', // amber
    FLYING: '#ec4899', // pink
    STILL: '#ef4444', // red
    UNKNOWN: '#9ca3af', // gray
  };
  return activityColors[activity] || '#4285f4'; // default blue
}

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
    const activityType = activity.topCandidate?.type || 'UNKNOWN';
    const startTime = parseTimestamp(segment.startTime);
    const endTime = parseTimestamp(segment.endTime);

    // Add waypoints if available
    if (segment.timelinePath && segment.timelinePath.length > 0) {
      segment.timelinePath.forEach(point => {
        if (point.point && point.time) {
          const lat = parseFloat(point.point.split(',')[0].replace('geo:', ''));
          const lng = parseFloat(point.point.split(',')[1]);
          const pointTime = parseTimestamp(point.time);
          locations.push({
            lat: lat,
            lng: lng,
            timestamp: pointTime,
            type: 'activity',
            activity: activityType,
          });
        }
      });
    }
    // Fallback to start/end locations if no timelinePath
    else {
      if (activity.start) {
        const latLng = activity.start.latLng.split(',');
        locations.push({
          lat: parseFloat(latLng[0]),
          lng: parseFloat(latLng[1]),
          timestamp: startTime,
          type: 'activity',
          activity: activityType,
        });
      }
      if (activity.end) {
        const latLng = activity.end.latLng.split(',');
        locations.push({
          lat: parseFloat(latLng[0]),
          lng: parseFloat(latLng[1]),
          timestamp: endTime,
          type: 'activity',
          activity: activityType,
        });
      }
    }
  }
  // Handle place visit
  else if (segment.visit) {
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
        semanticType: visit.topCandidate.semanticType,
      });
    }
  }
  // Handle standalone timelinePath segments (no activity or visit)
  else if (segment.timelinePath && segment.timelinePath.length > 0) {
    segment.timelinePath.forEach(point => {
      if (point.point && point.time) {
        const lat = parseFloat(point.point.split(',')[0].replace('geo:', ''));
        const lng = parseFloat(point.point.split(',')[1]);
        const pointTime = parseTimestamp(point.time);
        locations.push({
          lat: lat,
          lng: lng,
          timestamp: pointTime,
          type: 'path',
          activity: 'UNKNOWN',
        });
      }
    });
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

  // Handle case where jsonData is directly an array of semantic segments (iOS export)
  let semanticSegments = null;
  if (Array.isArray(jsonData)) {
    semanticSegments = jsonData;
  } else if (jsonData.semanticSegments) {
    semanticSegments = jsonData.semanticSegments;
  }

  // Handle rawSignals (most detailed, raw GPS data) if enabled
  if (useRaw && !Array.isArray(jsonData) && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    jsonData.rawSignals.forEach(signal => {
      const loc = extractRawSignal(signal);
      if (loc) {
        locations.push(loc);
      }
    });
  }
  // Fallback to semanticSegments if raw disabled or no rawSignals
  else if (semanticSegments) {
    // First pass: collect activity time ranges
    const activityRanges = [];
    semanticSegments.forEach(segment => {
      if (segment.activity || segment.visit) {
        activityRanges.push({
          start: parseTimestamp(segment.startTime).getTime(),
          end: parseTimestamp(segment.endTime).getTime(),
        });
      }
    });

    // Second pass: extract locations, skipping standalone paths that overlap with activities
    semanticSegments.forEach(segment => {
      // Check if this is a standalone timelinePath segment (no activity or visit)
      if (segment.timelinePath && !segment.activity && !segment.visit) {
        const segmentStart = parseTimestamp(segment.startTime).getTime();
        const segmentEnd = parseTimestamp(segment.endTime).getTime();

        // Skip if this overlaps with any activity/visit segment
        const overlaps = activityRanges.some(
          range =>
            (segmentStart >= range.start && segmentStart <= range.end) ||
            (segmentEnd >= range.start && segmentEnd <= range.end) ||
            (segmentStart <= range.start && segmentEnd >= range.end)
        );

        if (overlaps) {
          return; // Skip this standalone path segment
        }
      }

      locations.push(...extractLocations(segment));
    });
  }
  // Handle old format (timelineObjects)
  else if (!Array.isArray(jsonData) && jsonData.timelineObjects) {
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

// Get unique dates from raw JSON without parsing all location data (for large files)
async function getUniqueDatesFromRaw(jsonData, useRaw) {
  const dates = new Set();

  // Sample timestamps to extract dates
  const extractDateFromTimestamp = (timestamp) => {
    const date = new Date(timestamp).toLocaleString('en-US', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = date.split(',')[0].split('/');
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  };

  if (useRaw && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    const totalSignals = jsonData.rawSignals.length;
    console.log(`Processing ${totalSignals} raw signals for dates`);

    // Process in chunks to avoid blocking
    const chunkSize = 10000;
    for (let i = 0; i < totalSignals; i += chunkSize) {
      const end = Math.min(i + chunkSize, totalSignals);

      // Process chunk
      for (let j = i; j < end; j++) {
        const signal = jsonData.rawSignals[j];
        const timestamp = signal.position?.timestamp || signal.timestamp;
        if (timestamp) {
          dates.add(extractDateFromTimestamp(timestamp));
        }
      }

      // Yield to browser every chunk
      if (i + chunkSize < totalSignals) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } else {
    // Use semantic segments (much faster)
    const segments = Array.isArray(jsonData) ? jsonData : jsonData.semanticSegments;
    if (segments) {
      console.log(`Processing ${segments.length} semantic segments for dates`);
      segments.forEach(segment => {
        if (segment.startTime) {
          dates.add(extractDateFromTimestamp(segment.startTime));
        }
      });
    }
  }

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

// Parse timeline data for a specific date only (for large files)
async function parseTimelineJSONForDate(jsonData, dateStr, useRaw = true) {
  const locations = [];
  const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number);

  // Helper to check if timestamp matches target date
  const isTargetDate = (timestamp) => {
    const date = new Date(timestamp).toLocaleString('en-US', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = date.split(',')[0].split('/');
    const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    return isoDate === dateStr;
  };

  // Handle raw signals
  if (useRaw && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    const totalSignals = jsonData.rawSignals.length;
    const chunkSize = 10000;

    for (let i = 0; i < totalSignals; i += chunkSize) {
      const end = Math.min(i + chunkSize, totalSignals);

      for (let j = i; j < end; j++) {
        const signal = jsonData.rawSignals[j];
        const timestamp = signal.position?.timestamp || signal.timestamp;
        if (timestamp && isTargetDate(timestamp)) {
          const loc = extractRawSignal(signal);
          if (loc) {
            locations.push(loc);
          }
        }
      }

      // Yield to browser every chunk
      if (i + chunkSize < totalSignals) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }
  // Handle semantic segments
  else {
    const segments = Array.isArray(jsonData) ? jsonData : jsonData.semanticSegments;
    if (segments) {
      segments.forEach(segment => {
        if (segment.startTime && isTargetDate(segment.startTime)) {
          locations.push(...extractLocations(segment));
        }
      });
    }
  }

  // Sort by timestamp
  locations.sort((a, b) => a.timestamp - b.timestamp);
  return locations;
}

// Interpolate between two points
function interpolate(start, end, factor) {
  return {
    lat: start.lat + (end.lat - start.lat) * factor,
    lng: start.lng + (end.lng - start.lng) * factor,
  };
}

// Update slider background with route colors
function updateSliderGradient() {
  const slider = document.getElementById('timeSlider');

  if (routeColorMode === 'none' || currentDateData.length === 0) {
    // Reset to default gray gradient
    slider.style.background = 'linear-gradient(to right, #e8e8e8 0%, #e8e8e8 100%)';
    return;
  }

  // Build gradient stops based on data points
  const gradientStops = [];
  for (let i = 0; i < currentDateData.length; i++) {
    const point = currentDateData[i];
    const percentage = (i / (currentDateData.length - 1)) * 100;

    let color = '#4285f4';
    if (routeColorMode === 'speed' && i < currentDateData.length - 1) {
      const point2 = currentDateData[i + 1];
      const timeDiff = (point2.timestamp - point.timestamp) / 1000;
      const distance =
        Math.sqrt(Math.pow(point2.lat - point.lat, 2) + Math.pow(point2.lng - point.lng, 2)) *
        111000; // Rough conversion to meters
      const speed = timeDiff > 0 ? distance / timeDiff : 0;
      color = getSpeedColor(speed);
    } else if (routeColorMode === 'activity') {
      const activityType = point.activity || (point.type === 'place' ? 'STILL' : 'UNKNOWN');
      color = getActivityColor(activityType);
    }

    gradientStops.push(`${color} ${percentage}%`);
  }

  const gradient = `linear-gradient(to right, ${gradientStops.join(', ')})`;
  slider.style.background = gradient;
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
    // Remove old polylines
    if (currentPolyline) {
      routeLayer.removeLayer(currentPolyline);
      currentPolyline = null;
    }
    currentPolylineSegments.forEach(segment => routeLayer.removeLayer(segment));
    currentPolylineSegments = [];

    // Simplify data for performance when there are too many points
    const maxPoints = 1000; // Limit polyline segments for performance
    const step = Math.max(1, Math.floor(targetIndex / maxPoints));

    // Build colored route segments
    if (routeColorMode === 'none') {
      // Single color polyline - sample points for performance
      const routePoints = [];
      for (let i = 0; i <= targetIndex; i += step) {
        routePoints.push([currentDateData[i].lat, currentDateData[i].lng]);
      }
      // Always include the last point
      if (targetIndex % step !== 0) {
        routePoints.push([currentDateData[targetIndex].lat, currentDateData[targetIndex].lng]);
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
    } else {
      // Multi-colored segments - sample for performance
      for (let i = 0; i < targetIndex; i += step) {
        const point1 = currentDateData[i];
        const point2 = currentDateData[Math.min(i + step, targetIndex)];
        const segmentPoints = [
          [point1.lat, point1.lng],
          [point2.lat, point2.lng],
        ];

        let color = '#4285f4';
        if (routeColorMode === 'speed') {
          // Calculate speed between points
          const timeDiff = (point2.timestamp - point1.timestamp) / 1000; // seconds
          const distance = map.distance([point1.lat, point1.lng], [point2.lat, point2.lng]); // meters
          const speed = timeDiff > 0 ? distance / timeDiff : 0;
          color = getSpeedColor(speed);
        } else if (routeColorMode === 'activity') {
          // Use activity from current point, fallback to 'UNKNOWN'
          const activityType = point1.activity || (point1.type === 'place' ? 'STILL' : 'UNKNOWN');
          color = getActivityColor(activityType);
        }

        const segment = L.polyline(segmentPoints, {
          color: color,
          weight: 4,
          opacity: 0.7,
          smoothFactor: 1,
        });
        routeLayer.addLayer(segment);
        currentPolylineSegments.push(segment);
      }
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

  // Display activity - prioritize activity field over type
  let activityText = '-';
  if (currentData.activity && currentData.activity !== 'UNKNOWN') {
    activityText = currentData.activity;
  } else if (currentData.type === 'place') {
    activityText = currentData.semanticType
      ? `${currentData.semanticType} (Place Visit)`
      : 'Place Visit';
  } else if (currentData.type === 'raw') {
    activityText = 'Raw GPS';
  } else if (currentData.type === 'path') {
    activityText = 'Movement (Unknown Activity)';
  } else if (currentData.type === 'activity') {
    activityText = currentData.activity || 'Movement';
  } else {
    activityText = currentData.type || '-';
  }
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

  // Check if raw data is available
  const hasRawData = !Array.isArray(jsonData) && jsonData.rawSignals && jsonData.rawSignals.length > 0;
  const useRawCheckbox = document.getElementById('useRawData');

  if (!hasRawData) {
    // No raw data available, disable checkbox and uncheck it
    useRawCheckbox.checked = false;
    useRawCheckbox.disabled = true;
  } else {
    // Raw data available, enable checkbox
    useRawCheckbox.disabled = false;
  }

  const useRaw = useRawCheckbox.checked;

  // Detect large files by checking raw data count (avoid stringifying entire JSON)
  const rawSignalCount = jsonData.rawSignals?.length || 0;
  const semanticSegmentCount = jsonData.semanticSegments?.length || 0;
  const isLargeFile = rawSignalCount > 10000 || semanticSegmentCount > 1000;

  if (isLargeFile) {
    console.log('Large file detected, using optimized parsing...');
    console.log(`Raw signals: ${rawSignalCount}, Semantic segments: ${semanticSegmentCount}`);

    // Show loading indicator
    showLoadingIndicator('Processing timeline data...');

    try {
      // Only parse dates without loading all location data
      availableDates = await getUniqueDatesFromRaw(jsonData, useRaw);
      if (availableDates.length === 0) {
        hideLoadingIndicator();
        alert('No location data found in file');
        return;
      }
    } finally {
      hideLoadingIndicator();
    }
  } else {
    // For small files, parse all data upfront
    timelineData = parseTimelineJSON(rawJsonData, useRaw);

    if (timelineData.length === 0) {
      alert('No location data found in file');
      return;
    }

    // Populate date selector
    availableDates = getUniqueDates(timelineData);

    // Save to IndexedDB (only for small files)
    if (saveToCache) {
      try {
        await saveToDB('timelineData', jsonData);
        await saveToDB('timelineFilename', filename);
      } catch {
        // Silently fail if DB not available
      }
    }
  }

  // Update filename display
  document.getElementById('filename').textContent = filename;
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

// Help button is always visible, no need for visibility logic

// Route color mode handler
document.getElementById('routeColorMode').addEventListener('change', function (e) {
  routeColorMode = e.target.value;
  // Force re-render by resetting lastRenderedIndex
  lastRenderedIndex = -1;
  // Update map to re-render with new color mode
  const currentProgress = parseFloat(document.getElementById('timeSlider').value) / 100;
  updateMap(currentProgress);
  // Update slider gradient
  updateSliderGradient();
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
  // For large files, parse only the specific date's data on-demand
  if (!timelineData || timelineData.length === 0) {
    showLoadingIndicator('Loading date data...');
    try {
      const useRaw = document.getElementById('useRawData').checked;
      currentDateData = await parseTimelineJSONForDate(rawJsonData, dateStr, useRaw);
    } finally {
      hideLoadingIndicator();
    }
  } else {
    currentDateData = filterByDate(timelineData, dateStr);
  }

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

  // Update slider gradient
  updateSliderGradient();

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

// Help modal handlers
document.getElementById('helpBtn').addEventListener('click', function () {
  document.getElementById('helpModal').style.display = 'flex';
});

async function closeHelpModal() {
  document.getElementById('helpModal').style.display = 'none';
  // Save preference that user has closed the help modal
  try {
    await saveToDB('helpModalClosed', true);
  } catch {
    // Silently fail if DB not available
  }
}

document.getElementById('helpCloseBtn').addEventListener('click', closeHelpModal);

// Close modal when clicking outside
document.getElementById('helpModal').addEventListener('click', function (e) {
  if (e.target === this) {
    closeHelpModal();
  }
});

// Help collapsible sections handler
document.querySelectorAll('.help-collapsible-header').forEach((header) => {
  header.addEventListener('click', function () {
    const collapsible = this.parentElement;
    collapsible.classList.toggle('expanded');
  });
});

// Smooth scroll to sections from table of contents
document.querySelectorAll('.help-toc a').forEach((link) => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href').substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
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
  playBtn.innerHTML = icons.pause;
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
  playBtn.innerHTML = icons.play;
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

// Initialize icons
function initIcons() {
  // Set initial button icons
  document.getElementById('playBtn').innerHTML = icons.play;
  document.getElementById('prevDateBtn').innerHTML = icons.chevronLeft;
  document.getElementById('nextDateBtn').innerHTML = icons.chevronRight;
  document.getElementById('controlsChevron').innerHTML = icons.chevronDown;
  document.getElementById('consoleChevron').innerHTML = icons.chevronDown;
  document.getElementById('helpIcon').innerHTML = icons.help;

  // Help modal icons
  document.getElementById('helpIconAndroid').innerHTML = icons.smartphone;
  document.getElementById('helpIconIOS').innerHTML = icons.smartphone;
  document.getElementById('helpIconDesktop').innerHTML = icons.monitor;
  document.getElementById('helpIconUpload').innerHTML = icons.upload;
  document.getElementById('helpIconSettings').innerHTML = icons.settings;
  document.getElementById('helpIconActivity').innerHTML = icons.activity;
  document.getElementById('helpIconSpeed').innerHTML = icons.zap;

  // Help modal chevrons
  document.getElementById('helpChevronAndroid').innerHTML = icons.chevronDown;
  document.getElementById('helpChevronIOS').innerHTML = icons.chevronDown;
  document.getElementById('helpChevronDesktop').innerHTML = icons.chevronDown;
  document.getElementById('helpChevronUpload').innerHTML = icons.chevronDown;
  document.getElementById('helpChevronSettings').innerHTML = icons.chevronDown;
  document.getElementById('helpChevronActivity').innerHTML = icons.chevronDown;
  document.getElementById('helpChevronSpeed').innerHTML = icons.chevronDown;
}

// Initialize app
async function initApp() {
  initIcons();
  initMap();
  try {
    await initDB();
    // Try to load saved data
    const savedData = await loadFromDB('timelineData');
    const savedFilename = await loadFromDB('timelineFilename');
    if (savedData && savedFilename) {
      await loadTimelineData(savedData, savedFilename, false);
    }

    // Check if help modal should be shown (show by default on first visit)
    const helpModalClosed = await loadFromDB('helpModalClosed').catch(() => null);
    if (!helpModalClosed) {
      document.getElementById('helpModal').style.display = 'flex';
    }
  } catch {
    // Silently fail if DB not available
  }
}

// Loading indicator functions
function showLoadingIndicator(message = 'Loading...') {
  const indicator = document.getElementById('loadingIndicator');
  const text = document.getElementById('loadingText');
  if (indicator && text) {
    text.textContent = message;
    indicator.style.display = 'flex';
  }
}

function hideLoadingIndicator() {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

initApp();
