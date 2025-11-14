// Import Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
let supabase = null;
if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined' && 
    SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_KEY_HERE' &&
    SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY_HERE') {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
    }
} else {
    console.warn('Supabase credentials not configured');
}

// Stored variables from user input
let parsedData = {
    adjective: null,
    placeType: null,
    destination: null
};

// Store current location
let currentLocation = {
    latitude: null,
    longitude: null
};

// Get DOM elements
const textInput = document.getElementById('textInput');
const voiceBtn = document.getElementById('voiceBtn');
const submitBtn = document.getElementById('submitBtn');
const voiceStatus = document.getElementById('voiceStatus');
const status = document.getElementById('status');
const parsedInfo = document.getElementById('parsedInfo');
const adjectiveEl = document.getElementById('adjective');
const placeTypeEl = document.getElementById('placeType');
const destinationEl = document.getElementById('destination');
const locationInfo = document.getElementById('locationInfo');
const latitudeEl = document.getElementById('latitude');
const longitudeEl = document.getElementById('longitude');
const accuracyEl = document.getElementById('accuracy');
const timestampEl = document.getElementById('timestamp');
const mapEl = document.getElementById('map');

// Voice recognition state
let recognition = null;
let isListening = false;
let autoProcessTimeout = null;

// Check API keys
function checkAPIKeys() {
    if (typeof ELEVENLABS_API_KEY === 'undefined' || ELEVENLABS_API_KEY === 'YOUR_ELEVENLABS_API_KEY_HERE') {
        console.warn('ElevenLabs API key not configured');
    }
    if (typeof OPENAI_API_KEY === 'undefined' || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
        showStatus('OpenAI API key not configured. Please add it to config.js', 'error');
        submitBtn.disabled = true;
        voiceBtn.disabled = true;
        return false;
    }
    return true;
}

// Initialize voice recognition
function initVoiceRecognition() {
    // Note: ElevenLabs doesn't have a public Speech-to-Text API yet
    // Using Web Speech API for now - when ElevenLabs STT becomes available, we can swap it here
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            voiceStatus.classList.remove('hidden');
            voiceBtn.classList.add('recording');
            showStatus('Listening... Speak now!', 'info');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            textInput.value = transcript;
            isListening = false;
            voiceStatus.classList.add('hidden');
            voiceBtn.classList.remove('recording');
            showStatus('Speech recognized! Processing...', 'info');
            
            // Clear any existing timeout
            if (autoProcessTimeout) {
                clearTimeout(autoProcessTimeout);
            }
            
            // Automatically process after a short delay (800ms to account for natural pauses)
            autoProcessTimeout = setTimeout(() => {
                processInput(transcript);
                autoProcessTimeout = null;
            }, 800);
        };

        recognition.onerror = (event) => {
            isListening = false;
            voiceStatus.classList.add('hidden');
            voiceBtn.classList.remove('recording');
            
            let errorMessage = 'Speech recognition error. ';
            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Please try again.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Microphone not found. Please check your microphone.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied. Please enable microphone access.';
                    break;
                default:
                    errorMessage = `Speech recognition error: ${event.error}`;
            }
            showStatus(errorMessage, 'error');
        };

        recognition.onend = () => {
            isListening = false;
            voiceStatus.classList.add('hidden');
            voiceBtn.classList.remove('recording');
            
            // If we have a transcript in the input but haven't processed yet, process it now
            // This handles the case where user clicks mic again to stop manually
            if (textInput.value.trim() && autoProcessTimeout) {
                // The timeout will handle it, but we can also process immediately if needed
                // Actually, let's let the timeout handle it to avoid double processing
            }
        };
    } else {
        voiceBtn.disabled = true;
        voiceBtn.title = 'Speech recognition not supported in this browser';
        console.warn('Speech recognition not supported');
    }
}

// Initialize on page load
checkAPIKeys();
initVoiceRecognition();

// Voice button click
voiceBtn.addEventListener('click', () => {
    if (!checkAPIKeys()) return;

    if (!recognition) {
        showStatus('Speech recognition not supported. Please use text input.', 'error');
        return;
    }

    if (isListening) {
        // Stop listening - if we have text, process it after a brief delay
        recognition.stop();
        if (textInput.value.trim() && !autoProcessTimeout) {
            // Give a moment for onresult to fire, then process
            setTimeout(() => {
                if (textInput.value.trim()) {
                    processInput(textInput.value.trim());
                }
            }, 300);
        }
    } else {
        // Start listening
        try {
            recognition.start();
        } catch (error) {
            // Recognition might already be running
            if (error.name === 'InvalidStateError') {
                recognition.stop();
                setTimeout(() => recognition.start(), 100);
            } else {
                showStatus('Error starting speech recognition. Please try again.', 'error');
            }
        }
    }
});

