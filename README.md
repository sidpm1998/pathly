# Pathly - Location Finder

A web app that helps users find points of interest along their driving route.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Open `config.js` and add your API keys:

```javascript
const ELEVENLABS_API_KEY = 'your-elevenlabs-api-key-here';
const OPENAI_API_KEY = 'your-openai-api-key-here';
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
4. Copy the key (you won't be able to see it again!)

### 3. Run the App

```bash
npm run dev
```

The app will open at `http://localhost:3000`

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

