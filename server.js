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

// Debug: Check if API key is loaded (don't log the actual key)
if (process.env.OPENAI_API_KEY) {
    console.log('✅ OpenAI API key loaded successfully');
} else {
    console.error('❌ OpenAI API key not found in environment variables');
    console.error('   Make sure .env file exists and contains OPENAI_API_KEY');
}

// Middleware
app.use(cors());
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/parse-input`);
});

