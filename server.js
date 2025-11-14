import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Set production mode if PORT is set (Render sets this automatically)
if (process.env.PORT && !process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
}

// Debug: Check if API keys are loaded (don't log the actual keys)
if (process.env.OPENAI_API_KEY) {
    console.log('✅ OpenAI API key loaded successfully');
} else {
    console.error('❌ OpenAI API key not found in environment variables');
    console.error('   Make sure .env file exists and contains OPENAI_API_KEY');
}

if (process.env.GOOGLE_MAPS_API_KEY) {
    console.log('✅ Google Maps API key loaded successfully');
} else {
    console.error('❌ Google Maps API key not found in environment variables');
    console.error('   Make sure .env file exists and contains GOOGLE_MAPS_API_KEY');
}

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Allow all origins in dev, set specific in production
    credentials: true
}));
app.use(express.json());

// Parse user input using OpenAI
app.post('/api/parse-input', async (req, res) => {
    try {
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ error: 'Input is required' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
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
            let parsed = JSON.parse(content);
            // Handle case where API returns string "null" instead of actual null
            if (parsed.adjective === 'none' || parsed.adjective === 'null' || parsed.adjective === '') {
                parsed.adjective = null;
            }
            return res.json(parsed);
        } catch (parseError) {
            // Try to extract JSON from markdown code blocks if present
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
                let parsed = JSON.parse(jsonMatch[1]);
                if (parsed.adjective === 'none' || parsed.adjective === 'null' || parsed.adjective === '') {
                    parsed.adjective = null;
                }
                return res.json(parsed);
            }
            throw new Error('Invalid response format from AI');
        }
    } catch (error) {
        console.error('Error parsing input:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to parse input. Please try again.' 
        });
    }
});

// Geocode address to get coordinates
app.post('/api/geocode', async (req, res) => {
    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
        );

        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return res.json({
                lat: location.lat,
                lng: location.lng
            });
        }

        return res.status(404).json({ error: 'Address not found' });
    } catch (error) {
        console.error('Error geocoding address:', error);
        return res.status(500).json({ error: 'Failed to geocode address' });
    }
});

