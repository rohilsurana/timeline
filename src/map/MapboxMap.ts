// Mapbox GL map implementation with India boundaries support

import mapboxgl from 'mapbox-gl';
import type { LocationPoint, RouteColorMode } from '../types';
import { getSpeedColor, getActivityColor } from '../utils/colors';

export class MapboxMap {
  private map: mapboxgl.Map | null = null;
  private routeSourceId = 'route-source';
  private routeLayerId = 'route-layer';
  private markerElement: HTMLElement | null = null;
  private marker: mapboxgl.Marker | null = null;

  constructor(
    container: string | HTMLElement,
    accessToken: string,
    options?: {
      center?: [number, number];
      zoom?: number;
    }
  ) {
    mapboxgl.accessToken = accessToken;

    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: options?.center || [78.9629, 20.5937], // India center [lng, lat]
      zoom: options?.zoom || 5,
    });

    // Add navigation controls
    this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    // Wait for map to load before adding sources
    this.map.on('load', () => {
      this.initializeSources();
    });
  }

  private initializeSources(): void {
    if (!this.map) return;

    // Add empty GeoJSON source for route
    if (!this.map.getSource(this.routeSourceId)) {
      this.map.addSource(this.routeSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // Add route layer
    if (!this.map.getLayer(this.routeLayerId)) {
      this.map.addLayer({
        id: this.routeLayerId,
        type: 'line',
        source: this.routeSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.7,
        },
      });
    }
  }

  // Add India boundaries (claimed territories)
  public async addIndiaBoundaries(): Promise<void> {
    if (!this.map) return;

    // Wait for style to load
    if (!this.map.isStyleLoaded()) {
      await new Promise<void>((resolve) => {
        this.map!.once('style.load', () => resolve());
      });
    }

    try {
      // Add India admin boundaries layer
      // We'll use Mapbox's worldview parameter to show India's boundaries
      const layers = this.map.getStyle()?.layers || [];

      // Find admin boundary layers and update their filter to show India's worldview
      layers.forEach((layer) => {
        if (
          layer.id.includes('admin') ||
          layer.id.includes('boundary') ||
          layer.id.includes('disputed')
        ) {
          // Set worldview to 'IN' for India
          this.map!.setFilter(layer.id, [
            'all',
            ['==', ['get', 'worldview'], 'IN'],
            this.map!.getFilter(layer.id) || true,
          ]);
        }
      });

      console.log('India boundaries configured');
    } catch (error) {
      console.error('Failed to add India boundaries:', error);
    }
  }

  // Update route visualization
  public updateRoute(
    locations: LocationPoint[],
    targetIndex: number,
    colorMode: RouteColorMode = 'none'
  ): void {
    if (!this.map || locations.length === 0) return;

    const maxPoints = 1000;
    const step = Math.max(1, Math.floor(targetIndex / maxPoints));

    // Build features array
    const features: GeoJSON.Feature[] = [];

    if (colorMode === 'none') {
      // Single color line
      const coordinates: [number, number][] = [];
      for (let i = 0; i <= targetIndex; i += step) {
        coordinates.push([locations[i].lng, locations[i].lat]);
      }
      // Always include last point
      if (targetIndex % step !== 0) {
        coordinates.push([
          locations[targetIndex].lng,
          locations[targetIndex].lat,
        ]);
      }

      if (coordinates.length > 1) {
        features.push({
          type: 'Feature',
          properties: {
            color: '#4285f4',
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        });
      }
    } else {
      // Color-coded segments
      for (let i = 0; i < targetIndex; i += step) {
        const nextIndex = Math.min(i + step, targetIndex);
        if (nextIndex > i) {
          const coordinates: [number, number][] = [];
          for (let j = i; j <= nextIndex; j++) {
            coordinates.push([locations[j].lng, locations[j].lat]);
          }

          let color = '#4285f4';
          if (colorMode === 'speed' && locations[i].speed !== undefined) {
            color = getSpeedColor(locations[i].speed!);
          } else if (colorMode === 'activity' && locations[i].activity) {
            color = getActivityColor(locations[i].activity!);
          }

          features.push({
            type: 'Feature',
            properties: { color },
            geometry: {
              type: 'LineString',
              coordinates,
            },
          });
        }
      }
    }

    // Update source
    const source = this.map.getSource(this.routeSourceId) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      });
    }

    // Update marker
    this.updateMarker(locations[targetIndex]);

    // Fit bounds on first render
    if (targetIndex === 0 && locations.length > 0) {
      this.fitBounds(locations.slice(0, Math.min(100, locations.length)));
    }
  }

  // Update marker position
  private updateMarker(location: LocationPoint): void {
    if (!this.map) return;

    if (!this.marker) {
      // Create marker element
      this.markerElement = document.createElement('div');
      this.markerElement.className = 'custom-marker';
      this.markerElement.style.cssText = `
        width: 20px;
        height: 20px;
        background: #5e6ad2;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      this.marker = new mapboxgl.Marker({
        element: this.markerElement,
      })
        .setLngLat([location.lng, location.lat])
        .addTo(this.map);
    } else {
      this.marker.setLngLat([location.lng, location.lat]);
    }
  }

  // Fit map to show all locations
  private fitBounds(locations: LocationPoint[]): void {
    if (!this.map || locations.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach((loc) => {
      bounds.extend([loc.lng, loc.lat]);
    });

    this.map.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15,
    });
  }

  // Clear route
  public clearRoute(): void {
    const source = this.map?.getSource(this.routeSourceId) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }

    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
  }

  // Get map instance
  public getMap(): mapboxgl.Map | null {
    return this.map;
  }

  // Destroy map
  public destroy(): void {
    if (this.marker) {
      this.marker.remove();
    }
    if (this.map) {
      this.map.remove();
    }
  }
}
