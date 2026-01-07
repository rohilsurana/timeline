// Color utility functions for route visualization

export function getSpeedColor(speed: number): string {
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

export function getActivityColor(activity: string): string {
  const activityColors: Record<string, string> = {
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
