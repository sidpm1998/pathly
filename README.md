# Pathly - Location Finder

A web app that helps users find points of interest along their driving route.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend API Keys

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your API keys (this file is in `.gitignore` and won't be committed):
   ```env
   OPENAI_API_KEY=your-openai-api-key-here
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
   ELEVENLABS_API_KEY=your-elevenlabs-api-key-here
   PORT=3001
   ```

### 3. Configure Frontend (Supabase)

1. Copy the example config file:
   ```bash
   cp config.example.js config.js
   ```

2. Open `config.js` and add your Supabase keys (only Supabase anon key needed in frontend):
   ```javascript
   const SUPABASE_URL = 'your-supabase-url';
   const SUPABASE_ANON_KEY = 'your-supabase-anon-key';
   ```

#### Getting API Keys:

**ElevenLabs API Key:**
1. Go to [https://elevenlabs.io/](https://elevenlabs.io/)
2. Sign up for an account
3. Navigate to your profile/settings
4. Copy your API key

**OpenAI API Key:**
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key and add it to `.env` file

**Google Maps API Key:**
1. Go to [https://console.cloud.google.com/google/maps-apis](https://console.cloud.google.com/google/maps-apis)
2. Create a project or select an existing one
3. Enable these APIs:
   - Places API (Text Search)
   - Geocoding API
   - Directions API
4. Go to Credentials → Create Credentials → API Key
5. Copy the key and add it to `.env` file as `GOOGLE_MAPS_API_KEY`

**Supabase API Key:**
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy the **anon public** key (NOT the secret key!)
5. Add it to `config.js`

### 4. Run the App

**Option 1: Run both frontend and backend together (recommended):**
```bash
npm run dev:all
```

**Option 2: Run separately:**
```bash
# Terminal 1 - Backend server
npm run dev:server

# Terminal 2 - Frontend
npm run dev
```

The frontend will open at `http://localhost:3000` and the backend API will run on `http://localhost:3001`

## How It Works

1. **Input**: Users can enter text or use voice input
2. **Parsing**: OpenAI ChatGPT parses the input to extract:
   - **Adjective**: Descriptive word (e.g., "Indian", "cheap", "24-hour")
   - **Place Type**: Type of place (e.g., "restaurant", "gas station")
   - **Destination**: Where they're traveling to
3. **Location**: App gets user's current location
4. **Search**: (Coming next) Find places along the route

## Example Queries

- "Find me an Indian restaurant on my way to Delaware"
- "I need a gas station on route to New York"
- "Looking for cheap hotels on my way to Boston"
- "Find a 24-hour pharmacy to Philadelphia"

## API Key Security

**For Development:**
- `config.js` works fine for local development
- The file contains placeholder values that you replace

**For Production:**
- Never expose API keys in client-side code
- Use environment variables (`.env` file)
- Create a backend server to handle API calls
- Use API key restrictions in your API provider dashboards

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Dev Server**: Vite
- **Speech-to-Text**: Browser Web Speech API (ElevenLabs STT coming soon)
- **AI Parsing**: OpenAI GPT-4o-mini
- **Maps**: Google Maps (embedded)

