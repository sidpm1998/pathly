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
const chatMessages = document.getElementById('chatMessages');
const textInput = document.getElementById('textInput');
const voiceBtn = document.getElementById('voiceBtn');
const submitBtn = document.getElementById('submitBtn');
const voiceStatus = document.getElementById('voiceStatus');
const status = document.getElementById('status');
// Removed unused DOM element references - now using chat messages for most UI

// Voice recognition state
let recognition = null;
let isListening = false;
let autoProcessTimeout = null;
let isVoiceInput = false; // Track if current input was via voice
let isWaitingForSelection = false; // Track if waiting for user to select a restaurant
let top3PlacesForSelection = []; // Store top 3 places for selection

// Check API keys (only Supabase needed in frontend now)
function checkAPIKeys() {
    // Only need to check Supabase - OpenAI is handled by backend
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined' ||
        SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE') {
        console.warn('Supabase not configured');
    }
    return true; // Always return true - backend handles OpenAI
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
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            textInput.value = transcript;
            isListening = false;
            voiceStatus.classList.add('hidden');
            voiceBtn.classList.remove('recording');
            
            // Mark as voice input
            isVoiceInput = true;
            
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
            addMessage(errorMessage, false);
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
        addMessage('Speech recognition not supported. Please use text input.', false);
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
                addMessage('Error starting speech recognition. Please try again.', false);
            }
        }
    }
});

// Submit button click
submitBtn.addEventListener('click', () => {
    const input = textInput.value.trim();
    if (!input) {
        addMessage('Please enter your search query.', false);
        return;
    }
    // Mark as text input (not voice)
    isVoiceInput = false;
    processInput(input);
});

// Enter key on text input
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitBtn.click();
    }
});

// Add message to chat
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    // Preserve line breaks
    contentDiv.style.whiteSpace = 'pre-wrap';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

// Process user input - parse using OpenAI
async function processInput(input) {
    // Clear any pending auto-process timeout
    if (autoProcessTimeout) {
        clearTimeout(autoProcessTimeout);
        autoProcessTimeout = null;
    }
    
    // Add user message to chat
    addMessage(input, true);
    
    // Clear input
    textInput.value = '';
    
    // Reset voice input flag if this is a text input
    // (voice input sets it to true before calling this function)
    if (!isVoiceInput) {
        isVoiceInput = false;
    }
    
    try {
        // Parse the input using OpenAI
        const parsed = await parseInputWithOpenAI(input);
        
        if (!parsed || parsed.error) {
            addMessage(parsed?.error || 'Could not understand your request. Please try again with a clearer query.', false);
            isVoiceInput = false; // Reset on error
            return;
        }

        // Store parsed variables
        parsedData.adjective = parsed.adjective === 'none' || parsed.adjective === null ? null : parsed.adjective;
        parsedData.placeType = parsed.placeType;
        parsedData.destination = parsed.destination;

        // Now get location (no verbose messages)
        getCurrentLocation();
    } catch (error) {
        console.error('Error processing input:', error);
        addMessage('Error processing your request. Please try again.', false);
        isVoiceInput = false; // Reset on error
    }
}

