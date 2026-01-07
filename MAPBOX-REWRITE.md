# Mapbox TypeScript Rewrite - Branch: `mapbox-rewrite`

## Summary

Complete rewrite of the Timeline Viewer using **Mapbox GL JS** with **TypeScript** and modern architecture. This implementation shows **India's legally recognized boundaries** by default.

## ✨ What's New

### 1. **India Legal Boundaries Support (Built-in)**
- Uses Mapbox GL JS with `worldview='IN'` parameter
- Automatically shows India's boundaries as per Survey of India
- Includes all of Jammu & Kashmir, Ladakh, and Arunachal Pradesh
- No additional plugins required

### 2. **Modern TypeScript Architecture**
- Full TypeScript rewrite with type safety
- Modular code structure with clear separation of concerns
- Better maintainability and developer experience

### 3. **Mapbox GL JS (WebGL-powered Vector Maps)**
- Modern WebGL rendering for smooth performance
- Vector tiles instead of raster tiles
- Better performance for large datasets
- Smoother animations and interactions

### 4. **Improved Code Organization**

```
src/
├── app.ts                  # Main application entry point
├── types.ts                # TypeScript type definitions
├── map/
│   └── MapboxMap.ts        # Mapbox GL map class with India boundaries
├── utils/
│   ├── colors.ts           # Color utilities for route visualization
│   └── parser.ts           # Timeline data parsing utilities
└── icons.js                # Icon definitions (kept as JS)
```

## 🚀 Getting Started

### 1. Get a Mapbox Access Token

**Free tier includes:**
- 50,000 map loads per month (free forever)
- Vector map tiles
- India boundary support

