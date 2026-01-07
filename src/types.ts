// Type definitions for Timeline Viewer

export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  type: 'activity' | 'place' | 'path' | 'raw';
  activity?: string;
  name?: string;
  placeId?: string;
  semanticType?: string;
  accuracy?: string;
  source?: string;
  altitude?: number;
  speed?: number;
}

export interface TimelineData {
  semanticSegments?: SemanticSegment[];
  rawSignals?: RawSignal[];
}

export interface SemanticSegment {
  startTime: string;
  endTime: string;
  activity?: ActivitySegment;
  visit?: VisitSegment;
  timelinePath?: TimelinePathPoint[];
}

export interface ActivitySegment {
  start?: string;
  end?: string;
  probability?: number;
  topCandidate?: {
    type: string;
    probability: number;
  };
}

export interface VisitSegment {
  topCandidate?: {
    placeID?: string;
    placeId?: string;
    probability?: number;
    placeLocation?: {
      latLng: string;
      name?: string;
      address?: string;
    };
    semanticType?: string;
  };
  probability?: number;
}

export interface TimelinePathPoint {
  point: string;
  time: string;
  accuracy?: number;
}

export interface RawSignal {
  position?: RawPosition;
  signal?: {
    position?: RawPosition;
  };
  additionalTimestamp?: string;
  timestamp?: string;
}

export interface RawPosition {
  LatLng?: string;
  point?: {
    latE7?: number;
    lngE7?: number;
  };
  latitudeE7?: number;
  longitudeE7?: number;
  timestamp?: string;
  accuracyMeters?: number;
  accuracyMm?: number;
  source?: string;
  altitudeMeters?: number;
  speedMetersPerSecond?: number;
}

export type RouteColorMode = 'none' | 'speed' | 'activity';

export interface AppState {
  map: mapboxgl.Map | null;
  currentDateData: LocationPoint[];
  availableDates: string[];
  selectedTimezone: string;
  rawJsonData: TimelineData | null;
  routeColorMode: RouteColorMode;
  isPlaying: boolean;
  lastRenderedIndex: number;
}