// Parse input using backend API (which uses OpenAI)
async function parseInputWithOpenAI(input) {
    // Backend API endpoint - change this to your production URL when deploying
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/parse-input`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ input })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const parsed = await response.json();
        
        // Handle case where API returns string "null" instead of actual null
        if (parsed.adjective === 'none' || parsed.adjective === 'null' || parsed.adjective === '') {
            parsed.adjective = null;
        }
        
        return parsed;
    } catch (error) {
        console.error('Backend API error:', error);
        return { error: error.message || 'Failed to parse input. Please try again.' };
    }
}

// Get current location
function getCurrentLocation() {
    if (!navigator.geolocation) {
        addMessage('Geolocation is not supported by your browser.', false);
        return;
    }

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

            // Location data will be shown in chat message

            // Store location
            currentLocation.latitude = latitude;
            currentLocation.longitude = longitude;

            // Save to Supabase
            await saveToSupabase(latitude, longitude);

            // Fetch latest entry and search for establishments (no verbose messages)
            await searchEstablishments();

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

            addMessage(errorMessage, false);
        },
        options
    );
}

// Show status message (kept for backward compatibility, but using chat messages now)
function showStatus(message, type = 'info') {
    if (status) {
        status.textContent = message;
        status.className = `status-message ${type}`;
        status.classList.remove('hidden');
    }
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

// Fetch latest entry from Supabase
async function fetchLatestEntry() {
    if (!supabase) {
        console.warn('Supabase not configured');
        return null;
    }

    try {
        // Try to order by created_at, if that column doesn't exist, order by id
        let query = supabase
            .from('userinput')
            .select('*')
            .limit(1);
        
        // Try ordering by created_at first, fallback to id
        const { data, error } = await query.order('id', { ascending: false });

        if (error) {
            // Try without ordering
            const { data: data2, error: error2 } = await supabase
                .from('userinput')
                .select('*')
                .limit(1);
            
            if (error2) {
                console.error('Error fetching latest entry:', error2);
                return null;
            }
            
            return data2 && data2.length > 0 ? data2[0] : null;
        }

        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error fetching latest entry:', error);
        return null;
    }
}

// Geocode address to get coordinates (via backend)
async function geocodeAddress(address) {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/geocode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
}

// Search for establishments along route
async function searchEstablishments() {
    // Fetch latest entry from Supabase
    const latestEntry = await fetchLatestEntry();
    
    if (!latestEntry) {
        addMessage('Could not fetch search criteria. Please try again.', false);
        return;
    }

    const { adjective, type_of_establishment, input_LAT, input_LONG, end_location } = latestEntry;

    if (!input_LAT || !input_LONG || !type_of_establishment) {
        addMessage('Missing required information. Please try again.', false);
        return;
    }

    let endLocationCoords = null;
    if (end_location) {
        endLocationCoords = await geocodeAddress(end_location);
    }

    // Build search query
    let query = '';
    if (adjective && adjective !== 'none' && adjective !== null) {
        query += `${adjective} `;
    }
    query += type_of_establishment;

    // Search for places
    const places = await searchPlacesNearby(input_LAT, input_LONG, query, endLocationCoords);

    if (places.length === 0) {
        addMessage('No establishments found. Please try a different search.', false);
        return;
    }

    // Calculate time to location for each place and sort
    const placesWithTime = await Promise.all(
        places.map(async (place) => {
            const timeToLocation = await calculateTimeToLocation(
                input_LAT,
                input_LONG,
                place.geometry.location.lat,
                place.geometry.location.lng
            );
            return {
                ...place,
                timeToLocation: timeToLocation || Infinity
            };
        })
    );

    // Sort by time to location (nearest first)
    placesWithTime.sort((a, b) => a.timeToLocation - b.timeToLocation);

    // Display results as cards (no verbose message)
    displayResults(placesWithTime, input_LAT, input_LONG, endLocationCoords);
}

// Search places using Google Places API (via backend)
async function searchPlacesNearby(lat, lng, query, endLocationCoords = null) {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    try {
        const body = {
            lat,
            lng,
            query
        };
        
        if (endLocationCoords) {
            body.endLat = endLocationCoords.lat;
            body.endLng = endLocationCoords.lng;
        }

        const response = await fetch(`${API_BASE_URL}/api/search-places`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
}

// Calculate time to location using Directions API (via backend)
async function calculateTimeToLocation(startLat, startLng, endLat, endLng) {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/calculate-time`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ startLat, startLng, endLat, endLng })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.duration || null;
    } catch (error) {
        console.error('Error calculating time:', error);
        return null;
    }
}

