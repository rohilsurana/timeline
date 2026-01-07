// Timeline Viewer - Mapbox GL TypeScript implementation

import 'mapbox-gl/dist/mapbox-gl.css';
import { MapboxMap } from './map/MapboxMap';
import { icons } from './icons.js';
import type { LocationPoint, TimelineData, RouteColorMode, AppState } from './types';
import { getUniqueDatesFromRaw, parseTimelineJSONForDate } from './utils/parser';

// Application state
const state: AppState = {
  map: null,
  currentDateData: [],
  availableDates: [],
  selectedTimezone: 'UTC',
  rawJsonData: null,
  routeColorMode: 'none',
  isPlaying: false,
  lastRenderedIndex: -1,
};

// IndexedDB for caching
let db: IDBDatabase | null = null;
let playInterval: number | null = null;
let loadingTimeout: number | null = null;

// Map configuration
// Token is injected via environment variable during build
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
let mapboxMap: MapboxMap | null = null;

// Initialize IndexedDB
async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TimelineDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('timeline')) {
        db.createObjectStore('timeline');
      }
    };
  });
}

// Save to IndexedDB
async function saveToDB(key: string, value: unknown): Promise<void> {
  if (!db) throw new Error('DB not initialized');
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(['timeline'], 'readwrite');
    const store = transaction.objectStore('timeline');
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Load from IndexedDB
async function loadFromDB(key: string): Promise<unknown> {
  if (!db) throw new Error('DB not initialized');
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(['timeline'], 'readonly');
    const store = transaction.objectStore('timeline');
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Loading indicator functions
function showLoadingIndicator(message = 'Loading...'): void {
  const indicator = document.getElementById('loadingIndicator');
  const text = document.getElementById('loadingText');
  if (indicator && text) {
    text.textContent = message;
    indicator.style.display = 'flex';

    if (loadingTimeout) clearTimeout(loadingTimeout);

    loadingTimeout = window.setTimeout(() => {
      if (indicator.style.display === 'flex') {
        text.innerHTML =
          message +
          '<br><span style="font-size: 13px; color: #666; margin-top: 8px; display: block;">This can take time for large files...</span>';
      }
    }, 5000);
  }
}

function hideLoadingIndicator(): void {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
}

// Initialize map
async function initMap(): Promise<void> {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error('VITE_MAPBOX_TOKEN environment variable is not set');
    alert('Mapbox token not configured. Please set VITE_MAPBOX_TOKEN environment variable.');
    return;
  }

  mapboxMap = new MapboxMap('map', MAPBOX_ACCESS_TOKEN, {
    center: [78.9629, 20.5937], // India center
    zoom: 5,
  });

  // Add India boundaries
  await mapboxMap.addIndiaBoundaries();
}

// Update map visualization
// Convert minute value (0-1439) to the closest data point index
function minuteToIndex(minute: number): number {
  if (state.currentDateData.length === 0) return 0;

  // Get the date for the first data point in the selected timezone
  const firstPoint = state.currentDateData[0];
  const dateStr = firstPoint.timestamp.toLocaleDateString('en-CA', { timeZone: state.selectedTimezone });

  // Create target time: dateStr + minute offset in the selected timezone
  // We need to work backwards from a timestamp in the target timezone
  const targetTimeStr = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`;

  // Find the data point closest to this minute
  for (let i = 0; i < state.currentDateData.length; i++) {
    const point = state.currentDateData[i];
    const pointTimeStr = point.timestamp.toLocaleTimeString('en-US', {
      timeZone: state.selectedTimezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const [pointHour, pointMin] = pointTimeStr.split(':').map(Number);
    const pointMinute = pointHour * 60 + pointMin;

    if (pointMinute >= minute) {
      return i;
    }
  }

  // If we didn't find a point after the target minute, return last index
  return state.currentDateData.length - 1;
}

function updateMap(minute: number): void {
  if (!mapboxMap || state.currentDateData.length === 0) return;

  const targetIndex = minuteToIndex(minute);

  // Update route
  mapboxMap.updateRoute(state.currentDateData, targetIndex, state.routeColorMode);
  state.lastRenderedIndex = targetIndex;

  // Update info panel
  const currentLoc = state.currentDateData[targetIndex];
  updateInfoPanel(currentLoc, targetIndex, minute);
}

// Update info panel
function updateInfoPanel(location: LocationPoint, index: number, minute: number): void {
  // Update console content
  const consoleContent = document.getElementById('consoleContent');
  if (consoleContent) {
    const timeStr = location.timestamp.toLocaleString('en-US', {
      timeZone: state.selectedTimezone,
      hour12: true,
    });

    let infoHTML = `<div style="padding: 10px; font-size: 12px; line-height: 1.6;">`;
    infoHTML += `<strong style="font-size: 13px;">${timeStr}</strong><br>`;
    infoHTML += `<div style="margin-top: 8px;">`;
    infoHTML += `Point ${index + 1} of ${state.currentDateData.length}<br>`;
    infoHTML += `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}<br>`;

    if (location.type) {
      infoHTML += `Type: ${location.type}<br>`;
    }
    if (location.activity) {
      infoHTML += `Activity: ${location.activity}<br>`;
    }
    if (location.speed !== undefined) {
      infoHTML += `Speed: ${(location.speed * 3.6).toFixed(1)} km/h<br>`;
    }
    if (location.accuracy) {
      infoHTML += `Accuracy: ${location.accuracy}<br>`;
    }
    if (location.source) {
      infoHTML += `Source: ${location.source}<br>`;
    }
    infoHTML += `</div></div>`;

    consoleContent.innerHTML = infoHTML;
  }

  // Update time display based on slider minute value (not data point time)
  const timeText = document.getElementById('timeText');
  if (timeText) {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    timeText.textContent = timeStr;
  }
}

// Update date navigation buttons
function updateDateNavButtons(currentDate: string): void {
  const currentIndex = state.availableDates.indexOf(currentDate);
  const prevBtn = document.getElementById('prevDateBtn') as HTMLButtonElement;
  const nextBtn = document.getElementById('nextDateBtn') as HTMLButtonElement;

  if (prevBtn) {
    prevBtn.disabled = currentIndex <= 0;
  }
  if (nextBtn) {
    nextBtn.disabled = currentIndex >= state.availableDates.length - 1;
  }
}

// Load timeline data
async function loadTimelineData(
  jsonData: TimelineData,
  filename: string,
  saveToCache = true
): Promise<void> {
  state.rawJsonData = jsonData;

  const useRaw = (document.getElementById('useRawData') as HTMLInputElement).checked;

  const rawSignalCount = jsonData.rawSignals?.length || 0;
  const semanticSegmentCount = jsonData.semanticSegments?.length || 0;
  console.log(
    `Loading file with ${rawSignalCount} raw signals, ${semanticSegmentCount} semantic segments`
  );

  showLoadingIndicator('Processing timeline data...');

  try {
    state.availableDates = await getUniqueDatesFromRaw(jsonData, useRaw);
    if (state.availableDates.length === 0) {
      hideLoadingIndicator();
      alert('No location data found in file');
      return;
    }
  } finally {
    hideLoadingIndicator();
  }

  // Update filename display
  const filenameEl = document.getElementById('filename');
  if (filenameEl) filenameEl.textContent = filename;

  // Populate date selector
  const dateSelect = document.getElementById('dateSelect') as HTMLSelectElement;
  dateSelect.innerHTML = '';
  dateSelect.disabled = false;

  // Add placeholder
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select a date...';
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  dateSelect.appendChild(placeholderOption);

  state.availableDates.forEach((date) => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      timeZone: state.selectedTimezone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    dateSelect.appendChild(option);
  });

  // Save to cache
  if (saveToCache) {
    try {
      await saveToDB('timelineData', jsonData);
      await saveToDB('timelineFilename', filename);
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  // Try to restore saved date
  try {
    const savedDate = (await loadFromDB('selectedDate')) as string;
    if (savedDate && state.availableDates.includes(savedDate)) {
      dateSelect.value = savedDate;
      await loadDate(savedDate);
    }
  } catch {
    // No saved date
  }
}

// Load specific date
async function loadDate(dateStr: string): Promise<void> {
  if (!state.rawJsonData) return;

  showLoadingIndicator('Loading date data...');
  try {
    const useRaw = (document.getElementById('useRawData') as HTMLInputElement).checked;
    state.currentDateData = await parseTimelineJSONForDate(
      state.rawJsonData,
      dateStr,
      useRaw,
      state.selectedTimezone
    );
  } finally {
    hideLoadingIndicator();
  }

  if (state.currentDateData.length === 0) {
    alert('No data for selected date');
    return;
  }

  // Reset playback
  stopPlayback();
  state.lastRenderedIndex = -1;

  // Update slider
  const slider = document.getElementById('timeSlider') as HTMLInputElement;
  slider.value = '0';
  slider.disabled = false;

  // Update map
  updateMap(0);

  // Update date navigation buttons
  updateDateNavButtons(dateStr);

  // Save selected date
  try {
    await saveToDB('selectedDate', dateStr);
  } catch (error) {
    console.error('Failed to save selected date:', error);
  }
}

// Playback controls
function startPlayback(): void {
  if (state.currentDateData.length === 0) return;

  const slider = document.getElementById('timeSlider') as HTMLInputElement;

  // If at the end, reset to start
  if (parseFloat(slider.value) >= 1439) {
    slider.value = '0';
    updateMap(0);
  }

  if (state.isPlaying) return;

  state.isPlaying = true;
  const playBtn = document.getElementById('playBtn');
  if (playBtn) playBtn.setAttribute('data-icon', 'pause');
  // Re-initialize icon
  const iconName = playBtn?.getAttribute('data-icon');
  if (playBtn && iconName && icons[iconName as keyof typeof icons]) {
    playBtn.innerHTML = icons[iconName as keyof typeof icons];
  }

  playInterval = window.setInterval(() => {
    // Read current value from slider (allows seeking during playback)
    let currentValue = parseFloat(slider.value);
    currentValue += 1; // Increment by 1 minute

    if (currentValue >= 1439) {
      currentValue = 1439;
      slider.value = currentValue.toString();
      updateMap(currentValue);
      stopPlayback();
      return;
    }
    slider.value = currentValue.toString();
    updateMap(currentValue);
  }, 50); // Update every 50ms = 1 minute of timeline per 50ms real time (1 day in ~72 seconds)
}

function stopPlayback(): void {
  if (!state.isPlaying) return;

  state.isPlaying = false;
  const playBtn = document.getElementById('playBtn');
  if (playBtn) playBtn.setAttribute('data-icon', 'play');
  // Re-initialize icon
  const iconName = playBtn?.getAttribute('data-icon');
  if (playBtn && iconName && icons[iconName as keyof typeof icons]) {
    playBtn.innerHTML = icons[iconName as keyof typeof icons];
  }

  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

// Initialize all icons
function initIcons(): void {
  // Initialize icons with data-icon attribute
  const iconElements = document.querySelectorAll('[data-icon]');
  iconElements.forEach((el) => {
    const iconName = el.getAttribute('data-icon');
    if (iconName && icons[iconName as keyof typeof icons]) {
      el.innerHTML = icons[iconName as keyof typeof icons];
    }
  });

  // Initialize help modal icons (these don't use data-icon)
  const helpIconEl = document.getElementById('helpIcon');
  if (helpIconEl) helpIconEl.innerHTML = icons.helpCircle;

  const helpIconAndroid = document.getElementById('helpIconAndroid');
  if (helpIconAndroid) helpIconAndroid.innerHTML = icons.smartphone;

  const helpIconIOS = document.getElementById('helpIconIOS');
  if (helpIconIOS) helpIconIOS.innerHTML = icons.smartphone;

  const helpIconDesktop = document.getElementById('helpIconDesktop');
  if (helpIconDesktop) helpIconDesktop.innerHTML = icons.monitor;

  const helpIconUpload = document.getElementById('helpIconUpload');
  if (helpIconUpload) helpIconUpload.innerHTML = icons.upload;

  const helpIconSettings = document.getElementById('helpIconSettings');
  if (helpIconSettings) helpIconSettings.innerHTML = icons.settings;

  const helpIconActivity = document.getElementById('helpIconActivity');
  if (helpIconActivity) helpIconActivity.innerHTML = icons.activity;

  const helpIconSpeed = document.getElementById('helpIconSpeed');
  if (helpIconSpeed) helpIconSpeed.innerHTML = icons.zap;

  // Initialize help chevrons
  const helpChevronAndroid = document.getElementById('helpChevronAndroid');
  if (helpChevronAndroid) helpChevronAndroid.innerHTML = icons.chevronDown;

  const helpChevronIOS = document.getElementById('helpChevronIOS');
  if (helpChevronIOS) helpChevronIOS.innerHTML = icons.chevronDown;

  const helpChevronDesktop = document.getElementById('helpChevronDesktop');
  if (helpChevronDesktop) helpChevronDesktop.innerHTML = icons.chevronDown;

  const helpChevronUpload = document.getElementById('helpChevronUpload');
  if (helpChevronUpload) helpChevronUpload.innerHTML = icons.chevronDown;

  const helpChevronSettings = document.getElementById('helpChevronSettings');
  if (helpChevronSettings) helpChevronSettings.innerHTML = icons.chevronDown;

  const helpChevronActivity = document.getElementById('helpChevronActivity');
  if (helpChevronActivity) helpChevronActivity.innerHTML = icons.chevronDown;

  const helpChevronSpeed = document.getElementById('helpChevronSpeed');
  if (helpChevronSpeed) helpChevronSpeed.innerHTML = icons.chevronDown;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all icons
  initIcons();

  // Initialize timezone
  const timezoneSelect = document.getElementById('timezoneSelect') as HTMLSelectElement;
  if (timezoneSelect) {
    // Try to load saved timezone preference from localStorage
    const savedTimezone = localStorage.getItem('selectedTimezone');
    if (savedTimezone) {
      state.selectedTimezone = savedTimezone;
      timezoneSelect.value = savedTimezone;
    } else {
      // Auto-detect user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      state.selectedTimezone = userTimezone;
      timezoneSelect.value = userTimezone;
    }
  }

  // Initialize map immediately
  await initMap();

  // Initialize DB
  try {
    await initDB();

    // Try to restore cached data
    const savedData = (await loadFromDB('timelineData')) as TimelineData;
    const savedFilename = (await loadFromDB('timelineFilename')) as string;
    if (savedData && savedFilename) {
      await loadTimelineData(savedData, savedFilename, false);
    }
  } catch (error) {
    console.error('DB initialization failed:', error);
  }

  // File upload handler
  document.getElementById('fileInput')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    showLoadingIndicator('Reading file...');
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text) as TimelineData;
      await loadTimelineData(jsonData, file.name);
    } catch (error) {
      hideLoadingIndicator();
      alert(`Failed to load file: ${error}`);
    }
  });

  // Date selector
  document.getElementById('dateSelect')?.addEventListener('change', (e) => {
    const dateStr = (e.target as HTMLSelectElement).value;
    if (dateStr) loadDate(dateStr);
  });

  // Timeline slider
  document.getElementById('timeSlider')?.addEventListener('input', (e) => {
    const minute = parseFloat((e.target as HTMLInputElement).value);
    updateMap(minute);
    // If playing, playback will continue from this new position automatically
    // Update the currentValue in the playback interval
    if (state.isPlaying) {
      // The interval will pick up the new slider value on next iteration
    }
  });

  // Play button
  document.getElementById('playBtn')?.addEventListener('click', () => {
    if (state.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  // Route color mode
  document.getElementById('routeColorMode')?.addEventListener('change', (e) => {
    state.routeColorMode = (e.target as HTMLSelectElement).value as RouteColorMode;
    state.lastRenderedIndex = -1;
    const currentProgress = parseFloat(
      (document.getElementById('timeSlider') as HTMLInputElement).value
    ) / 100;
    updateMap(currentProgress);
  });

  // Timezone selector
  document.getElementById('timezoneSelect')?.addEventListener('change', (e) => {
    state.selectedTimezone = (e.target as HTMLSelectElement).value;
    // Save timezone preference to localStorage
    localStorage.setItem('selectedTimezone', state.selectedTimezone);
    // Refresh date list if data is loaded
    if (state.rawJsonData) {
      const dateSelect = document.getElementById('dateSelect') as HTMLSelectElement;
      const currentValue = dateSelect.value;
      dateSelect.innerHTML = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select a date...';
      placeholder.disabled = true;
      dateSelect.appendChild(placeholder);

      state.availableDates.forEach((date) => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
          timeZone: state.selectedTimezone,
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        dateSelect.appendChild(option);
      });

      if (currentValue && state.availableDates.includes(currentValue)) {
        dateSelect.value = currentValue;
      }
    }
  });

  // Previous date button
  document.getElementById('prevDateBtn')?.addEventListener('click', () => {
    const dateSelect = document.getElementById('dateSelect') as HTMLSelectElement;
    const currentDate = dateSelect.value;
    const currentIndex = state.availableDates.indexOf(currentDate);
    if (currentIndex > 0) {
      const prevDate = state.availableDates[currentIndex - 1];
      dateSelect.value = prevDate;
      loadDate(prevDate);
    }
  });

  // Next date button
  document.getElementById('nextDateBtn')?.addEventListener('click', () => {
    const dateSelect = document.getElementById('dateSelect') as HTMLSelectElement;
    const currentDate = dateSelect.value;
    const currentIndex = state.availableDates.indexOf(currentDate);
    if (currentIndex < state.availableDates.length - 1) {
      const nextDate = state.availableDates[currentIndex + 1];
      dateSelect.value = nextDate;
      loadDate(nextDate);
    }
  });

  // Console expand/collapse handler
  document.getElementById('consoleHeader')?.addEventListener('click', () => {
    const consoleDiv = document.getElementById('console');
    if (consoleDiv?.classList.contains('minimized')) {
      consoleDiv.classList.remove('minimized');
      const chevron = document.getElementById('consoleChevron');
      if (chevron) chevron.setAttribute('data-icon', 'chevronUp');
      if (chevron && icons.chevronUp) chevron.innerHTML = icons.chevronUp;
    } else {
      consoleDiv?.classList.add('minimized');
      const chevron = document.getElementById('consoleChevron');
      if (chevron) chevron.setAttribute('data-icon', 'chevronDown');
      if (chevron && icons.chevronDown) chevron.innerHTML = icons.chevronDown;
    }
  });

  // Controls expand/collapse handler
  document.getElementById('controlsHeader')?.addEventListener('click', () => {
    const controlsDiv = document.getElementById('controls');
    if (controlsDiv?.classList.contains('minimized')) {
      controlsDiv.classList.remove('minimized');
      controlsDiv.classList.add('expanded');
      const chevron = document.getElementById('controlsChevron');
      if (chevron) chevron.setAttribute('data-icon', 'chevronDown');
      if (chevron && icons.chevronDown) chevron.innerHTML = icons.chevronDown;
    } else {
      controlsDiv?.classList.remove('expanded');
      controlsDiv?.classList.add('minimized');
      const chevron = document.getElementById('controlsChevron');
      if (chevron) chevron.setAttribute('data-icon', 'chevronUp');
      if (chevron && icons.chevronUp) chevron.innerHTML = icons.chevronUp;
    }
  });

  // Help modal handlers
  document.getElementById('helpBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('helpModal');
    if (modal) modal.style.display = 'flex';
  });

  document.getElementById('helpCloseBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('helpModal');
    if (modal) modal.style.display = 'none';
  });

  document.getElementById('helpModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('helpModal')) {
      const modal = document.getElementById('helpModal');
      if (modal) modal.style.display = 'none';
    }
  });
});
