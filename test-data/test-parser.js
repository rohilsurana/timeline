// Test parser to debug synthetic timeline data
import fs from 'fs';

// Parse timestamp
function parseTimestamp(ts) {
  return new Date(ts);
}

// Parse E7 format
function parseE7(value) {
  return value / 10000000;
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

  return locations;
}

// Extract raw signal
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

  console.log('Starting parse...');
  console.log('Data type:', Array.isArray(jsonData) ? 'Array' : 'Object');
  console.log('Has semanticSegments:', !!jsonData.semanticSegments);
  console.log('Has rawSignals:', !!jsonData.rawSignals);

  // Handle case where jsonData is directly an array of semantic segments (iOS export)
  let semanticSegments = null;
  if (Array.isArray(jsonData)) {
    semanticSegments = jsonData;
    console.log('Using jsonData directly as array');
  } else if (jsonData.semanticSegments) {
    semanticSegments = jsonData.semanticSegments;
    console.log('Using jsonData.semanticSegments');
  }

  // Handle rawSignals (most detailed, raw GPS data) if enabled
  if (useRaw && !Array.isArray(jsonData) && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    console.log(`Processing ${jsonData.rawSignals.length} raw signals...`);
    let rawCount = 0;
    jsonData.rawSignals.forEach((signal, idx) => {
      try {
        const loc = extractRawSignal(signal);
        if (loc) {
          locations.push(loc);
          rawCount++;
        }
      } catch (err) {
        console.error(`Error processing raw signal ${idx}:`, err.message);
        if (idx < 3) {
          console.error('Sample signal:', JSON.stringify(signal, null, 2));
        }
      }
    });
    console.log(`Successfully parsed ${rawCount} raw signals`);
  }
  // Fallback to semanticSegments if raw disabled or no rawSignals
  else if (semanticSegments) {
    console.log(`Processing ${semanticSegments.length} semantic segments...`);

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
    let segmentCount = 0;
    semanticSegments.forEach((segment, idx) => {
      try {
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

        const locs = extractLocations(segment);
        locations.push(...locs);
        if (locs.length > 0) segmentCount++;
      } catch (err) {
        console.error(`Error processing segment ${idx}:`, err.message);
        if (idx < 3) {
          console.error('Sample segment:', JSON.stringify(segment, null, 2));
        }
      }
    });
    console.log(`Successfully parsed ${segmentCount} segments with ${locations.length} locations`);
  }

  // Sort by timestamp
  locations.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`Total locations: ${locations.length}`);
  if (locations.length > 0) {
    console.log('First location:', locations[0]);
    console.log('Last location:', locations[locations.length - 1]);
  }

  return locations;
}

// Main test
const filename = process.argv[2] || './synthetic-timeline.json';
console.log(`Loading ${filename}...\n`);

try {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

  console.log('=== Testing with useRaw=true ===');
  const locationsRaw = parseTimelineJSON(data, true);
  console.log(`Result: ${locationsRaw.length} locations\n`);

  console.log('=== Testing with useRaw=false ===');
  const locationsNoRaw = parseTimelineJSON(data, false);
  console.log(`Result: ${locationsNoRaw.length} locations\n`);

  if (locationsRaw.length === 0 && locationsNoRaw.length === 0) {
    console.error('ERROR: No locations found in either mode!');
    process.exit(1);
  } else {
    console.log('✓ Parser test passed!');
  }
} catch (err) {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
}