// Display results as cards
async function displayResults(places, startLat, startLng, endLocationCoords) {
    // Remove previous results message if exists
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.parentElement.remove();
    }

    // Create results container (no verbose message)
    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'resultsContainer';
    resultsDiv.className = 'results-container';
    resultsDiv.style.display = 'flex';
    resultsDiv.style.flexDirection = 'column';
    resultsDiv.style.gap = '12px';

    // Create cards for each place (top 5)
    const topPlaces = places.slice(0, 5);
    topPlaces.forEach((place, index) => {
        const card = createPlaceCard(place, index + 1, startLat, startLng, endLocationCoords);
        resultsDiv.appendChild(card);
    });

    // Add results directly to chat
    const resultsMsg = addMessage('', false);
    resultsMsg.querySelector('.message-content').appendChild(resultsDiv);

    // If voice input was used, generate and narrate summary
    if (isVoiceInput && topPlaces.length >= 3) {
        const top3 = topPlaces.slice(0, 3);
        top3PlacesForSelection = top3; // Store for selection
        await narrateResults(top3, startLat, startLng, endLocationCoords);
    } else {
        isVoiceInput = false; // Reset if not narrating
        top3PlacesForSelection = []; // Clear selection data
    }
}

// Create a card for a place
function createPlaceCard(place, rank, startLat, startLng, endLocationCoords) {
    const card = document.createElement('div');
    card.className = 'place-card';

    const name = place.name || 'Unknown';
    const address = place.formatted_address || place.vicinity || 'Address not available';
    const rating = place.rating ? `${place.rating} ⭐` : 'No rating';
    const timeMinutes = place.timeToLocation ? Math.round(place.timeToLocation / 60) : 'N/A';
    const placeLat = place.geometry.location.lat;
    const placeLng = place.geometry.location.lng;
    const photoReference = place.photo_reference;
    
    // Build photo URL if available
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const photoUrl = photoReference 
        ? `${API_BASE_URL}/api/place-photo?photo_reference=${photoReference}&maxwidth=400`
        : null;

    card.innerHTML = `
        ${photoUrl ? `
        <div class="place-card-image">
            <img src="${photoUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'">
        </div>
        ` : ''}
        <div class="place-card-content">
            <div class="place-card-header">
                <span class="place-rank">#${rank}</span>
                <h3 class="place-name">${name}</h3>
            </div>
            <div class="place-card-body">
                <div class="place-detail">
                    <span class="place-label">📍 Address:</span>
                    <span class="place-value">${address}</span>
                </div>
                <div class="place-detail">
                    <span class="place-label">⏱️ Time to location:</span>
                    <span class="place-value">${timeMinutes} ${timeMinutes !== 'N/A' ? 'minutes' : ''}</span>
                </div>
                <div class="place-detail">
                    <span class="place-label">⭐ Rating:</span>
                    <span class="place-value">${rating}</span>
                </div>
            </div>
            <div class="place-card-footer">
                <button class="btn-directions" data-start-lat="${startLat}" data-start-lng="${startLng}" 
                        data-place-lat="${placeLat}" data-place-lng="${placeLng}" 
                        data-end-lat="${endLocationCoords ? endLocationCoords.lat : ''}" 
                        data-end-lng="${endLocationCoords ? endLocationCoords.lng : ''}">
                    Get Directions
                </button>
            </div>
        </div>
    `;

    // Add click handler for directions button
    const directionsBtn = card.querySelector('.btn-directions');
    directionsBtn.addEventListener('click', () => {
        openGoogleMapsDirections(
            startLat,
            startLng,
            placeLat,
            placeLng,
            endLocationCoords
        );
    });

    return card;
}

// Generate and narrate summary of top restaurants
async function narrateResults(top3Places, startLat, startLng, endLocationCoords) {
    try {
        // Prepare restaurant data for summary
        const restaurants = top3Places.map(place => ({
            name: place.name || 'Unknown',
            rating: place.rating || null,
            timeToLocation: place.timeToLocation || null
        }));

        // Generate summary via backend
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/api/generate-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ restaurants })
        });

        if (!response.ok) {
            console.error('Failed to generate summary');
            return;
        }

        const data = await response.json();
        const summary = data.summary;

        if (summary) {
            // Use Web Speech API for text-to-speech
            await speakText(summary);
            
            // After summary, prompt for selection
            await speakText("Which one would you like to go to?");
            
            // Wait a moment, then start listening for selection
            setTimeout(() => {
                startListeningForSelection(startLat, startLng, endLocationCoords);
            }, 1000);
        }
    } catch (error) {
        console.error('Error narrating results:', error);
    }
}

