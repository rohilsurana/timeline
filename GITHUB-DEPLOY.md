# GitHub Pages Deployment Setup

## Overview

This project uses GitHub Actions to automatically build and deploy to GitHub Pages whenever code is pushed to `main` or `mapbox-rewrite` branches.

## Prerequisites

1. **Mapbox Access Token** - Get one from [mapbox.com/account](https://account.mapbox.com/access-tokens/)
2. **GitHub Repository** - Must have GitHub Pages enabled

## Setup Instructions

### 1. Add Mapbox Token as GitHub Secret

The Mapbox token needs to be added as a repository secret so it can be used during the build process.

**Steps:**

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `VITE_MAPBOX_TOKEN`
5. Value: Your Mapbox access token (starts with `pk.`)
6. Click **Add secret**

**Screenshot path:**
```
Repository → Settings → Secrets and variables → Actions → New repository secret
```

### 2. Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### 3. Verify Workflow

The workflow file is at `.github/workflows/deploy.yml`

**Key configuration:**
```yaml
on:
  push:
    branches: [ main, mapbox-rewrite ]  # Deploys on push to these branches

jobs:
  build-and-deploy:
    steps:
      - name: Build
        env:
          VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}  # Uses secret
        run: npm run build
```

### 4. Push to Trigger Deployment

```bash
git push origin mapbox-rewrite
# or
git push origin main
```

### 5. Monitor Deployment

1. Go to **Actions** tab in your repository
2. Click on the latest workflow run
3. Watch the build and deployment progress
4. Once complete, your site will be live!

## Deployment URL

Your site will be available at:
```
https://YOUR_USERNAME.github.io/timeline/
```

Replace `YOUR_USERNAME` with your GitHub username.

## How It Works

### Workflow Steps

1. **Checkout code** - Gets the latest code from the branch
2. **Setup Node.js** - Installs Node.js v20
3. **Install dependencies** - Runs `npm ci`
4. **Build** - Runs `npm run build` with `VITE_MAPBOX_TOKEN` injected
5. **Setup Pages** - Configures GitHub Pages
6. **Upload artifact** - Uploads the `dist/` folder
7. **Deploy** - Deploys to GitHub Pages

### Environment Variable Injection

During the build step:
```yaml
- name: Build
  env:
    VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
  run: npm run build
```

Vite automatically picks up `VITE_*` environment variables and embeds them in the build output at `import.meta.env.VITE_MAPBOX_TOKEN`.

## Security Notes

### ✅ Safe Practices

- Token is stored as a GitHub secret (encrypted)
- Token is only accessible during workflow execution
- Token is embedded in the built JavaScript (necessary for client-side map)
- Using a **public token** (starts with `pk.`) is safe for client-side use

### ⚠️ Token Visibility

**Important:** The Mapbox token will be visible in your deployed JavaScript bundle. This is **expected and safe** for public tokens.

**Why it's safe:**
- Mapbox public tokens are designed for client-side use
- You can restrict token usage by URL in Mapbox dashboard
- Rate limits protect against abuse
- You can revoke/rotate tokens anytime

### 🔒 Token Restrictions (Recommended)

To add an extra layer of security:

1. Go to [Mapbox Account](https://account.mapbox.com/access-tokens/)
2. Click on your token
3. Under **URL restrictions**, add:
   ```
   https://YOUR_USERNAME.github.io/*
   ```
4. Save

This ensures the token only works on your GitHub Pages domain.

## Troubleshooting

### Build Fails with "Mapbox token not configured"

**Problem:** `VITE_MAPBOX_TOKEN` secret is not set or named incorrectly.

**Solution:**
1. Check secret name is exactly `VITE_MAPBOX_TOKEN` (case-sensitive)
2. Verify secret value starts with `pk.`
3. Re-save the secret and re-run workflow

### Map Doesn't Load on Deployed Site

**Problem:** Token restrictions may be blocking the request.

**Solution:**
1. Check browser console for errors
2. Verify token is not URL-restricted, or add your GitHub Pages URL to allowed URLs
3. Test token locally first

### Workflow Doesn't Trigger

**Problem:** Pushing to wrong branch or workflow file is invalid.

**Solution:**
1. Ensure you're pushing to `main` or `mapbox-rewrite` branch
2. Check `.github/workflows/deploy.yml` syntax
3. Check **Actions** tab for any errors

## Manual Build (Local Testing)

To test the build locally with the token:

```bash
# Option 1: Using .env file
echo "VITE_MAPBOX_TOKEN=pk.your_token_here" > .env
npm run build

# Option 2: Inline environment variable
VITE_MAPBOX_TOKEN=pk.your_token_here npm run build

# Test the built files
npm run preview
```

## Updating the Token

If you need to rotate your Mapbox token:

1. Generate a new token at [Mapbox](https://account.mapbox.com/access-tokens/)
2. Update the GitHub secret `VITE_MAPBOX_TOKEN` with the new value
3. Trigger a new deployment (push to main/mapbox-rewrite)
4. Revoke the old token in Mapbox dashboard

## Branch Strategy

Currently configured to deploy from:
- `main` branch - Production
- `mapbox-rewrite` branch - Testing new Mapbox implementation

To change branches, edit `.github/workflows/deploy.yml`:
```yaml
on:
  push:
    branches: [ main, mapbox-rewrite, your-branch-name ]
```

## Support

If deployment fails:
1. Check the **Actions** tab for error logs
2. Verify all secrets are properly configured
3. Test build locally first
4. Check [Vite deployment docs](https://vitejs.dev/guide/static-deploy.html)

---

**Ready to deploy?** Add your `VITE_MAPBOX_TOKEN` secret and push to `mapbox-rewrite`! 🚀
