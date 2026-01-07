# Setup Instructions - Mapbox Edition

## Quick Start

### 1. Get Your Mapbox Token

1. Visit [mapbox.com/signup](https://account.mapbox.com/auth/signup/)
2. Create a free account (no credit card required)
3. Go to [Access Tokens](https://account.mapbox.com/access-tokens/)
4. Copy your **Default Public Token** (starts with `pk.`)

**Free Tier Includes:**
- 50,000 map loads per month (forever free)
- Vector maps with WebGL rendering
- India boundaries support built-in

### 2. Configure Your Token

**Option A: Environment Variable (Recommended)**

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your token:
   ```bash
   VITE_MAPBOX_TOKEN=pk.YOUR_ACTUAL_TOKEN_HERE
   ```

**Option B: Hardcode in Code (Quick & Easy)**

Edit `src/app.ts` line 28:
```typescript
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.YOUR_ACTUAL_TOKEN_HERE';
```

Replace `'pk.YOUR_ACTUAL_TOKEN_HERE'` with your actual token.

### 3. Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Open the App

Visit: `http://localhost:5173/timeline/`

The map will automatically load with India's legal boundaries! 🇮🇳

## Usage

1. **Upload Timeline Data**: Click "Choose File" and select your `Timeline.json`
2. **Select Date**: Pick a date from the dropdown
3. **Explore**: Use the timeline slider to see your movement over time
4. **Play**: Click "Play" to animate your route

## Features

✅ **India Legal Boundaries** - Automatically shows India's boundaries as per Survey of India
✅ **Timeline Playback** - Smooth animations of your movement
✅ **Route Coloring** - Color by speed or activity type
✅ **Large File Support** - Handles 1M+ data points without freezing
✅ **Privacy-First** - All processing happens in your browser

## Tech Stack

- **Mapbox GL JS** - WebGL-powered vector maps
- **TypeScript** - Type-safe code
- **Vite** - Fast development server
- **IndexedDB** - Browser storage for caching

## Getting Timeline Data

### From Google Takeout

1. Visit [takeout.google.com](https://takeout.google.com/)
2. Sign in to your Google account
3. Click "Deselect all"
4. Scroll down and check **"Location History"**
5. Click "All location history data included"
6. Select only **"Timeline"** → Choose **JSON** format
7. Click "OK" then "Next step"
8. Choose one-time export
9. Click "Create export"
10. Wait for email (can take hours)
11. Download and extract the ZIP
12. Find `Timeline.json` in the extracted folder

### From iOS (Google Maps App)

1. Open Google Maps app
2. Tap your profile picture
3. Go to "Your Timeline"
4. Tap the three dots (⋮) → "Settings and privacy"
5. Scroll to "Location History is on"
6. Tap "Download your Timeline data"
7. Choose date range and format (JSON)
8. Download when ready

## Troubleshooting

### "Mapbox token not configured" Error

**Solution**: Make sure you've set your token in either:
- `.env` file with `VITE_MAPBOX_TOKEN=pk.your_token`
- OR hardcoded in `src/app.ts`

Then restart the dev server (`npm run dev`).

### Map Doesn't Load

1. Check browser console (F12) for errors
2. Verify your token is valid at [mapbox.com/account](https://account.mapbox.com/access-tokens/)
3. Make sure token starts with `pk.` (public token)
4. Restart dev server after changing `.env`

### India Boundaries Not Showing

India boundaries are automatically applied when the map loads. They use Mapbox's `worldview='IN'` parameter to show India's territorial claims including:
- All of Jammu & Kashmir
- Ladakh
- Arunachal Pradesh
- As per Survey of India guidelines

## Security Note

⚠️ **Never commit your `.env` file to Git!**

The `.env` file is already in `.gitignore` to prevent accidental commits.

If you hardcode your token in `src/app.ts`, **do not commit that file to a public repository**. Use environment variables instead for production deployments.

## Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

For production, set the environment variable:
```bash
VITE_MAPBOX_TOKEN=pk.your_token npm run build
```

---

**Need Help?**

- Mapbox Docs: https://docs.mapbox.com/mapbox-gl-js/
- Get Support: Open an issue on GitHub
