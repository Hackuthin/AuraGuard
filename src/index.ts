import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI, Modality } from '@google/genai';

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(cors({
	origin: '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type']
}));

// Serve static files from public directory
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
	res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});
app.get('/phone', (req, res) => {
	res.sendFile(path.join(process.cwd(), 'public', 'phone', 'phone.html'));
});

const model = 'gemini-2.5-flash-native-audio-preview-09-2025';
const apiKey = process.env.GEMINI_API_KEY;
const config = {
	systemInstruction: fs.readFileSync(path.join(process.cwd(), 'prompts', 'process.md'), 'utf-8'),
	responseModalities: [Modality.AUDIO]
};
const ai = new GoogleGenAI({
	apiKey: apiKey || ''
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
	const session = await ai.live.connect({
		model: model,
		callbacks: {
			onopen: () => {
				console.debug('Opened');
				ws.send(JSON.stringify({ type: 'status', message: 'Connected to AI' }));
			},
			onerror: (e) => {
				console.debug('Error:', e.message);
				ws.send(JSON.stringify({ type: 'error', message: e.message }));
			},
			onclose: (e) => {
				console.debug('Close:', e.reason);
				ws.send(JSON.stringify({ type: 'status', message: 'AI session closed' }));
			},
			onmessage: (message) => {
				// Properly serialize the message object to JSON
				try {
					const msgString = typeof message === 'string' ? message : JSON.stringify(message);
					console.log('AI Response:', msgString);
					ws.send(msgString);
				} catch (error) {
					console.error('Error processing AI message:', error);
					ws.send(JSON.stringify({ type: 'error', message: 'Error processing AI response' }));
				}
			}
		},
		config: config
	});

	ws.on('close', () => session.close());

	ws.on('message', async (data) => {
		// Convert the incoming data to string (base64)
		const message = data.toString();

		// Send the message to the AI session with proper MIME type
		session.sendRealtimeInput({
			audio: {
				data: message,
				mimeType: 'audio/pcm;rate=16000'
			}
		});
	});
});

server.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});