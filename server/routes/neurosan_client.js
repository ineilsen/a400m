const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Using Axios for cleaner, promise-based requests
const router = express.Router();

/**
 * This module exports a factory function.
 * It takes a configuration object and returns a configured Express router.
 * This pattern allows for dependency injection and makes the route more testable and reusable.
 *
 * 
 * Expects a JSON body with a "message" property:
 * {
 *   "message": "details on left wing status"
 * }
 * 
 * Returns a JSON object with a "response" property:
 * {
 *   "response": "The Left Wing's component, the Aileron Actuator, is in "Warning" status and requires maintenance in 30 days."
 * }
 */



module.exports = function(config) {
    // 1. Extract configuration
    const NEURO = config.neuro;
    if (!NEURO || !NEURO.apiUrl || !NEURO.projectName) {
        throw new Error('Neuro-SAN configuration is missing or incomplete in the main server config.');
    }

    // 2. Set up structured logging (similar to the example)
    const aiLogFile = path.join(config.logsDir, 'ai_chat.log');
    try {
        if (!fs.existsSync(config.logsDir)) {
            fs.mkdirSync(config.logsDir, { recursive: true });
        }
    } catch (e) {
        console.error("Could not create logs directory:", e);
    }

    function appendAiLog(entry) {
        try {
            const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
            fs.appendFile(aiLogFile, line, (err) => {
                if (err) console.error("Failed to write to AI log file:", err);
            });
        } catch (e) { /* ignore logging errors */ }
    }

    // 3. Intent Classifier (placeholder, to be customized)
    // This function mimics the example's pattern of trying to handle simple queries locally
    // before calling the expensive AI service. You should customize this with your own logic.
    function classifyIntent(text) {
        const t = String(text || '').toLowerCase();
        let score = 0;
        
        // Example: Check for simple greetings
        if (/\b(hello|hi|hey)\b/.test(t)) score += 3;

        const confidence = Math.min(1, score / 3);
        const intent = confidence > 0.5 ? 'greeting' : 'other';
        return { intent, confidence };
    }

    // 4. The main route handler
    router.post('/', async (req, res) => {
        try {
            const { message, history } = req.body || {};
            if (!message || typeof message !== 'string') {
                return res.status(400).json({ error: 'Missing or invalid "message" in request body' });
            }

            // Log incoming request
            appendAiLog({ event: 'request', message: String(message).slice(0, 512) });
            console.log(`[AI] request received: "${String(message).slice(0, 120).replace(/\n/g, ' ')}"`);

            // --- LOCAL SHORT-CIRCUIT PATH ---
            // Decide if we can answer locally without calling the AI
            const cls = classifyIntent(message);
            appendAiLog({ event: 'classification', classification: cls });
            console.log(`[AI] classification intent=${cls.intent} confidence=${cls.confidence.toFixed(2)}`);

            if (cls.intent === 'greeting' && cls.confidence >= 0.7) {
                const reply = "Hello! I am your AI for BI assistant. How can I help you today?";
                appendAiLog({ event: 'local-reply', message, reply });
                console.log('[AI] Responded with a local, short-circuited reply.');
                // Note the 'reply' key to match the example's response format
                return res.json({ reply });
            }

            // --- EXTERNAL AI API PATH ---
            console.log('[AI] Forwarding request to Neuro-SAN API...');
            
            // Prepare messages payload, including conversation history
            const messages = [];
            if (Array.isArray(history)) {
                history.forEach(h => {
                    if (h && h.role && h.content) messages.push({ role: h.role, content: h.content });
                });
            }
            messages.push({ role: 'user', content: message });
            
            const payload = {
                project: NEURO.projectName,
                session: 'default-session-id', // TODO: Manage session ID per user
                messages: messages
            };

            // Make the POST request to the Neuro-SAN API using Axios
            const apiResponse = await axios.post(NEURO.apiUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000 // 30-second timeout
            });

            const reply = apiResponse.data.choices[0]?.message?.content;

            if (!reply) {
                throw new Error('Invalid response structure from AI API.');
            }

            appendAiLog({ event: 'api-reply', status: apiResponse.status, reply: String(reply).slice(0, 2000) });
            console.log(`[AI] API reply received, length=${String(reply).length}`);
            
            return res.json({ reply });

        } catch (error) {
            console.error('[AI] An error occurred in the chat route:', error.message);
            
            // Detailed error handling, similar to the logic in my previous response
            if (error.response) { // The request was made and the server responded with a status code > 2xx
                appendAiLog({ event: 'api-error', status: error.response.status, detail: error.response.data });
                return res.status(502).json({ error: 'ai-service-error', detail: error.response.data });
            } else if (error.request) { // The request was made but no response was received
                appendAiLog({ event: 'network-error', detail: 'No response received from AI service.' });
                return res.status(503).json({ error: 'ai-service-unavailable', detail: 'The AI service did not respond.' });
            } else { // Something else happened
                appendAiLog({ event: 'internal-error', detail: error.stack });
                return res.status(500).json({ error: 'internal-server-error', detail: String(error) });
            }
        }
    });

    return router;
};