// Speak text using Web Speech API (returns a promise)
function speakText(text) {
    return new Promise((resolve, reject) => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 1.0; // Normal speed
            utterance.pitch = 1.0; // Normal pitch
            utterance.volume = 1.0; // Full volume

            // Try to use a good voice
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.lang.startsWith('en') && 
                (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Enhanced'))
            ) || voices.find(voice => voice.lang.startsWith('en-US')) || voices[0];
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            // Handle completion
            utterance.onend = () => resolve();
            utterance.onerror = (error) => reject(error);

            // Load voices if not already loaded
            if (voices.length === 0) {
                window.speechSynthesis.onvoiceschanged = () => {
                    const updatedVoices = window.speechSynthesis.getVoices();
                    const voice = updatedVoices.find(v => 
                        v.lang.startsWith('en') && 
                        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Enhanced'))
                    ) || updatedVoices.find(v => v.lang.startsWith('en-US')) || updatedVoices[0];
                    if (voice) {
                        utterance.voice = voice;
                    }
                    window.speechSynthesis.speak(utterance);
                };
            } else {
                window.speechSynthesis.speak(utterance);
            }
        } else {
            console.warn('Speech synthesis not supported in this browser');
            reject(new Error('Speech synthesis not supported'));
        }
    });
}

// Start listening for user's restaurant selection
function startListeningForSelection(startLat, startLng, endLocationCoords) {
    if (!recognition) {
        console.error('Speech recognition not available');
        return;
    }

    isWaitingForSelection = true;
    voiceStatus.classList.remove('hidden');
    voiceBtn.classList.add('recording');

    // Show clear UI indicator in chat
    const listeningMsg = addMessage('🎤 Listening for your selection... Say the restaurant name or number (e.g., "first one", "number 2", or the restaurant name).', false);
    listeningMsg.classList.add('listening-indicator');

    // Set up one-time recognition for selection
    const selectionRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    selectionRecognition.continuous = false;
    selectionRecognition.interimResults = false;
    selectionRecognition.lang = 'en-US';

    let selectionTimeout = null;

    selectionRecognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.trim();
        console.log('User selection:', transcript);

        // Clear timeout
        if (selectionTimeout) {
            clearTimeout(selectionTimeout);
            selectionTimeout = null;
        }

        isWaitingForSelection = false;
        voiceStatus.classList.add('hidden');
        voiceBtn.classList.remove('recording');
        
        // Remove listening indicator
        if (listeningMsg && listeningMsg.parentElement) {
            listeningMsg.remove();
        }

        // Show processing message
        const processingMsg = addMessage('Processing your selection...', false);

        // Use GPT to identify which restaurant the user selected
        const selectedPlace = await identifySelectedRestaurant(transcript, top3PlacesForSelection);

        // Remove processing message
        if (processingMsg && processingMsg.parentElement) {
            processingMsg.remove();
        }

        if (selectedPlace) {
            // Show confirmation in chat
            addMessage(`Selected: ${selectedPlace.name}`, true);
            
            // Automatically open Google Maps with directions
            openGoogleMapsDirections(
                startLat,
                startLng,
                selectedPlace.geometry.location.lat,
                selectedPlace.geometry.location.lng,
                endLocationCoords
            );
            
            // Confirm selection via voice
            await speakText(`Opening directions to ${selectedPlace.name}`);
            
            // Reset flags
            isVoiceInput = false;
            top3PlacesForSelection = [];
        } else {
            // Could not identify selection
            addMessage("I couldn't understand which restaurant you selected. Please try again.", false);
            await speakText("I couldn't understand which restaurant you selected. Please try again.");
            
            // Remove listening indicator if still there
            if (listeningMsg && listeningMsg.parentElement) {
                listeningMsg.remove();
            }
            
            // Restart listening after a delay
            setTimeout(() => {
                startListeningForSelection(startLat, startLng, endLocationCoords);
            }, 2000);
        }
    };

    selectionRecognition.onerror = (event) => {
        console.error('Selection recognition error:', event.error);
        
        // Clear timeout
        if (selectionTimeout) {
            clearTimeout(selectionTimeout);
            selectionTimeout = null;
        }
        
        // Don't stop on 'no-speech' errors - keep listening
        if (event.error === 'no-speech') {
            return; // Continue listening
        }
        
        isWaitingForSelection = false;
        voiceStatus.classList.add('hidden');
        voiceBtn.classList.remove('recording');
        
        // Remove listening indicator
        if (listeningMsg && listeningMsg.parentElement) {
            listeningMsg.remove();
        }
        
        // On error (except no-speech), try again after a delay
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
            setTimeout(() => {
                startListeningForSelection(startLat, startLng, endLocationCoords);
            }, 2000);
        }
    };

    selectionRecognition.onend = () => {
        // If recognition ended but we're still waiting, restart it
        if (isWaitingForSelection) {
            setTimeout(() => {
                if (isWaitingForSelection) {
                    try {
                        selectionRecognition.start();
                    } catch (error) {
                        console.error('Error restarting recognition:', error);
                    }
                }
            }, 500);
        }
    };

    // Start listening with a longer timeout (30 seconds)
    try {
        selectionRecognition.start();
        
        // Timeout after 30 seconds (increased from 10)
        selectionTimeout = setTimeout(() => {
            if (isWaitingForSelection) {
                selectionRecognition.stop();
                isWaitingForSelection = false;
                voiceStatus.classList.add('hidden');
                voiceBtn.classList.remove('recording');
                
                // Remove listening indicator
                if (listeningMsg && listeningMsg.parentElement) {
                    listeningMsg.remove();
                }
                
                // Show timeout message
                addMessage('Listening timeout. You can click the microphone button to try again.', false);
                
                top3PlacesForSelection = [];
                isVoiceInput = false;
            }
        }, 30000); // 30 seconds
    } catch (error) {
        console.error('Error starting selection recognition:', error);
        isWaitingForSelection = false;
        voiceStatus.classList.add('hidden');
        voiceBtn.classList.remove('recording');
        
        // Remove listening indicator
        if (listeningMsg && listeningMsg.parentElement) {
            listeningMsg.remove();
        }
    }
}

