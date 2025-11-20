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
app.get('/operator', (req, res) => {
	res.sendFile(path.join(process.cwd(), 'public', 'operator', 'operator.html'));
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

// Caller management system
interface Caller {
	id: string;
	ws: any;
	session: any | null;
	status: 'waiting' | 'connected' | 'disconnected';
	connectedAt: Date;
	acceptedAt?: Date;
	phoneNumber?: string;
	name?: string;
}

const callers = new Map<string, Caller>();
let callerIdCounter = 0;

// Generate unique caller ID
const generateCallerId = (): string => {
	callerIdCounter++;
	return `caller_${Date.now()}_${callerIdCounter}`;
}

// Create AI session for a caller
const createAISession = async (caller: Caller) => {
	const session = await ai.live.connect({
		model: model,
		callbacks: {
			onopen: () => {
				console.debug(`AI Session opened for ${caller.id}`);
				caller.ws.send(JSON.stringify({ type: 'status', message: 'Connected to AI' }));
			},
			onerror: (e) => {
				console.debug(`AI Error for ${caller.id}:`, e.message);
				caller.ws.send(JSON.stringify({ type: 'error', message: e.message }));
			},
			onclose: (e) => {
				console.debug(`AI Session closed for ${caller.id}:`, e.reason);
				caller.ws.send(JSON.stringify({ type: 'status', message: 'AI session closed' }));
			},
			onmessage: (message) => {
				// Properly serialize the message object to JSON
				try {
					const msgString = typeof message === 'string' ? message : JSON.stringify(message);
					console.log(`AI Response for ${caller.id}:`, msgString);
					caller.ws.send(msgString);
				} catch (error) {
					console.error(`Error processing AI message for ${caller.id}:`, error);
					caller.ws.send(JSON.stringify({ type: 'error', message: 'Error processing AI response' }));
				}
			}
		},
		config: config
	});
	return session;
}

// Accept a caller and connect them to AI
const acceptCaller = async (callerId: string) => {
	const caller = callers.get(callerId);
	if (!caller) {
		console.error(`Caller ${callerId} not found`);
		return false;
	}

	if (caller.status !== 'waiting') {
		console.error(`Caller ${callerId} is not in waiting status`);
		return false;
	}

	try {
		// Create AI session for the caller
		caller.session = await createAISession(caller);
		caller.status = 'connected';
		caller.acceptedAt = new Date();

		caller.ws.send(JSON.stringify({
			type: 'accepted',
			message: 'Your call has been accepted. You are now connected to AI.'
		}));

		// Send initial greeting prompt to AI to introduce itself
		setTimeout(() => {
			if (caller.session) {
				caller.session.sendRealtimeInput({
					text: "Please introduce yourself to the caller. Say hello and let them know you're ready to assist them with their NexLink services."
				});
			}
		}, 500);

		console.log(`Caller ${callerId} accepted and connected to AI`);
		return true;
	} catch (error) {
		console.error(`Error accepting caller ${callerId}:`, error);
		caller.ws.send(JSON.stringify({
			type: 'error',
			message: 'Failed to connect to AI'
		}));
		return false;
	}
}

// Reject a caller and close their connection
const rejectCaller = (callerId: string) => {
	const caller = callers.get(callerId);
	if (!caller) {
		console.error(`Caller ${callerId} not found`);
		return false;
	}

	if (caller.status !== 'waiting') {
		console.error(`Caller ${callerId} is not in waiting status`);
		return false;
	}

	try {
		// Send rejection message to caller
		caller.ws.send(JSON.stringify({
			type: 'rejected',
			message: 'Your call has been rejected by the operator. Please try again later.'
		}));

		// Close the connection after a brief delay to ensure message is sent
		setTimeout(() => {
			if (caller.ws.readyState === 1) { // 1 = OPEN
				caller.ws.close();
			}
		}, 100);

		caller.status = 'disconnected';
		callers.delete(callerId);

		console.log(`Caller ${callerId} rejected and disconnected`);
		return true;
	} catch (error) {
		console.error(`Error rejecting caller ${callerId}:`, error);
		return false;
	}
}

// Get list of waiting callers
const getWaitingCallers = () => {
	const waiting: any[] = [];
	callers.forEach((caller, id) => {
		if (caller.status === 'waiting') {
			waiting.push({
				id: caller.id,
				phoneNumber: caller.phoneNumber,
				name: caller.name,
				connectedAt: caller.connectedAt
			});
		}
	});
	return waiting;
}

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
	const callerId = generateCallerId();

	// Create caller entry
	const caller: Caller = {
		id: callerId,
		ws: ws,
		session: null,
		status: 'waiting',
		connectedAt: new Date(),
		phoneNumber: req.headers['x-phone-number'] as string,
		name: req.headers['x-caller-name'] as string
	};

	callers.set(callerId, caller);
	console.log(`New caller ${callerId} connected. Status: waiting. Total callers: ${callers.size}`);

	// Send initial status to caller
	ws.send(JSON.stringify({
		type: 'waiting',
		callerId: callerId,
		message: 'You are in the queue. Please wait for an operator to accept your call.'
	}));

// Handle incoming messages from caller
	ws.on('message', async (data) => {
		const caller = callers.get(callerId);
		if (!caller) return;

		// Check if message is a control message (JSON)
		try {
			const parsed = JSON.parse(data.toString());

			// Handle control messages
			if (parsed.type === 'operator_accept' && parsed.targetCallerId) {
				// This would be sent from an operator interface
				await acceptCaller(parsed.targetCallerId);
				return;
			}

			if (parsed.type === 'operator_reject' && parsed.targetCallerId) {
				// This would be sent from an operator interface
				rejectCaller(parsed.targetCallerId);
				return;
			}

			if (parsed.type === 'get_waiting_callers') {
				// Return list of waiting callers (for operator interface)
				ws.send(JSON.stringify({
					type: 'waiting_callers',
					callers: getWaitingCallers()
				}));
				return;
			}
		} catch (e) {
			// Not JSON, assume it's audio data
		}

		// Only forward audio if caller is connected to AI
		if (caller.status === 'connected' && caller.session) {
			const message = data.toString();
			caller.session.sendRealtimeInput({
				audio: {
					data: message,
					mimeType: 'audio/pcm;rate=16000'
				}
			});
		} else {
			// Caller is not yet accepted
			ws.send(JSON.stringify({
				type: 'error',
				message: 'You are not yet connected. Please wait for an operator to accept your call.'
			}));
		}
	});

	// Handle disconnection
	ws.on('close', () => {
		const caller = callers.get(callerId);
		if (caller) {
			if (caller.session) {
				caller.session.close();
			}
			caller.status = 'disconnected';
			callers.delete(callerId);
			console.log(`Caller ${callerId} disconnected. Total callers: ${callers.size}`);
		}
	});

	// Handle errors
	ws.on('error', (error) => {
		console.error(`WebSocket error for ${callerId}:`, error);
	});
});

app.get('/callers/waiting', (req, res) => {
	const waitingCallers = getWaitingCallers();
	res.json(waitingCallers);
});

app.post('/callers/:id/accept', async (req, res) => {
	const callerId = req.params.id;
	const success = await acceptCaller(callerId);
	if (success) {
		res.json({ status: 'accepted' });
	} else {
		res.status(400).json({ status: 'error', message: 'Failed to accept caller' });
	}
});

app.post('/callers/:id/reject', (req, res) => {
	const callerId = req.params.id;
	const success = rejectCaller(callerId);
	if (success) {
		res.json({ status: 'rejected' });
	} else {
		res.status(400).json({ status: 'error', message: 'Failed to reject caller' });
	}
});

server.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});