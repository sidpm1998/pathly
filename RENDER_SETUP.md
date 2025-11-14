# Render Deployment Guide

## Quick Setup Steps

### 1. Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your GitHub account

### 2. Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your `pathly` repository
3. Render will auto-detect it's a Node.js app

### 3. Configure Build Settings
- **Name:** `pathly` (or your preferred name)
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Plan:** Free (or choose a paid plan)

### 4. Add Environment Variables
Click "Environment" tab and add:

```
NODE_ENV=production
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

**Note:** Render automatically sets the `PORT` environment variable, so you don't need to set it manually.

### 5. Deploy
1. Click "Create Web Service"
2. Render will automatically:
   - Install dependencies
   - Build the frontend (`npm run build`)
   - Start the server (`npm start`)
3. Wait for deployment to complete (~5-10 minutes first time)

### 6. Create config.js on Render
After deployment, you'll get a URL like `https://pathly-xxxx.onrender.com`

**Important:** You need to create `config.js` file on Render's file system:
1. Go to your Render service dashboard
2. Click on "Shell" tab (or use SSH)
3. Create `config.js` file with your Supabase keys:
   ```javascript
   const SUPABASE_URL = 'your-supabase-url';
   const SUPABASE_ANON_KEY = 'your-supabase-anon-key';
   const GOOGLE_MAPS_API_KEY = 'your-google-maps-api-key';
   ```

**Alternative:** You can also add these as environment variables and create config.js during build (see advanced setup below).

The app will automatically use the same origin for API calls in production.

## How It Works

- **Build:** `npm run build` creates the `dist/` folder with optimized frontend files
- **Start:** `npm start` runs the Express server which:
  - Serves API endpoints at `/api/*`
  - Serves static frontend files from `/dist`
  - Handles all routes (SPA routing)

## Environment Variables

### Required:
- `OPENAI_API_KEY` - Your OpenAI API key
- `GOOGLE_MAPS_API_KEY` - Your Google Maps API key
- `NODE_ENV=production` - Tells the app it's in production (optional - auto-set if PORT is set)

**Note:** `PORT` is automatically set by Render - you don't need to configure it.

### Optional:
- `FRONTEND_URL` - Your Render URL (for CORS, if needed)

## Free Tier Notes

- **Spins down after 15 minutes of inactivity**
- First request after spin-down takes ~30 seconds (cold start)
- Subsequent requests are fast
- Perfect for development and testing

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure `npm run build` works locally first

### API Calls Fail
- Check that environment variables are set correctly
- Verify CORS settings in `server.js`
- Check Render logs for errors

### Frontend Not Loading
- Ensure `dist/` folder is created during build
- Check that static file serving is enabled in `server.js`
- Verify the build completed successfully

## Updating Your App

1. Push changes to GitHub
2. Render will automatically detect and redeploy
3. Or manually trigger redeploy from Render dashboard

## Custom Domain (Optional)

1. Go to your service settings
2. Click "Custom Domains"
3. Add your domain
4. Follow DNS configuration instructions

