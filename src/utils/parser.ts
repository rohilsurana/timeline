// Timeline data parsing utilities

import type {
  TimelineData,
  LocationPoint,
  SemanticSegment,
  RawSignal,
} from '../types';

// Parse E7 coordinates (Google's format: lat/lng * 10,000,000)
export function parseE7(coord: number): number {
  return coord / 10000000;
}

// Parse timestamp
export function parseTimestamp(ts: string): Date {
  return new Date(ts);
}

// Extract date string from timestamp
export function extractDateFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

// Helper to check if a timestamp matches target date in timezone
function isDateMatch(timestamp: string, targetDateStr: string, timezone: string): boolean {
  const date = new Date(timestamp);
  const dateInTz = date.toLocaleDateString('en-CA', { timeZone: timezone });
  return dateInTz === targetDateStr;
}

// Extract location from semantic segment with optional date filtering
export function extractLocations(
  segment: SemanticSegment,
  targetDateStr?: string,
  timezone?: string
): LocationPoint[] {
  const locations: LocationPoint[] = [];
  const shouldFilter = targetDateStr && timezone;

  // Handle activity segment
  if (segment.activity) {
    const activity = segment.activity;
    const activityType = activity.topCandidate?.type || 'UNKNOWN';
    const startTime = parseTimestamp(segment.startTime);
    const endTime = parseTimestamp(segment.endTime);

    // Add waypoints if available
    if (segment.timelinePath && segment.timelinePath.length > 0) {
      segment.timelinePath.forEach((point) => {
        if (point.point && point.time) {
          // Filter by date if filtering is enabled
          if (shouldFilter && !isDateMatch(point.time, targetDateStr, timezone)) {
            return; // Skip this waypoint
          }

          const [latStr, lngStr] = point.point.replace('geo:', '').split(',');
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          const pointTime = parseTimestamp(point.time);
          locations.push({
            lat,
            lng,
            timestamp: pointTime,
            type: 'activity',
            activity: activityType,
          });
        }
      });
    }
  }
  // Handle place visit
  else if (segment.visit) {
    const visit = segment.visit;
    const startTime = parseTimestamp(segment.startTime);

    // Filter place visit by startTime if filtering is enabled
    if (shouldFilter && !isDateMatch(segment.startTime, targetDateStr, timezone)) {
      return locations; // Skip this place visit
    }

    if (visit.topCandidate && visit.topCandidate.placeLocation) {
      const [latStr, lngStr] = visit.topCandidate.placeLocation.latLng.split(',');
      locations.push({
        lat: parseFloat(latStr),
        lng: parseFloat(lngStr),
        timestamp: startTime,
        type: 'place',
        name:
          visit.topCandidate.placeLocation.name ||
          visit.topCandidate.placeLocation.address ||
          'Unknown Place',
        placeId: visit.topCandidate.placeID || visit.topCandidate.placeId,
        semanticType: visit.topCandidate.semanticType,
      });
    }
  }
  // Handle standalone timelinePath segments (no activity or visit)
  else if (segment.timelinePath && segment.timelinePath.length > 0) {
    segment.timelinePath.forEach((point) => {
      if (point.point && point.time) {
        // Filter by date if filtering is enabled
        if (shouldFilter && !isDateMatch(point.time, targetDateStr, timezone)) {
          return; // Skip this waypoint
        }

        const [latStr, lngStr] = point.point.replace('geo:', '').split(',');
        const pointTime = parseTimestamp(point.time);
        locations.push({
          lat: parseFloat(latStr),
          lng: parseFloat(lngStr),
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
export function extractRawSignal(signal: RawSignal): LocationPoint | null {
  // Handle nested signal.position or direct position
  const pos = signal.position || signal.signal?.position;
  if (!pos) {
    return null;
  }

  let lat: number | undefined;
  let lng: number | undefined;

  // Handle LatLng string format: "22.6993465°, 75.8717841°"
  if (pos.LatLng) {
    const parts = pos.LatLng.replace(/°/g, '')
      .split(',')
      .map((s) => s.trim());
    if (parts.length === 2) {
      lat = parseFloat(parts[0]);
      lng = parseFloat(parts[1]);
    }
  }
  // Handle E7 format
  else if (pos.point?.latE7 && pos.point?.lngE7) {
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
    lat,
    lng,
    timestamp: parseTimestamp(pos.timestamp || signal.additionalTimestamp || signal.timestamp || ''),
    type: 'raw',
    accuracy: pos.accuracyMeters
      ? `${pos.accuracyMeters.toFixed(0)}m`
      : pos.accuracyMm
        ? `${(pos.accuracyMm / 1000).toFixed(0)}m`
        : undefined,
    source: pos.source,
    altitude: pos.altitudeMeters,
    speed: pos.speedMetersPerSecond,
  };
}

// Get unique dates from timeline data (async chunked processing)
export async function getUniqueDatesFromRaw(
  jsonData: TimelineData,
  useRaw: boolean
): Promise<string[]> {
  const dates = new Set<string>();

  if (useRaw && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    const totalSignals = jsonData.rawSignals.length;
    console.log(`Processing ${totalSignals} raw signals for dates`);

    // Process in chunks to avoid blocking
    const chunkSize = 10000;
    let processedCount = 0;
    for (let i = 0; i < totalSignals; i += chunkSize) {
      const end = Math.min(i + chunkSize, totalSignals);

      // Process chunk
      for (let j = i; j < end; j++) {
        const signal = jsonData.rawSignals[j];
        const timestamp =
          signal.position?.timestamp || signal.timestamp || signal.additionalTimestamp;
        if (timestamp) {
          dates.add(extractDateFromTimestamp(timestamp));
        }
      }

      processedCount += end - i;
      if (processedCount % 50000 === 0) {
        console.log(
          `Processed ${processedCount} / ${totalSignals} signals, found ${dates.size} dates`
        );
      }

      // Yield to browser every chunk
      if (i + chunkSize < totalSignals) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    console.log(`Finished processing. Found ${dates.size} unique dates`);
  } else if (jsonData.semanticSegments) {
    // Handle semantic segments - check startTime, endTime, and all waypoints
    const segments = Array.isArray(jsonData)
      ? (jsonData as unknown as SemanticSegment[])
      : jsonData.semanticSegments;

    segments?.forEach((segment) => {
      // Add date from startTime
      if (segment.startTime) {
        dates.add(extractDateFromTimestamp(segment.startTime));
      }
      // Add date from endTime (for segments crossing midnight)
      if (segment.endTime) {
        dates.add(extractDateFromTimestamp(segment.endTime));
      }
      // Add dates from all waypoints
      if (segment.timelinePath && segment.timelinePath.length > 0) {
        segment.timelinePath.forEach((point) => {
          if (point.time) {
            dates.add(extractDateFromTimestamp(point.time));
          }
        });
      }
    });
  }

  return Array.from(dates).sort();
}

// Parse timeline data for a specific date (async chunked processing)
export async function parseTimelineJSONForDate(
  jsonData: TimelineData,
  dateStr: string,
  useRaw = true,
  timezone = 'UTC'
): Promise<LocationPoint[]> {
  const locations: LocationPoint[] = [];

  // Helper to check if a timestamp falls within the target date in the given timezone
  const isTargetDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const dateInTz = date.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    return dateInTz === dateStr;
  };

  // Handle raw signals
  if (useRaw && jsonData.rawSignals && jsonData.rawSignals.length > 0) {
    const totalSignals = jsonData.rawSignals.length;
    const chunkSize = 10000;
    console.log(`Parsing ${totalSignals} raw signals for date ${dateStr}`);

    let processedCount = 0;
    for (let i = 0; i < totalSignals; i += chunkSize) {
      const end = Math.min(i + chunkSize, totalSignals);

      for (let j = i; j < end; j++) {
        const signal = jsonData.rawSignals[j];
        const timestamp =
          signal.position?.timestamp || signal.timestamp || signal.additionalTimestamp;
        if (timestamp && isTargetDate(timestamp)) {
          const loc = extractRawSignal(signal);
          if (loc) {
            locations.push(loc);
          }
        }
      }

      processedCount += end - i;
      if (processedCount % 100000 === 0) {
        console.log(
          `Processed ${processedCount} / ${totalSignals} signals, found ${locations.length} locations for this date`
        );
      }

      // Yield to browser every chunk
      if (i + chunkSize < totalSignals) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    console.log(`Finished parsing. Found ${locations.length} locations for ${dateStr}`);
  }
  // Fallback to semanticSegments
  else if (jsonData.semanticSegments) {
    const segments = Array.isArray(jsonData)
      ? (jsonData as unknown as SemanticSegment[])
      : jsonData.semanticSegments;

    segments?.forEach((segment) => {
      // Include segment if startTime, endTime, or any waypoint matches target date
      let includeSegment = false;

      if (segment.startTime && isTargetDate(segment.startTime)) {
        includeSegment = true;
      } else if (segment.endTime && isTargetDate(segment.endTime)) {
        includeSegment = true;
      } else if (segment.timelinePath && segment.timelinePath.length > 0) {
        // Check if any waypoint is on target date
        includeSegment = segment.timelinePath.some(
          (point) => point.time && isTargetDate(point.time)
        );
      }

      if (includeSegment) {
        // Pass dateStr and timezone to filter waypoints to only those on target date
        const locs = extractLocations(segment, dateStr, timezone);
        locations.push(...locs);
      }
    });
  }

  // Sort by timestamp
  locations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  console.log(`Total locations for ${dateStr}: ${locations.length}`);
  return locations;
}