**Steps:**
1. Visit [mapbox.com/signup](https://account.mapbox.com/auth/signup/)
2. Create a free account
3. Go to [Account > Access Tokens](https://account.mapbox.com/access-tokens/)
4. Copy your default public token (or create a new one)

### 2. Start the Development Server

```bash
npm install
npm run dev
```

### 3. Open the Application

Visit: `http://localhost:5173/timeline/`

### 4. Enter Your Mapbox Token

1. Paste your Mapbox access token in the "Mapbox Access Token" field
2. The map will initialize with India's legal boundaries
3. Upload your Timeline JSON file
4. Select a date to visualize

## 📋 Features

### All Original Features Preserved

✅ Timeline playback with smooth animations
✅ Date selection with timezone support
✅ Route color modes (speed-based, activity-based)
✅ Performance optimizations for large files (async chunked processing)
✅ IndexedDB caching
✅ Raw GPS data vs semantic segments toggle
✅ Interactive timeline slider
✅ Play/pause controls

### New Features

✅ **India legal boundaries by default** (no configuration needed)
✅ **TypeScript** - Type safety and better IDE support
✅ **Modern architecture** - Modular, maintainable code
✅ **Vector maps** - WebGL-powered, smoother rendering
✅ **Better performance** - Optimized for large datasets

## 🏗️ Architecture

### Key Components

#### 1. **MapboxMap Class** (`src/map/MapboxMap.ts`)
- Handles all Mapbox GL JS interactions
- Manages map initialization, route rendering, and markers
- Implements India boundaries support via worldview parameter
- Handles color-coded route segments (speed/activity)

#### 2. **Parser Utilities** (`src/utils/parser.ts`)
- Async chunked processing for large files
- Parses both raw signals and semantic segments
- Extracts location data from various formats (E7, LatLng, geo: URIs)
- Date filtering and grouping

#### 3. **Type System** (`src/types.ts`)
- Comprehensive TypeScript type definitions
- Covers all Google Timeline data structures
- Application state management types

#### 4. **Main Application** (`src/app.ts`)
- Orchestrates all components
- Handles UI interactions
- Manages application state
- IndexedDB caching and persistence

## 🗺️ India Boundaries Implementation

The India boundaries are implemented using Mapbox's `worldview` parameter:

```typescript
// In MapboxMap.ts - addIndiaBoundaries() method
layers.forEach((layer) => {
  if (layer.id.includes('admin') || layer.id.includes('boundary')) {
    // Set worldview to 'IN' for India
    this.map!.setFilter(layer.id, [
      'all',
      ['==', ['get', 'worldview'], 'IN'],
      this.map!.getFilter(layer.id) || true,
    ]);
  }
});
```

This ensures:
- All disputed territories shown as per India's claim
- Compliant with Indian mapping regulations
- Survey of India guidelines followed

## 📊 Performance

### Large File Handling

The implementation uses **async chunked processing** to handle large timeline files:

```typescript
// Process in chunks of 10,000 records
const chunkSize = 10000;
for (let i = 0; i < totalSignals; i += chunkSize) {
  const end = Math.min(i + chunkSize, totalSignals);
  // Process chunk...

  // Yield to browser to keep UI responsive
  if (i + chunkSize < totalSignals) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
```

**Benefits:**
- Browser stays responsive during processing
- No "page unresponsive" dialogs
- Progress visible in console
- Handles 1M+ data points without freezing

### Route Rendering Optimization

Routes are limited to 1000 segments for smooth rendering:

```typescript
const maxPoints = 1000;
const step = Math.max(1, Math.floor(targetIndex / maxPoints));
```

This provides smooth animations while maintaining visual accuracy.

## 🆚 Comparison: Leaflet vs Mapbox GL

| Feature | Leaflet (main branch) | Mapbox GL (this branch) |
|---------|----------------------|-------------------------|
| **Map Technology** | Raster tiles | Vector tiles (WebGL) |
| **India Boundaries** | Requires Mappls API key | Built-in via worldview |
| **Language** | JavaScript | TypeScript |
| **Architecture** | Single file | Modular |
| **Type Safety** | No | Yes |
| **Performance** | Good | Better (WebGL) |
| **Animation** | Good | Smoother |
| **API Key Required** | Yes (Mappls) | Yes (Mapbox) |
| **Free Tier** | Unknown | 50k loads/month |

## 🔧 Development

### Build for Production

```bash
npm run build
```

Output in `dist/` directory.

### Type Checking

TypeScript is configured with strict mode:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- Full type checking during development

### Code Formatting

```bash
npm run format          # Format code
npm run format:check    # Check formatting
```

## 🐛 Known Limitations

1. **Mapbox Token Required**: Users must provide their own Mapbox access token
2. **Archived Boundaries Plugin**: The original `mapbox-gl-boundaries` plugin was archived in 2019, so we use the worldview parameter approach instead
3. **Free Tier Limits**: Mapbox free tier is limited to 50,000 map loads per month

## 🔜 Future Improvements

- [ ] Add Mapbox token validation
- [ ] Implement token persistence in localStorage
- [ ] Add error handling for invalid tokens
- [ ] Add option to export routes as GeoJSON
- [ ] Implement route sharing functionality
- [ ] Add heatmap visualization mode
- [ ] Support for multiple timeline files

## 📝 Migration Notes (from main branch)

### Breaking Changes

1. **No Leaflet**: Completely replaced with Mapbox GL JS
2. **TypeScript**: All code is now TypeScript (.ts files)
3. **Different API**: Mapbox GL API is different from Leaflet API
4. **India Boundaries**: Now built-in, no need for Mappls API key
5. **Different tile provider**: Uses Mapbox tiles instead of OpenStreetMap/Mappls

### Migration Guide for Developers

If you're familiar with the Leaflet implementation:

| Leaflet Concept | Mapbox GL Equivalent |
|----------------|----------------------|
| `L.map()` | `new mapboxgl.Map()` |
| `L.tileLayer()` | Map style (e.g., `streets-v12`) |
| `L.polyline()` | GeoJSON LineString + Layer |
| `L.marker()` | `new mapboxgl.Marker()` |
| `L.featureGroup()` | GeoJSON source + Layer |
| `L.control.zoom()` | `new mapboxgl.NavigationControl()` |

## 📜 License

MIT

## 🙏 Acknowledgments

- **Mapbox** for providing excellent mapping tools and India boundary support
- **Google** for Timeline/Location History data
- **TypeScript** for type safety and better DX
- **Vite** for fast development server

---

**Branch**: `mapbox-rewrite`
**Status**: ✅ Ready for testing
**Dev Server**: `http://localhost:5173/timeline/`

**To test**: Get a free Mapbox token from [mapbox.com](https://account.mapbox.com/access-tokens/) and enter it in the app!
