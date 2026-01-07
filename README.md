# Google Maps Timeline Viewer

A modern web-based visualization tool for exploring your Google Maps Timeline data with interactive playback, route coloring, and detailed activity tracking. Now powered by **Mapbox GL** for smooth vector maps with built-in India boundaries support.

![Timeline Viewer](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Key Features

### 🗺️ **Mapbox GL Powered Maps**
- Beautiful vector maps with smooth zoom and pan
- Built-in India legal boundaries (compliant with Indian mapping regulations)
- High-performance WebGL rendering
- Customizable map styles

### 🎬 **Advanced Timeline Controls**
- **Minute-precision slider** - Navigate through your day with 1-minute resolution (00:00 to 23:59)
- **Animated playback** - Watch your day unfold in real-time
- **Seek during playback** - Jump to any point without stopping playback
- **Auto-reset** - Automatically returns to start when replay is clicked at the end

### 📊 **Dual Data Modes**
- **Raw GPS Signals** - High-frequency, detailed location data with accuracy metrics
- **Semantic Segments** - Processed activities and place visits
- **Live toggle** - Switch between modes without reloading

### 🎨 **Smart Visualization**
- **Route coloring** by speed or activity type
- **Activity detection** - Walking, driving, flying, cycling, and more
- **Timeline Data Console** - Collapsible panel with clickable data points
- **Click-to-seek** - Click any data point to jump to that moment

### 🌍 **Timezone Intelligence**
- **Auto-detection** - Automatically detects your timezone
- **Multiple timezone support** - View data in any timezone
- **Timezone persistence** - Remembers your preference in localStorage
- **Accurate filtering** - Data filtered by date in selected timezone

### 📱 **Progressive Web App (PWA)**
- **Install as an app** - Add to home screen on mobile and desktop
- **Offline support** - Works without internet after first load
- **Fast loading** - Service worker caching for instant startup
- **Native app experience** - Full-screen mode, app icon, splash screen

### 💾 **Performance & Storage**
- **IndexedDB caching** - Fast data access on subsequent loads
- **Chunked processing** - 10,000 records per chunk without blocking UI
- **Route optimization** - Maximum 1000 polyline segments for smooth rendering
- **Lazy loading** - Parse data per-date on-demand
- **Handles 1M+ raw GPS signals** - Large timeline files (200MB+) with smooth 20 FPS animations

## 🎯 Activity Types Supported

The app recognizes and color-codes the following activities:
- 🚶 Walking (Green)
- 🏃 Running (Orange)
- 🚴 Cycling (Purple)
- 🏍️ Motorcycling (Fuchsia)
- 🚗 In Vehicle/Driving (Blue)
- 🚇 In Subway (Purple)
- 🚆 In Rail Vehicle (Cyan)
- 🚌 In Bus (Amber)
- ✈️ Flying (Pink)
- 🛑 Still (Red)

## 📥 Getting Your Timeline Data

### From Android Device

1. **Using Google Takeout (Recommended)**
   - Go to [Google Takeout](https://takeout.google.com/)
   - Deselect all products
   - Scroll down and select **"Location History"**
   - Click "All location history data included"
   - Select **"Timeline"** format (JSON)
   - Click "Next step" and choose export settings
   - Click "Create export"
   - Download the ZIP file when ready (you'll receive an email)
   - Extract the ZIP file and locate the `Timeline.json` file in the `Location History/Timeline` folder

2. **Using Google Maps App**
   - Open Google Maps app
   - Tap your profile picture → **Your Timeline**
   - Tap the three dots (⋮) → **Settings and privacy**
   - Scroll down to **Export Timeline data**
   - Choose date range and format (JSON)
   - Download the exported file

### From iOS Device

1. **Using Google Maps App**
   - Open Google Maps app
   - Tap your profile picture → **Your Timeline**
   - Tap the three dots (⋯) → **Settings and privacy**
   - Scroll to **Export Timeline data**
   - Choose date range and format (JSON)
   - Download the exported file

2. **Using Google Takeout**
   - Follow the same **Google Takeout** steps as Android (above)
   - The process is identical regardless of which device you use Google Maps on

### Data Format Notes

The app supports multiple Google Timeline formats:
- **Semantic Segments** (newer format with `semanticSegments` array)
- **Timeline Objects** (older format with `timelineObjects` array)
- **Raw Signals** (most detailed GPS data with `rawSignals` array)

You can toggle between semantic segments and raw GPS data using the "Use Raw GPS Data" checkbox in the app.

## 🚀 Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Mapbox access token (free tier: 50,000 map loads/month)

### Getting a Mapbox Token

1. Sign up for a free account at [Mapbox](https://account.mapbox.com/auth/signup/)
2. Go to [Access Tokens](https://account.mapbox.com/access-tokens/)
3. Copy your default public token (starts with `pk.`) or create a new one
4. **(Optional)** Add URL restrictions for security:
   - In Mapbox dashboard, edit your token
   - Add URL restrictions: `https://your-username.github.io/*`
   - This prevents unauthorized use of your token

### India Boundaries Implementation

This app uses Mapbox's `worldview='IN'` parameter to display India's legally recognized boundaries including Jammu & Kashmir, Ladakh, and Arunachal Pradesh as per Survey of India guidelines.

**Implementation in MapboxMap.ts:**
```typescript
// Automatically applied to boundary layers
this.map.setFilter(layer.id, [
  'all',
  ['==', ['get', 'worldview'], 'IN'],
  // ...
]);
```

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/rohilsurana/timeline.git
   cd timeline
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Mapbox token**

   Create a `.env` file in the project root:
   ```bash
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   ```

   Or copy from the example:
   ```bash
   cp .env.example .env
   # Edit .env and add your token
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:5173/timeline/`

5. **Load your timeline data**
   - Click "Choose File" and select your `Timeline.json`
   - Select a date from the dropdown
   - Use the play button or drag the slider to explore your day
   - Click data points in the Timeline Data console to jump to specific moments

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Deploy to GitHub Pages

1. **Add Mapbox token to GitHub Secrets**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `VITE_MAPBOX_TOKEN`
   - Value: Your Mapbox token
   - Click "Add secret"

2. **Deploy**
   ```bash
   npm run deploy
   ```

The GitHub Actions workflow will automatically inject the token during build.

## 📁 Project Structure

```
timeline/
├── src/
│   ├── app.ts           # Main application logic (TypeScript)
│   ├── icons.js         # SVG icon definitions
│   ├── index.html       # Main HTML file
│   ├── styles.css       # Application styles
│   ├── map/
│   │   └── MapboxMap.ts # Mapbox GL wrapper with India boundaries
│   ├── utils/
│   │   └── parser.ts    # Timeline data parsing utilities
│   └── types.ts         # TypeScript type definitions
├── dist/                # Built files (generated)
├── .env                 # Environment variables (create this)
├── .env.example         # Environment template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.js       # Vite configuration
└── README.md            # This file
```

## 💻 Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Format code
npm run format

# Deploy to GitHub Pages
npm run deploy
```

## 🛠️ Technologies Used

- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server with HMR
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)** - WebGL-powered vector maps
- **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** - Client-side data storage
- **[Lucide Icons](https://lucide.dev/)** - Clean, consistent SVG icons
- **ESLint & Prettier** - Code quality and formatting

## 🌟 Why Mapbox?

This project uses Mapbox GL JS for superior performance and built-in India compliance. Here's how it compares to the previous Leaflet implementation:

| Feature | Previous (Leaflet) | Current (Mapbox) |
|---------|-------------------|------------------|
| **Map Type** | Raster tiles | Vector (WebGL) |
| **India Boundaries** | Required Mappls key | Built-in with `worldview='IN'` |
| **Language** | JavaScript | TypeScript |
| **Architecture** | Single file | Modular |
| **Type Safety** | No | Yes ✓ |
| **Performance** | Good | Better |
| **Rendering** | DOM-based | GPU-accelerated |

## 🎨 UI Components

### Timeline Controls
- **Play Button** - Start/stop animated playback (left position)
- **Date Selector** - Choose from available dates with timezone-aware display
- **Time Display** - Shows current position in HH:MM format
- **Slider** - 1-minute resolution scrubber (0-1439 minutes)
- **Help Button** - Access user guide (right position, gray tertiary color)

### Timeline Data Console
- **Collapsed State** - Minimal 40x40px square with chevron icon (top-right)
- **Expanded State** - Scrollable list of all data points for the selected date
- **Data Point Info**:
  - Precise timestamp (HH:MM:SS)
  - Coordinates (latitude, longitude)
  - Activity type and speed (when available)
  - Data source and accuracy
- **Click Interaction** - Click any data point to seek timeline to that moment
- **Active Highlight** - Current data point highlighted in blue with auto-scroll

### Controls Panel
- **File Upload** - Load Timeline.json files
- **Timezone Selector** - Choose timezone (auto-detects by default)
- **Raw Data Toggle** - Switch between raw signals and semantic segments
- **Route Color Mode** - Color routes by speed or activity

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Follow the existing code style
   - Run `npm run lint` and `npm run format` before committing
   - Test your changes thoroughly
4. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
   Use [Conventional Commits](https://www.conventionalcommits.org/) format
5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Code Style Guidelines

- Use TypeScript for new features
- Follow existing naming conventions
- Add comments for complex logic
- Keep functions focused and small
- Write type-safe code
- Avoid unnecessary dependencies

### Areas for Contribution

- 🗺️ Additional Mapbox style options
- 📊 Statistics and insights dashboard
- 🎨 Custom theme support
- 📱 Enhanced mobile experience
- 🌐 Internationalization (i18n)
- 🔍 Advanced search and filtering
- 🗂️ Multi-file comparison
- 📈 Heatmap visualizations
- 🎯 Geofencing and location alerts

## 🔒 Privacy & Data Security

- **100% Client-Side** - All processing happens in your browser
- **No Server Upload** - Your timeline data never leaves your device
- **Local Storage** - Data is cached locally using IndexedDB
- **No Analytics** - No tracking or data collection
- **Open Source** - Fully transparent and auditable code
- **Secure Token Storage** - Mapbox token embedded during build, never exposed in source

## 🐛 Troubleshooting

### Mapbox token issues
- Verify token is set in `.env` file: `VITE_MAPBOX_TOKEN=your_token`
- Check token is valid at [Mapbox Account](https://account.mapbox.com/)
- Ensure you haven't exceeded free tier limits (50,000 loads/month)
- For GitHub Pages, verify secret is set correctly in repository settings

### File won't load
- Ensure the file is a valid JSON file from Google Takeout
- Check browser console for errors (F12)
- Try with a smaller date range if file is very large
- Verify file format matches expected structure

### Map not displaying
- Check Mapbox token configuration
- Verify internet connection (map tiles require internet)
- Try refreshing the page
- Clear browser cache and reload
- Check browser console for WebGL errors

### Performance issues with large files
- Use the "Raw GPS Data" toggle to switch to semantic segments
- Filter to specific date ranges in Google Takeout
- Close other browser tabs to free up memory
- Consider using a more powerful device for very large datasets

### Timezone issues
- Verify correct timezone is selected in dropdown
- Check that your data includes timezone information
- Try auto-detect by refreshing the page
- Clear localStorage if timezone preference is cached incorrectly

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

Copyright © 2025 Rohil Surana

## 🙏 Acknowledgments

- [Mapbox](https://www.mapbox.com/) for the powerful mapping platform
- [Lucide](https://lucide.dev/) for clean, consistent icons
- Google Maps Timeline for the data export functionality
- Open source community for inspiration and tools

## 💬 Support

If you encounter issues or have questions:
- Open an [Issue](https://github.com/rohilsurana/timeline/issues)
- Check existing issues for solutions
- Provide detailed information about your setup and the problem
- Include browser console errors if applicable

---

## ⚠️ Disclaimers

### Trademarks
This is an **unofficial, independent tool** and is **not affiliated with, endorsed by, or sponsored by Google LLC, Alphabet Inc., or Mapbox Inc.**

- Google®, Google Maps™, Google Timeline™, and Google Takeout™ are trademarks of Google LLC
- Mapbox® and the Mapbox logo are trademarks of Mapbox Inc.
- All product names, logos, and brands are property of their respective owners
- The use of these trademarks does not imply any affiliation with or endorsement by the trademark holders

### Map Data & Attribution
- Maps © [Mapbox](https://www.mapbox.com/)
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- India boundaries data compliant with Indian government mapping regulations
- See [Mapbox Terms of Service](https://www.mapbox.com/legal/tos) for usage terms

### Privacy & Data Usage
- This application processes your location data **entirely in your web browser**
- No data is sent to any server or third party (except map tile requests to Mapbox)
- All timeline data processing happens locally on your device
- Mapbox receives only map tile requests, not your location data
- You maintain full control and ownership of your data
- See the [Privacy & Data Security](#-privacy--data-security) section for more details

### No Warranty
This software is provided "as is" without warranty of any kind, express or implied. Use at your own risk. The authors and contributors are not liable for any damages or data loss that may occur from using this software.

### India Mapping Compliance
This application uses Mapbox's India-compliant maps with the `worldview='IN'` parameter, which displays boundaries in accordance with Indian regulations. The boundaries shown on the map follow Indian government guidelines.
