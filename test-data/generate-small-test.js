// Generate smaller synthetic Google Timeline data for browser testing
import fs from 'fs';

// Helper functions
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function toISOString(date) {
  return date.toISOString();
}

// Generate coordinates in a realistic area (San Francisco Bay Area)
function generateCoordinate(lat, lng, radius = 0.01) {
  return {
    lat: lat + randomInRange(-radius, radius),
    lng: lng + randomInRange(-radius, radius)
  };
}

// Generate a realistic route between two points
function generateRoute(startLat, startLng, endLat, endLng, numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const ratio = i / (numPoints - 1);
    const lat = startLat + (endLat - startLat) * ratio + randomInRange(-0.001, 0.001);
    const lng = startLng + (endLng - startLng) * ratio + randomInRange(-0.001, 0.001);
    points.push({ lat, lng });
  }
  return points;
}

// Activity types
const activities = [
  'WALKING',
  'RUNNING',
  'CYCLING',
  'IN_VEHICLE',
  'DRIVING',
  'IN_PASSENGER_VEHICLE',
  'STILL'
];

// Generate semantic segments
function generateSemanticSegments(numDays, pointsPerDay) {
  const segments = [];
  const startDate = new Date('2024-06-01T00:00:00.000Z');

  // San Francisco area coordinates
  const locations = [
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
    { lat: 37.8044, lng: -122.2712, name: 'Oakland' },
    { lat: 37.5485, lng: -121.9886, name: 'Fremont' },
    { lat: 37.3861, lng: -122.0839, name: 'Mountain View' },
    { lat: 37.4419, lng: -122.1430, name: 'Palo Alto' },
    { lat: 37.6879, lng: -122.4702, name: 'Daly City' },
  ];

  for (let day = 0; day < numDays; day++) {
    let currentTime = new Date(startDate);
    currentTime.setDate(currentTime.getDate() + day);
    currentTime.setHours(8, 0, 0, 0);

    const numSegments = Math.floor(randomInRange(5, 9));

    for (let seg = 0; seg < numSegments; seg++) {
      const isActivity = Math.random() > 0.3;
      const duration = Math.floor(randomInRange(15, 120));
      const startTime = new Date(currentTime);
      const endTime = addMinutes(currentTime, duration);

      if (isActivity) {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        const startLoc = locations[Math.floor(Math.random() * locations.length)];
        const endLoc = locations[Math.floor(Math.random() * locations.length)];
        const numPoints = Math.floor(pointsPerDay / numSegments);

        const route = generateRoute(startLoc.lat, startLoc.lng, endLoc.lat, endLoc.lng, numPoints);

        const segment = {
          startTime: toISOString(startTime),
          endTime: toISOString(endTime),
          activity: {
            start: toISOString(startTime),
            end: toISOString(endTime),
            probability: randomInRange(0.7, 0.99),
            topCandidate: {
              type: activity,
              probability: randomInRange(0.7, 0.99)
            }
          },
          timelinePath: route.map((point, idx) => {
            const pointTime = new Date(startTime.getTime() + (idx / route.length) * duration * 60000);
            return {
              point: `geo:${point.lat.toFixed(7)},${point.lng.toFixed(7)}`,
              time: toISOString(pointTime),
              accuracy: Math.floor(randomInRange(5, 30))
            };
          })
        };

        segments.push(segment);
      } else {
        const location = locations[Math.floor(Math.random() * locations.length)];
        const coord = generateCoordinate(location.lat, location.lng, 0.002);

        const segment = {
          startTime: toISOString(startTime),
          endTime: toISOString(endTime),
          visit: {
            topCandidate: {
              placeID: `ChIJ${Math.random().toString(36).substring(2, 15)}`,
              probability: randomInRange(0.7, 0.99),
              placeLocation: {
                latLng: `${coord.lat.toFixed(7)},${coord.lng.toFixed(7)}`,
                name: location.name,
                address: `${location.name}, CA`
              },
              semanticType: 'TYPE_HOME'
            },
            probability: randomInRange(0.7, 0.99)
          }
        };

        segments.push(segment);
      }

      currentTime = endTime;
    }
  }

  return segments;
}

// Generate raw signals
function generateRawSignals(numDays, pointsPerDay) {
  const signals = [];
  const startDate = new Date('2024-06-01T00:00:00.000Z');

  let currentLat = 37.7749;
  let currentLng = -122.4194;

  for (let day = 0; day < numDays; day++) {
    for (let point = 0; point < pointsPerDay; point++) {
      const timestamp = new Date(startDate);
      timestamp.setDate(timestamp.getDate() + day);
      timestamp.setSeconds(timestamp.getSeconds() + (point * 86400 / pointsPerDay));

      currentLat += randomInRange(-0.001, 0.001);
      currentLng += randomInRange(-0.001, 0.001);

      const signal = {
        position: {
          latitudeE7: Math.round(currentLat * 10000000),
          longitudeE7: Math.round(currentLng * 10000000),
          accuracyMeters: Math.floor(randomInRange(5, 50)),
          altitudeMeters: Math.floor(randomInRange(0, 100)),
          source: Math.random() > 0.5 ? 'GPS' : 'WIFI',
          timestamp: toISOString(timestamp)
        }
      };

      signals.push(signal);
    }
  }

  return signals;
}

// Generate smaller test file (~20MB)
console.log('Generating small test file for browser testing...');

const numDays = 7; // One week
const pointsPerDay = 200; // Reasonable density
const segmentsPerDay = 50;

console.log(`Generating data for ${numDays} days...`);
console.log(`- Raw signals: ~${(numDays * pointsPerDay).toLocaleString()} points`);
console.log(`- Semantic segments: ~${(numDays * segmentsPerDay / 10).toLocaleString()} segments`);

const data = {
  semanticSegments: generateSemanticSegments(numDays, segmentsPerDay),
  rawSignals: generateRawSignals(numDays, pointsPerDay)
};

console.log('\nGenerating JSON file...');
const jsonString = JSON.stringify(data, null, 2);
const sizeMB = (jsonString.length / (1024 * 1024)).toFixed(2);

console.log(`Generated ${sizeMB}MB of data`);

const outputPath = './small-test-timeline.json';
fs.writeFileSync(outputPath, jsonString);

const stats = fs.statSync(outputPath);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`\n✓ File saved to: ${outputPath}`);
console.log(`✓ Final size: ${fileSizeMB}MB`);
console.log('\nThis smaller file is better for browser testing!');