// Submit button click
submitBtn.addEventListener('click', () => {
    const input = textInput.value.trim();
    if (!input) {
        showStatus('Please enter your search query.', 'error');
        return;
    }
    processInput(input);
});

// Enter key on text input
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitBtn.click();
    }
});

// Process user input - parse using OpenAI
async function processInput(input) {
    // Clear any pending auto-process timeout
    if (autoProcessTimeout) {
        clearTimeout(autoProcessTimeout);
        autoProcessTimeout = null;
    }
    
    showStatus('Processing your request with AI...', 'loading');
    
    try {
        // Parse the input using OpenAI
        const parsed = await parseInputWithOpenAI(input);
        
        if (!parsed || parsed.error) {
            showStatus(parsed?.error || 'Could not understand your request. Please try again with a clearer query.', 'error');
            parsedInfo.classList.add('hidden');
            return;
        }

        // Store parsed variables
        parsedData.adjective = parsed.adjective === 'none' || parsed.adjective === null ? null : parsed.adjective;
        parsedData.placeType = parsed.placeType;
        parsedData.destination = parsed.destination;

        // Display parsed info
        adjectiveEl.textContent = parsedData.adjective || 'None';
        placeTypeEl.textContent = parsedData.placeType;
        destinationEl.textContent = parsedData.destination;
        parsedInfo.classList.remove('hidden');

        // Now get location
        getCurrentLocation();
    } catch (error) {
        console.error('Error processing input:', error);
        showStatus('Error processing your request. Please try again.', 'error');
        parsedInfo.classList.add('hidden');
    }
}

// Parse input using OpenAI ChatGPT
async function parseInputWithOpenAI(input) {
    const apiKey = typeof OPENAI_API_KEY !== 'undefined' && OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY_HERE' 
        ? OPENAI_API_KEY 
        : null;

    if (!apiKey) {
        return { error: 'OpenAI API key not configured' };
    }

    const prompt = `You are an intelligent assistant that understands user intent and extracts structured data from natural language queries about finding places along a route.

**CRITICAL INSTRUCTIONS:**
1. **Understand intent, not just patterns** - Interpret what the user means, not just what they say literally
2. **Extract adjective intelligently** - If the user mentions a specific type/cuisine/style, that's the adjective (e.g., "burger place" → adjective: "burger", "Italian restaurant" → adjective: "Italian")
3. **Map place types to categories** - You MUST map the place type to one of these exact categories:
   - "Restaurants" (for any food/dining place: restaurant, cafe, diner, fast food, etc.)
   - "Petrol Pumps" (for gas stations, fuel stations, petrol stations)
   - "Repair Store" (for auto repair, mechanic, service center, etc.)
   - "Hospital" (for hospitals, medical centers, emergency rooms)
   - "Pharmacy" (for pharmacies, drug stores, chemists)
   - "Hotel / Motel" (for hotels, motels, lodges, inns)
   - "Travel Points" (for airports, train stations, bus stations, transit hubs)
   - "EV Charging Spots" (for electric vehicle charging stations)
4. **Correct typos intelligently** - Fix spelling errors in all fields using your knowledge
5. **Normalize destinations** - Correct and expand location names (e.g., "philly" → "Philadelphia", "NYC" → "New York")

**Your task is to extract:**
1. **adjective**: Any descriptive word, cuisine type, or modifier (e.g., "burger", "Indian", "cheap", "24-hour"). If no adjective is present, return null (not "none").
2. **placeType**: MUST be one of the 8 categories listed above, exactly as written.
3. **destination**: The destination location with correct, full spelling (city, state, or country name).

**Examples:**
- "burger place on my way to philly" → adjective: "burger", placeType: "Restaurants", destination: "Philadelphia"
- "Find me an Indian restaurant on my way to Delaware" → adjective: "Indian", placeType: "Restaurants", destination: "Delaware"
- "I need a gas station on route to New York" → adjective: null, placeType: "Petrol Pumps", destination: "New York"
- "Looking for a hospital to Boston" → adjective: null, placeType: "Hospital", destination: "Boston"
- "Find cheap hotels on my way to LA" → adjective: "cheap", placeType: "Hotel / Motel", destination: "Los Angeles"
- "Need an airport near San Francisco" → adjective: null, placeType: "Travel Points", destination: "San Francisco"
- "EV charger on route to Seattle" → adjective: null, placeType: "EV Charging Spots", destination: "Seattle"
- "McDonald's on my way to Chicago" → adjective: "McDonald's", placeType: "Restaurants", destination: "Chicago"
- "Italian food to Miami" → adjective: "Italian", placeType: "Restaurants", destination: "Miami"

**User query:** "${input}"

**Respond ONLY with a valid JSON object in this exact format:**
{
  "adjective": "the adjective or null",
  "placeType": "one of the 8 categories exactly as listed",
  "destination": "the corrected destination location name"
}

**If the query is non-sensical, unclear, or doesn't contain a place type and destination, respond with:**
{
  "error": "Could not understand the query. Please provide a clearer request."
}

**Remember:** 
- Use your intelligence to understand intent, not just match patterns
- Map place types to the exact 8 categories listed
- Return null (not "none") for adjective if absent
- Correct all typos and normalize location names`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an intelligent assistant that understands user intent and extracts structured data from natural language. You interpret what users mean, not just what they say. You correct typos, normalize place types to the 8 specified categories, and intelligently extract adjectives. Return null for adjective if none exists. Always respond with valid JSON only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        // Parse JSON response
        try {
            const parsed = JSON.parse(content);
            // Handle case where API returns string "null" instead of actual null
            if (parsed.adjective === 'none' || parsed.adjective === 'null' || parsed.adjective === '') {
                parsed.adjective = null;
            }
            return parsed;
        } catch (parseError) {
            // Try to extract JSON from markdown code blocks if present
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                // Handle case where API returns string "null" instead of actual null
                if (parsed.adjective === 'none' || parsed.adjective === 'null' || parsed.adjective === '') {
                    parsed.adjective = null;
                }
                return parsed;
            }
            throw new Error('Invalid response format from AI');
        }
    } catch (error) {
        console.error('OpenAI API error:', error);
        return { error: error.message || 'Failed to parse input. Please try again.' };
    }
}