// Search places using Google Places API
app.post('/api/search-places', async (req, res) => {
    try {
        const { lat, lng, query, endLat, endLng } = req.body;

        if (!lat || !lng || !query) {
            return res.status(400).json({ error: 'Latitude, longitude, and query are required' });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }

        let url = '';
        
        if (endLat && endLng) {
            // Search along route - use midpoint
            const midLat = (lat + endLat) / 2;
            const midLng = (lng + endLng) / 2;
            const radius = calculateDistance(lat, lng, endLat, endLng) / 2;
            
            url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${midLat},${midLng}&radius=${Math.min(radius * 1000, 50000)}&key=${apiKey}`;
        } else {
            // Search nearby
            url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=10000&key=${apiKey}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK') {
            let results = data.results;
            
            // Filter places along route if end location exists
            if (endLat && endLng) {
                results = results.filter(place => {
                    return isPointAlongRoute(
                        lat, lng,
                        endLat, endLng,
                        place.geometry.location.lat, place.geometry.location.lng
                    );
                });
            }
            
            // Include photo references in results
            const resultsWithPhotos = results.slice(0, 20).map(place => ({
                ...place,
                photo_reference: place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null
            }));
            
            return res.json(resultsWithPhotos);
        }

        return res.json([]);
    } catch (error) {
        console.error('Error searching places:', error);
        return res.status(500).json({ error: 'Failed to search places' });
    }
});

// Calculate time to location using Directions API
app.post('/api/calculate-time', async (req, res) => {
    try {
        const { startLat, startLng, endLat, endLng } = req.body;

        if (!startLat || !startLng || !endLat || !endLng) {
            return res.status(400).json({ error: 'All coordinates are required' });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&key=${apiKey}`
        );

        const data = await response.json();

        if (data.status === 'OK' && data.routes.length > 0) {
            const duration = data.routes[0].legs[0].duration.value; // Duration in seconds
            return res.json({ duration });
        }

        return res.status(404).json({ error: 'Route not found' });
    } catch (error) {
        console.error('Error calculating time:', error);
        return res.status(500).json({ error: 'Failed to calculate time' });
    }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Check if a point is along the route
function isPointAlongRoute(startLat, startLng, endLat, endLng, pointLat, pointLng) {
    const routeDistance = calculateDistance(startLat, startLng, endLat, endLng);
    const distToStart = calculateDistance(startLat, startLng, pointLat, pointLng);
    const distToEnd = calculateDistance(endLat, endLng, pointLat, pointLng);
    
    return (distToStart + distToEnd) <= (routeDistance * 1.5); // 50% tolerance
}

// Get place photo
app.get('/api/place-photo', async (req, res) => {
    try {
        const { photo_reference, maxwidth = 400 } = req.query;

        if (!photo_reference) {
            return res.status(400).json({ error: 'Photo reference is required' });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }

        // Redirect to Google Places Photo API
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${photo_reference}&key=${apiKey}`;
        
        // Fetch the image and proxy it to avoid CORS issues
        const imageResponse = await fetch(photoUrl);
        
        if (!imageResponse.ok) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Get the image buffer
        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Set headers and send image
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.send(Buffer.from(imageBuffer));
    } catch (error) {
        console.error('Error fetching place photo:', error);
        return res.status(500).json({ error: 'Failed to fetch photo' });
    }
});

// Generate summary of top restaurants for voice narration
app.post('/api/generate-summary', async (req, res) => {
    try {
        const { restaurants } = req.body;

        if (!restaurants || !Array.isArray(restaurants) || restaurants.length === 0) {
            return res.status(400).json({ error: 'Restaurants array is required' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Build restaurant details for prompt
        const restaurantDetails = restaurants.map((r, index) => {
            const name = r.name || 'Unknown';
            const rating = r.rating ? r.rating.toFixed(1) : 'No rating';
            const timeMinutes = r.timeToLocation ? Math.round(r.timeToLocation / 60) : 'N/A';
            return `${index + 1}. ${name} - Rating: ${rating} stars, ${timeMinutes} minutes away`;
        }).join('\n');

        const prompt = `Create an extremely brief voice summary of these top 3 restaurants. 
For each restaurant, mention ONLY: name, rating, and time. Nothing else.
Keep it as short as possible - just the essential facts.

Restaurants:
${restaurantDetails}

Format exactly like this: "First, [name], [rating] stars, [time] minutes. Second, [name], [rating] stars, [time] minutes. Third, [name], [rating] stars, [time] minutes."

No extra words. Just name, rating, time.`;

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
                        content: 'You are a helpful assistant that creates extremely brief voice summaries. Include ONLY name, rating, and time. No extra words or descriptions. Be as concise as possible.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const summary = data.choices[0].message.content.trim();
        
        return res.json({ summary });
    } catch (error) {
        console.error('Error generating summary:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to generate summary' 
        });
    }
});

// Identify which restaurant user selected from voice input
app.post('/api/identify-restaurant', async (req, res) => {
    try {
        const { userInput, restaurants } = req.body;

        if (!userInput || !restaurants || !Array.isArray(restaurants) || restaurants.length === 0) {
            return res.status(400).json({ error: 'User input and restaurants array are required' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Build restaurant list for prompt
        const restaurantList = restaurants.map(r => 
            `${r.index}. ${r.name}`
        ).join('\n');

        const prompt = `The user said: "${userInput}"

They are referring to one of these restaurants:
${restaurantList}

The user might say:
- The restaurant name (full or partial, e.g., "Scalessa's", "Scalessa", "the Italian place", "Italian")
- A position reference (e.g., "the first one", "first", "number 2", "number two", "second", "the third restaurant", "2nd one", "2nd", "third", "3rd")
- An ordinal (e.g., "first", "second", "third", "1st", "2nd", "3rd", "one", "two", "three")
- Just a number (e.g., "1", "2", "3")

IMPORTANT: Be very lenient in matching. If the user says anything that could reasonably refer to one of these restaurants, match it.
- If they say a number (1, 2, 3) or word number (one, two, three), match to that index
- If they say any part of a restaurant name, match to that restaurant
- If they say "first", "second", "third" or any variation, match to that position
- Only return null if it's completely unclear or doesn't match anything

Identify which restaurant (by index 1, 2, or 3) the user is referring to. 
Return the index number (1, 2, or 3) - NOT null unless it's truly impossible to determine.

Respond ONLY with a JSON object in this exact format:
{
  "selectedIndex": 1
}

Do NOT return null unless absolutely necessary. Be generous in matching.`;

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
                        content: 'You are a helpful assistant that identifies which restaurant a user is referring to from their natural language input. You understand position references (first, second, third), ordinals (1st, 2nd, 3rd), numbers (1, 2, 3), word numbers (one, two, three), and partial name matches. Be very lenient and generous in matching - if there is ANY reasonable way to match the input to a restaurant, do so. Only return null if it is completely impossible to determine. Always respond with valid JSON only with a selectedIndex field that is either 1, 2, or 3 (as a number, not a string).'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 100
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        console.log('OpenAI response content:', content);
        
        // Parse JSON response
        let parsed = null;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            // Try to extract JSON from markdown code blocks if present
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[1]);
            } else {
                // Try to find just the number in the response
                const numberMatch = content.match(/\b([123])\b/);
                if (numberMatch) {
                    parsed = { selectedIndex: parseInt(numberMatch[1]) };
                } else {
                    throw new Error('Invalid response format from AI');
                }
            }
        }
        
        // Ensure selectedIndex is a number
        let selectedIndex = parsed.selectedIndex;
        if (typeof selectedIndex === 'string') {
            selectedIndex = parseInt(selectedIndex);
        }
        
        // If null or invalid, try to extract from text
        if (!selectedIndex || selectedIndex < 1 || selectedIndex > 3) {
            // Look for number words or ordinals in the content
            const lowerContent = content.toLowerCase();
            if (lowerContent.includes('first') || lowerContent.includes('1st') || lowerContent.includes('one')) {
                selectedIndex = 1;
            } else if (lowerContent.includes('second') || lowerContent.includes('2nd') || lowerContent.includes('two')) {
                selectedIndex = 2;
            } else if (lowerContent.includes('third') || lowerContent.includes('3rd') || lowerContent.includes('three')) {
                selectedIndex = 3;
            }
        }
        
        console.log('Final selectedIndex:', selectedIndex);
        
        return res.json({ selectedIndex: selectedIndex || null });
    } catch (error) {
        console.error('Error identifying restaurant:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to identify restaurant' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Serve static files in production (after building frontend)
if (process.env.NODE_ENV === 'production') {
    const distPath = join(__dirname, 'dist');
    app.use(express.static(distPath));
    
    // Also serve config.js from root (for runtime loading)
    app.get('/config.js', (req, res) => {
        const configPath = join(__dirname, 'config.js');
        res.type('application/javascript');
        res.sendFile(configPath);
    });
    
    // Serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(join(distPath, 'index.html'));
    });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/parse-input`);
    if (process.env.NODE_ENV === 'production') {
        console.log(`🌐 Serving frontend from /dist`);
    }
});

