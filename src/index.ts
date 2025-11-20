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
	res.sendFile(path.join(process.cwd(), 'public', 'phone', 'phone.html'));
});
app.get('/test', (req, res) => {
	res.sendFile(path.join(process.cwd(), 'public', 'test.html'));
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
	aiHasIntroduced?: boolean;
	lastUserSpeechTime?: number;
	conversationTurns?: number;
	isProcessingResponse?: boolean;
}

const callers = new Map<string, Caller>();
let callerIdCounter = 0;

// Generate unique caller ID
const generateCallerId = (): string => {
	callerIdCounter++;
	return `caller_${Date.now()}_${callerIdCounter}`;
}

// Helper function to send context hints to AI during conversation
const sendConversationContext = (caller: Caller, context: string) => {
	if (!caller.session) {
		console.error(`Cannot send context: No session for ${caller.id}`);
		return;
	}
	
	caller.session.sendRealtimeInput({
		text: context
	});
	
	console.log(`📋 Context sent to AI for ${caller.id}`);
}

// Trigger AI to speak with enhanced context
const triggerAIIntroduction = (caller: Caller) => {
	if (!caller.session) {
		console.error(`Cannot trigger AI introduction: No session for ${caller.id}`);
		return;
	}

	// Get current time context
	const now = new Date();
	const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening';
	const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
	const waitTimeSeconds = Math.round((Date.now() - caller.connectedAt.getTime()) / 1000);

	// Determine greeting style based on wait time
	let waitAcknowledgment = '';
	if (waitTimeSeconds < 10) {
		waitAcknowledgment = 'Thank you for calling';
	} else if (waitTimeSeconds < 30) {
		waitAcknowledgment = 'Thank you for your patience';
	} else if (waitTimeSeconds < 60) {
		waitAcknowledgment = 'Thank you for waiting';
	} else {
		waitAcknowledgment = 'Thank you very much for your patience during the wait';
	}

	// Build rich context prompt
	const contextInfo = [
		`Current time: ${timeOfDay} on ${dayOfWeek}`,
		`Caller ID: ${caller.id}`,
		caller.name ? `Caller name: ${caller.name}` : null,
		caller.phoneNumber ? `Phone number: ${caller.phoneNumber}` : null,
		`Wait time: ${waitTimeSeconds} seconds`,
	].filter(Boolean).join('\n');

	const introPrompt = `[SYSTEM CONTEXT]
${contextInfo}

[INSTRUCTION]
You are now connected to a live customer call. Please:

1. Start with a warm, natural greeting appropriate for ${timeOfDay}
2. ${waitAcknowledgment}
3. Introduce yourself as AuraGuard, your company CentriX, and mention you support NexLink Solutions
4. Express genuine readiness to help
5. Ask an open-ended question: "How may I assist you today?" or "What brings you to us today?"

Guidelines:
- Speak naturally as if in a real phone conversation
- Use a warm, professional, and empathetic tone
- Keep the introduction brief (15-20 seconds)
- Make the customer feel valued and heard
- Be ready to listen actively after your introduction

IMPORTANT - Response Behavior:
- After your introduction, LISTEN carefully to what the customer says
- When the customer speaks, acknowledge what they said before responding
- Respond directly and relevantly to their specific question or concern
- If they ask a question, answer it clearly and completely
- If they describe a problem, show empathy and offer solutions
- Keep responses focused and conversational (20-40 seconds)
- Ask clarifying questions when needed
- Never ignore what the customer just said

Begin speaking now.`;

	caller.session.sendRealtimeInput({
		text: introPrompt
	});
	
	// Mark introduction as triggered
	caller.aiHasIntroduced = true;

	console.log(`✓ AI introduction triggered for ${caller.id} (waited ${waitTimeSeconds}s)`);
}

// Create AI session for a caller
const createAISession = async (caller: Caller) => {
	// Initialize conversation tracking
	caller.aiHasIntroduced = false;
	caller.conversationTurns = 0;
	caller.isProcessingResponse = false;

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
				caller.isProcessingResponse = false;
			},
			onclose: (e) => {
				console.debug(`AI Session closed for ${caller.id}:`, e.reason);
				caller.ws.send(JSON.stringify({ type: 'status', message: 'AI session closed' }));
				caller.isProcessingResponse = false;
			},
			onmessage: (message) => {
				// Properly serialize the message object to JSON
				try {
					const msgString = typeof message === 'string' ? message : JSON.stringify(message);
					
					// Track AI response timing
					const responseTime = Date.now();
					const timeSinceUserSpeech = caller.lastUserSpeechTime 
						? responseTime - caller.lastUserSpeechTime 
						: 0;
					
					console.log(`🤖 AI Response for ${caller.id} (${timeSinceUserSpeech}ms after user speech):`, msgString);
					
					// Mark response as complete
					caller.isProcessingResponse = false;
					caller.conversationTurns = (caller.conversationTurns || 0) + 1;
					
					caller.ws.send(msgString);
				} catch (error) {
					console.error(`Error processing AI message for ${caller.id}:`, error);
					caller.ws.send(JSON.stringify({ type: 'error', message: 'Error processing AI response' }));
					caller.isProcessingResponse = false;
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

		// Trigger AI introduction with enhanced context after brief delay
		// The delay allows audio systems to fully initialize
		setTimeout(() => {
			triggerAIIntroduction(caller);
		}, 800); // Increased to 800ms for better audio system readiness

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

			// Track user speech timing
			caller.lastUserSpeechTime = Date.now();
			const turnNumber = (caller.conversationTurns || 0) + 1;
			
			console.log(`🎤 User audio received for ${callerId} (turn ${turnNumber})`);

			// Optional: Trigger AI introduction on first user speech instead of auto-trigger
			// Uncomment the following block to enable this behavior:
			/*
			if (!caller.aiHasIntroduced) {
				caller.aiHasIntroduced = true;
				triggerAIIntroduction(caller);
				console.log(`AI introduction triggered by user speech for ${callerId}`);
				return; // Don't forward the first audio chunk that triggered introduction
			}
			*/

			// Mark that we're processing user input
			caller.isProcessingResponse = true;

			// Forward audio to AI with enhanced context awareness
			try {
				caller.session.sendRealtimeInput({
					audio: {
						data: message,
						mimeType: 'audio/pcm;rate=16000'
					}
				});
				
				console.log(`✓ Audio forwarded to AI for ${callerId}`);
			} catch (error) {
				console.error(`✗ Error forwarding audio for ${callerId}:`, error);
				caller.isProcessingResponse = false;
				caller.ws.send(JSON.stringify({
					type: 'error',
					message: 'Failed to process audio input'
				}));
			}
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