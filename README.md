# Google Maps Timeline Viewer

A web-based visualization tool for exploring your Google Maps Timeline data with interactive playback, route coloring, and detailed activity tracking.

![Timeline Viewer](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- 📍 **Interactive Map Visualization** - View your location history on an interactive OpenStreetMap
- 🎨 **Route Coloring** - Color routes by speed or activity type
- ▶️ **Animated Playback** - Watch your day unfold with smooth timeline animation
- 📊 **Activity Detection** - Automatic detection of walking, driving, flying, cycling, and more
- 🗓️ **Date Navigation** - Easily browse through your timeline history
- 🌍 **Timezone Support** - View data in multiple timezones
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 💾 **Offline Storage** - Caches your data locally using IndexedDB

## Activity Types Supported

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

## Getting Your Timeline Data

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

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

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

3. **Start development server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:5173`

4. **Load your timeline data**
   - Click "Choose File" and select your `Timeline.json`
   - Select a date from the dropdown
   - Use the play button or drag the slider to explore your day

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the project and deploys it to GitHub Pages.

## Project Structure

```
timeline/
├── src/
│   ├── app.js          # Main application logic
│   ├── icons.js        # SVG icon definitions
│   ├── index.html      # Main HTML file
│   └── styles.css      # Application styles
├── dist/               # Built files (generated)
├── .playwright-mcp/    # Browser automation data
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
├── eslint.config.js    # ESLint configuration
└── README.md          # This file
```

## Development Commands

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

## Technologies Used

- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Leaflet.js](https://leafletjs.com/)** - Interactive map library
- **[OpenStreetMap](https://www.openstreetmap.org/)** - Map tiles
- **IndexedDB** - Client-side data storage
- **Vanilla JavaScript** - No framework dependencies
- **ESLint & Prettier** - Code quality and formatting

## Contributing

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

- Use ES6+ features
- Follow existing naming conventions
- Add comments for complex logic
- Keep functions focused and small
- Avoid unnecessary dependencies

### Areas for Contribution

- 🗺️ Additional map tile providers
- 📊 More visualization options (heatmaps, charts)
- 🎨 Theme customization
- 📱 Enhanced mobile experience
- 🌐 Internationalization (i18n)
- 📈 Statistics and insights
- 🔍 Search and filter capabilities
- 🗂️ Multiple file/timeline comparison

## Privacy & Data Security

- **100% Client-Side** - All processing happens in your browser
- **No Server Upload** - Your timeline data never leaves your device
- **Local Storage** - Data is cached locally using IndexedDB
- **No Analytics** - No tracking or data collection
- **Open Source** - Fully transparent and auditable code

## Troubleshooting

### File won't load
- Ensure the file is a valid JSON file from Google Takeout
- Check browser console for errors (F12)
- Try with a smaller date range if file is very large

### Map not displaying
- Check your internet connection (map tiles require internet)
- Try refreshing the page
- Clear browser cache and reload

### Performance issues with large files
- Use the "Raw GPS Data" toggle to switch to semantic segments
- Filter to specific date ranges in Google Takeout
- Close other browser tabs to free up memory

## License

MIT License - see [LICENSE](LICENSE) file for details

Copyright © 2025 Rohil Surana

## Acknowledgments

- [Leaflet](https://leafletjs.com/) for the excellent mapping library
- [OpenStreetMap](https://www.openstreetmap.org/) contributors for map data
- [Lucide](https://lucide.dev/) for clean, consistent icons
- Google Maps Timeline for the data export functionality

## Support

If you encounter issues or have questions:
- Open an [Issue](https://github.com/rohilsurana/timeline/issues)
- Check existing issues for solutions
- Provide detailed information about your setup and the problem

---

## Disclaimers

### Trademarks
This is an **unofficial, independent tool** and is **not affiliated with, endorsed by, or sponsored by Google LLC or Alphabet Inc.**

- Google®, Google Maps™, Google Timeline™, and Google Takeout™ are trademarks of Google LLC
- All product names, logos, and brands are property of their respective owners
- The use of these trademarks does not imply any affiliation with or endorsement by the trademark holders

### Map Data & Attribution
- Map tiles and data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Maps powered by [Leaflet](https://leafletjs.com/)
- Map data is licensed under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/)
- Cartography licensed under [CC BY-SA](https://creativecommons.org/licenses/by-sa/2.0/)

### Privacy & Data Usage
- This application processes your location data **entirely in your web browser**
- No data is sent to any server or third party
- All data processing happens locally on your device
- You maintain full control and ownership of your data
- See the [Privacy & Data Security](#privacy--data-security) section for more details

### No Warranty
This software is provided "as is" without warranty of any kind, express or implied. Use at your own risk. The authors and contributors are not liable for any damages or data loss that may occur from using this software.
