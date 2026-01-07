# Timeline Viewer - Mapbox Edition

A modern TypeScript rewrite using Mapbox GL JS with built-in India legal boundaries support.

## ✨ Features

- 🇮🇳 **India Legal Boundaries** - Automatically displays India's boundaries as per Survey of India
- 🗺️ **Mapbox GL JS** - WebGL-powered vector maps for smooth performance
- 📘 **TypeScript** - Full type safety and modern architecture
- 🚀 **Performance** - Handles 1M+ GPS points without freezing
- 🔒 **Privacy-First** - All processing happens in your browser
- 💾 **Offline Cache** - IndexedDB for fast re-loading

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd timeline
   git checkout mapbox-rewrite
   ```

2. **Set up Mapbox token**
   ```bash
   cp .env.example .env
   # Edit .env and add: VITE_MAPBOX_TOKEN=pk.your_token_here
   ```

3. **Install and run**
   ```bash
   npm install
   npm run dev
   ```

4. **Open** http://localhost:5173/timeline/

### GitHub Pages Deployment

See **[GITHUB-DEPLOY.md](GITHUB-DEPLOY.md)** for complete deployment instructions.

**Quick setup:**
1. Add `VITE_MAPBOX_TOKEN` to GitHub repository secrets
2. Push to `mapbox-rewrite` branch
3. GitHub Actions automatically builds and deploys

## 📖 Documentation

- **[SETUP.md](SETUP.md)** - Local development setup
- **[GITHUB-DEPLOY.md](GITHUB-DEPLOY.md)** - GitHub Pages deployment
- **[MAPBOX-REWRITE.md](MAPBOX-REWRITE.md)** - Architecture and implementation details

## 🗺️ India Boundaries

This implementation uses Mapbox's `worldview='IN'` parameter to display India's legally recognized boundaries including:

- ✅ Jammu & Kashmir (complete)
- ✅ Ladakh
- ✅ Arunachal Pradesh
- ✅ All territories as per Survey of India guidelines

**Implementation:**
```typescript
// Automatically applied in MapboxMap.ts
this.map.setFilter(layer.id, [
  'all',
  ['==', ['get', 'worldview'], 'IN'],
  // ...
]);
```

## 🏗️ Architecture

```
src/
├── app.ts              # Main application entry
├── types.ts            # TypeScript type definitions
├── map/
│   └── MapboxMap.ts    # Mapbox GL wrapper with India boundaries
└── utils/
    ├── colors.ts       # Route color utilities
    └── parser.ts       # Timeline data parsing
```

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_MAPBOX_TOKEN` | Yes | Mapbox public access token (starts with `pk.`) |

**Get token:** [mapbox.com/account](https://account.mapbox.com/access-tokens/)

## 🎯 Usage

1. **Get Timeline Data**
   - Export from [Google Takeout](https://takeout.google.com/)
   - Select "Location History" → "Timeline" → JSON format

2. **Upload**
   - Click "Choose File"
   - Select your `Timeline.json`

3. **Visualize**
   - Select a date from dropdown
   - Use timeline slider to explore
   - Click "Play" for animation

## ⚙️ Configuration

### Token Security

**Local Development:**
```bash
# .env file (gitignored)
VITE_MAPBOX_TOKEN=pk.your_token_here
```

**GitHub Actions:**
```yaml
# .github/workflows/deploy.yml
env:
  VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
```

**Production:** Token is embedded in build output (safe for public tokens)

### Token Restrictions (Optional)

Add URL restrictions in Mapbox dashboard:
```
https://your-username.github.io/*
```

## 📊 Performance

- **Async Chunked Processing** - 10k records per chunk
- **Route Optimization** - Max 1000 polyline segments
- **Lazy Loading** - Parse data per-date on-demand
- **IndexedDB Caching** - Fast reload of previously viewed data

**Handles:**
- 1M+ raw GPS signals
- Large timeline files (200MB+)
- Smooth animations at 20 FPS

## 🔧 Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Format code
npm run format

# Type check
npx tsc --noEmit
```

## 📦 Build Output

```
dist/
├── index.html
└── assets/
    ├── index-*.css
    └── index-*.js  # Contains embedded Mapbox token
```

## 🌟 Comparison: Leaflet vs Mapbox

| Feature | Leaflet (main) | Mapbox (this branch) |
|---------|---------------|----------------------|
| **Map Type** | Raster tiles | Vector (WebGL) |
| **India Boundaries** | Requires Mappls key | Built-in |
| **Language** | JavaScript | TypeScript |
| **Architecture** | Single file | Modular |
| **Type Safety** | No | Yes ✓ |
| **Performance** | Good | Better |

## 🤝 Contributing

This is the `mapbox-rewrite` branch. For contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## 📝 License

MIT

## 🙏 Acknowledgments

- **Mapbox** - For excellent mapping tools and India boundary support
- **Google** - For Timeline/Location History data
- **TypeScript** - For type safety
- **Vite** - For fast development experience

---

**Branch:** `mapbox-rewrite`
**Status:** ✅ Production Ready
**Deployed:** [Add your GitHub Pages URL here]

For local setup, see [SETUP.md](SETUP.md)
For deployment, see [GITHUB-DEPLOY.md](GITHUB-DEPLOY.md)