// Get current location
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showStatus('Geolocation is not supported by your browser.', 'error');
        return;
    }

    showStatus('Getting your location...', 'loading');

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            // Success callback
            const { latitude, longitude, accuracy } = position.coords;
            const timestamp = new Date(position.timestamp);

            // Update UI
            latitudeEl.textContent = latitude.toFixed(6);
            longitudeEl.textContent = longitude.toFixed(6);
            accuracyEl.textContent = `${Math.round(accuracy)} meters`;
            timestampEl.textContent = timestamp.toLocaleString();

            // Show location info
            locationInfo.classList.remove('hidden');
            const placeDescription = parsedData.adjective 
                ? `${parsedData.adjective} ${parsedData.placeType}` 
                : parsedData.placeType;
            showStatus(`Location found! Ready to search for ${placeDescription} on route to ${parsedData.destination}...`, 'success');

            // Store location
            currentLocation.latitude = latitude;
            currentLocation.longitude = longitude;

            // Display map
            displayMap(latitude, longitude);

            // Save to Supabase
            await saveToSupabase(latitude, longitude);

            // Log for debugging
            console.log('Stored variables:', parsedData);
            console.log('User location:', { latitude, longitude });
        },
        (error) => {
            // Error callback
            let errorMessage = '';

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied by user. Please enable location permissions.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out. Please try again.';
                    break;
                default:
                    errorMessage = 'An unknown error occurred while retrieving location.';
                    break;
            }

            showStatus(errorMessage, 'error');
        },
        options
    );
}

// Show status message
function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status-message ${type}`;
}

// Save data to Supabase
async function saveToSupabase(latitude, longitude) {
    if (!supabase) {
        console.warn('Supabase not configured');
        return;
    }

    try {
        // Prepare data with NULL for missing values
        const dataToInsert = {
            input_LAT: latitude || null,
            input_LONG: longitude || null,
            end_location: parsedData.destination || null,
            type_of_establishment: parsedData.placeType || null,
            adjective: parsedData.adjective || null
        };

        console.log('Attempting to save to Supabase:', dataToInsert);

        // Insert into Supabase
        const { data, error } = await supabase
            .from('userinput')
            .insert([dataToInsert])
            .select();

        if (error) {
            console.error('Error saving to Supabase:', error);
            console.error('Error details:', {
                message: error.message,
                hint: error.hint,
                code: error.code,
                details: error.details
            });
            
            // Provide helpful error messages
            if (error.message === 'Invalid API key') {
                console.error('❌ Invalid API key. Please check your anon key in config.js');
            } else if (error.code === 'PGRST301' || error.message.includes('permission') || error.message.includes('policy')) {
                console.error('❌ Row Level Security (RLS) is blocking the insert.');
                console.error('💡 Solution: Go to Supabase Dashboard → Table Editor → userinput → RLS');
                console.error('   Enable RLS and create a policy that allows INSERT for anon role');
            } else if (error.code === '42P01') {
                console.error('❌ Table "userinput" does not exist. Please create it in Supabase.');
            }
        } else {
            console.log('✅ Data saved to Supabase successfully:', data);
        }
    } catch (error) {
        console.error('Error saving to Supabase:', error);
    }
}

// Display map using Google Maps
function displayMap(latitude, longitude) {
    // Using Google Maps embed (no API key required for basic usage)
    mapEl.innerHTML = `
        <iframe
            width="100%"
            height="100%"
            style="border:0"
            loading="lazy"
            allowfullscreen
            src="https://www.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&output=embed">
        </iframe>
    `;
}