// Use GPT to identify which restaurant the user selected
async function identifySelectedRestaurant(userInput, top3Places) {
    if (!top3Places || top3Places.length === 0) {
        console.error('No restaurants provided for selection');
        return null;
    }

    try {
        // Prepare restaurant list for GPT
        const restaurants = top3Places.map((place, index) => ({
            index: index + 1,
            name: place.name || 'Unknown',
            fullData: place // Keep full data for returning
        }));

        console.log('Identifying restaurant from input:', userInput);
        console.log('Available restaurants:', restaurants.map(r => `${r.index}. ${r.name}`));

        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/api/identify-restaurant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userInput,
                restaurants: restaurants.map(r => ({ index: r.index, name: r.name }))
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to identify restaurant - API error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        console.log('GPT response:', data);
        
        const selectedIndex = data.selectedIndex;

        // Handle both number and string indices
        const indexNum = typeof selectedIndex === 'string' ? parseInt(selectedIndex) : selectedIndex;

        if (indexNum && indexNum >= 1 && indexNum <= top3Places.length) {
            console.log('Selected restaurant:', top3Places[indexNum - 1].name);
            return top3Places[indexNum - 1];
        }

        console.warn('Invalid selectedIndex:', selectedIndex, 'Expected 1-', top3Places.length);
        return null;
    } catch (error) {
        console.error('Error identifying restaurant:', error);
        return null;
    }
}

// Open Google Maps with directions
function openGoogleMapsDirections(startLat, startLng, placeLat, placeLng, endLocationCoords) {
    let url = '';

    if (endLocationCoords) {
        // Route: Start -> Place (waypoint) -> End
        url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&waypoints=${placeLat},${placeLng}&destination=${endLocationCoords.lat},${endLocationCoords.lng}&travelmode=driving`;
    } else {
        // Route: Start -> Place (destination)
        url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${placeLat},${placeLng}&travelmode=driving`;
    }

    window.open(url, '_blank');
}

// Display map using Google Maps
function displayMap(latitude, longitude, mapElement = null) {
    // Use provided element or find by ID
    const mapEl = mapElement || document.getElementById('map');
    if (mapEl) {
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
}
