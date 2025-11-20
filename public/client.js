class AuraGuardClient {
	constructor() {
		this.ws = null;
		this.mediaRecorder = null;
		this.audioContext = null;
		this.analyser = null;
		this.audioStream = null;
		this.isRecording = false;
		this.isConnected = false;

		// DOM elements
		this.connectBtn = document.getElementById('connectBtn');
		this.startBtn = document.getElementById('startBtn');
		this.stopBtn = document.getElementById('stopBtn');
		this.statusText = document.getElementById('statusText');
		this.statusIndicator = document.getElementById('statusIndicator');
		this.recordingStatus = document.getElementById('recordingStatus');
		this.connectionStatus = document.getElementById('connectionStatus');
		this.audioLevel = document.getElementById('audioLevel');
		this.logContent = document.getElementById('logContent');
		this.visualizer = document.getElementById('visualizer');
		this.canvasCtx = this.visualizer.getContext('2d');

		// Audio playback
		this.audioQueue = [];
		this.isPlayingAudio = false;

		this.setupEventListeners();
		this.resizeCanvas();
		window.addEventListener('resize', () => this.resizeCanvas());
	}

	setupEventListeners() {
		this.connectBtn.addEventListener('click', () => this.toggleConnection());
		this.startBtn.addEventListener('click', () => this.startRecording());
		this.stopBtn.addEventListener('click', () => this.stopRecording());
	}

	resizeCanvas() {
		const rect = this.visualizer.getBoundingClientRect();
		this.visualizer.width = rect.width * window.devicePixelRatio;
		this.visualizer.height = rect.height * window.devicePixelRatio;
		this.canvasCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
	}

	async toggleConnection() {
		if (this.isConnected) {
			this.disconnect();
		} else {
			await this.connect();
		}
	}

	async connect() {
		try {
			this.log('Connecting to server...', 'info');

			// Use the current hostname and port
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const host = window.location.hostname;
			const port = window.location.port || '3000';
			const wsUrl = `${protocol}//${host}:${port}`;

			this.ws = new WebSocket(wsUrl);

			this.ws.onopen = () => {
				this.isConnected = true;
				this.updateConnectionStatus(true);
				this.log('Connected to server successfully!', 'success');
				this.startBtn.disabled = false;
				this.connectBtn.textContent = '🔌 Disconnect';
				this.connectBtn.classList.remove('btn-primary');
				this.connectBtn.classList.add('btn-danger');
			};

			this.ws.onclose = () => {
				this.isConnected = false;
				this.updateConnectionStatus(false);
				this.log('Disconnected from server', 'error');
				this.startBtn.disabled = true;
				this.stopBtn.disabled = true;
				this.connectBtn.textContent = '🔌 Connect';
				this.connectBtn.classList.remove('btn-danger');
				this.connectBtn.classList.add('btn-primary');
				if (this.isRecording) {
					this.stopRecording();
				}
			};

			this.ws.onerror = (error) => {
				this.log('WebSocket error occurred', 'error');
				console.error('WebSocket error:', error);
			};

			this.ws.onmessage = async (event) => {
				try {
					// Parse the message from the server
					const data = JSON.parse(event.data);

					// Handle audio responses
					if (data.serverContent && data.serverContent.modelTurn) {
						const parts = data.serverContent.modelTurn.parts;

						for (const part of parts) {
							if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
								// this.log('Received audio response from AI', 'success');
								await this.playAudioResponse(part.inlineData.data);
							}

							if (part.text) {
								this.log(`AI: ${part.text}`, 'info');
							}
						}
					}
				} catch (error) {
					// If it's not JSON, just log it
					this.log(`Server: ${event.data}`, 'info');
				}
			};

		} catch (error) {
			this.log(`Connection failed: ${error.message}`, 'error');
			console.error('Connection error:', error);
		}
	}

	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		if (this.isRecording) {
			this.stopRecording();
		}
	}

	async startRecording() {
		try {
			// Check if mediaDevices is available
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
			}

			this.log('Requesting microphone access...', 'info');

			// Get audio stream from microphone
			this.audioStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			this.log('Microphone access granted', 'success');

			// Setup audio context for processing and visualization
			this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
			this.log(`Audio context sample rate: ${this.audioContext.sampleRate}Hz`, 'info');

			// Setup analyzer for visualization
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 2048;
			const source = this.audioContext.createMediaStreamSource(this.audioStream);
			source.connect(this.analyser);

			// Use AudioWorklet for modern audio processing
			try {
				await this.setupAudioWorklet(source);
			} catch (workletError) {
				this.log('AudioWorklet not available, using fallback', 'info');
				await this.setupMediaRecorder();
			};

			// Start visualization
			this.visualize();

			this.isRecording = true;
			this.updateRecordingStatus(true);
			this.startBtn.disabled = true;
			this.stopBtn.disabled = false;
			this.log('Recording started', 'success');

		} catch (error) {
			this.log(`Failed to start recording: ${error.message}`, 'error');
			console.error('Recording error:', error);

			// Clean up on error
			if (this.audioStream) {
				this.audioStream.getTracks().forEach(track => track.stop());
			}
			if (this.audioContext) {
				this.audioContext.close();
			}
		}
	}

	async setupAudioWorklet(source) {
		// Create inline AudioWorklet processor
		const processorCode = `
			class PCMProcessor extends AudioWorkletProcessor {
				process(inputs, outputs, parameters) {
					const input = inputs[0];
					if (input.length > 0) {
						const inputData = input[0];
						// Convert Float32 to Int16 PCM
						const pcmData = new Int16Array(inputData.length);
						for (let i = 0; i < inputData.length; i++) {
							const s = Math.max(-1, Math.min(1, inputData[i]));
							pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
						}
						// Send to main thread
						this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
					}
					return true;
				}
			}
			registerProcessor('pcm-processor', PCMProcessor);
		`;

		const blob = new Blob([processorCode], { type: 'application/javascript' });
		const workletUrl = URL.createObjectURL(blob);

		await this.audioContext.audioWorklet.addModule(workletUrl);
		URL.revokeObjectURL(workletUrl);

		this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
		this.workletNode.port.onmessage = (event) => {
			if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
				return;
			}
			const base64 = this.arrayBufferToBase64(event.data);
			this.ws.send(base64);
		};

		source.connect(this.workletNode);
		this.workletNode.connect(this.audioContext.destination);
		this.log('Using AudioWorklet for audio processing', 'success');
	}

	async setupMediaRecorder() {
		// Fallback to MediaRecorder for older browsers
		const options = { mimeType: 'audio/webm;codecs=opus' };
		this.mediaRecorder = new MediaRecorder(this.audioStream, options);

		this.mediaRecorder.ondataavailable = async (event) => {
			if (event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
				// Convert to ArrayBuffer then to PCM (simplified)
				const arrayBuffer = await event.data.arrayBuffer();
				const base64 = this.arrayBufferToBase64(arrayBuffer);
				this.ws.send(base64);
			}
		};

		this.mediaRecorder.start(100); // Send chunks every 100ms
		this.log('Using MediaRecorder fallback', 'info');
	}

	arrayBufferToBase64(buffer) {
		let binary = '';
		const bytes = new Uint8Array(buffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	stopRecording() {
		this.isRecording = false;

		if (this.workletNode) {
			this.workletNode.disconnect();
			this.workletNode = null;
		}

		if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
			this.mediaRecorder.stop();
			this.mediaRecorder = null;
		}

		if (this.audioStream) {
			this.audioStream.getTracks().forEach(track => track.stop());
			this.audioStream = null;
		}

		if (this.audioContext && this.audioContext.state !== 'closed') {
			this.audioContext.close();
			this.audioContext = null;
		}

		this.updateRecordingStatus(false);
		this.startBtn.disabled = false;
		this.stopBtn.disabled = true;
		this.log('Recording stopped', 'info');

		// Clear visualization
		this.canvasCtx.clearRect(0, 0, this.visualizer.width, this.visualizer.height);
	}

	visualize() {
		if (!this.isRecording || !this.analyser) return;

		requestAnimationFrame(() => this.visualize());

		const bufferLength = this.analyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);
		const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

		this.analyser.getByteTimeDomainData(dataArray);
		this.analyser.getByteFrequencyData(frequencyData);

		const width = this.visualizer.width / window.devicePixelRatio;
		const height = this.visualizer.height / window.devicePixelRatio;

		// Clear with fade effect
		this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
		this.canvasCtx.fillRect(0, 0, width, height);

		// Draw waveform
		this.canvasCtx.lineWidth = 2;
		this.canvasCtx.strokeStyle = '#6366f1';
		this.canvasCtx.beginPath();

		const sliceWidth = width / bufferLength;
		let x = 0;

		for (let i = 0; i < bufferLength; i++) {
			const v = dataArray[i] / 128.0;
			const y = (v * height) / 2;

			if (i === 0) {
				this.canvasCtx.moveTo(x, y);
			} else {
				this.canvasCtx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		this.canvasCtx.lineTo(width, height / 2);
		this.canvasCtx.stroke();

		// Calculate RMS (Root Mean Square) for audio level
		let sum = 0;
		for (let i = 0; i < dataArray.length; i++) {
			const normalized = (dataArray[i] - 128) / 128;
			sum += normalized * normalized;
		}
		const rms = Math.sqrt(sum / dataArray.length);
		const level = Math.round(Math.min(100, rms * 200)); // Scale and cap at 100%

		this.audioLevel.textContent = `${level}%`;

		// Optional: Change color based on level
		if (level > 70) {
			this.audioLevel.style.color = '#ef4444'; // Red for loud
		} else if (level > 30) {
			this.audioLevel.style.color = '#10b981'; // Green for normal
		} else {
			this.audioLevel.style.color = '#94a3b8'; // Gray for quiet
		}
	}

	async playAudioResponse(base64Audio) {
		// Convert base64 to ArrayBuffer
		const binaryString = atob(base64Audio);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		// Add to queue
		this.audioQueue.push(bytes.buffer);

		// Start playing if not already playing
		if (!this.isPlayingAudio) {
			this.playNextAudio();
		}
	}

	async playNextAudio() {
		if (this.audioQueue.length === 0) {
			this.isPlayingAudio = false;
			return;
		}

		this.isPlayingAudio = true;
		const pcmData = this.audioQueue.shift();

		try {
			// Create an audio context for playback
			const playbackContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

			// Convert Int16 PCM to Float32 for Web Audio API
			const int16Array = new Int16Array(pcmData);
			const float32Array = new Float32Array(int16Array.length);

			for (let i = 0; i < int16Array.length; i++) {
				float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
			}

			// Create an audio buffer
			const audioBuffer = playbackContext.createBuffer(1, float32Array.length, playbackContext.sampleRate);
			audioBuffer.getChannelData(0).set(float32Array);

			// Create a buffer source and play
			const source = playbackContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(playbackContext.destination);

			source.onended = () => {
				playbackContext.close();
				this.playNextAudio();
			};

			source.start(0);

		} catch (error) {
			this.log(`Error playing audio: ${error.message}`, 'error');
			console.error('Audio playback error:', error);
			this.playNextAudio();
		}
	}

	updateConnectionStatus(connected) {
		if (connected) {
			this.statusText.textContent = 'Connected';
			this.connectionStatus.textContent = 'Connected';
			this.statusIndicator.classList.add('connected');
		} else {
			this.statusText.textContent = 'Disconnected';
			this.connectionStatus.textContent = 'Not connected';
			this.statusIndicator.classList.remove('connected', 'recording');
		}
	}

	updateRecordingStatus(recording) {
		if (recording) {
			this.recordingStatus.textContent = 'Active';
			this.statusIndicator.classList.add('recording');
			this.statusText.textContent = 'Recording...';
		} else {
			this.recordingStatus.textContent = 'Inactive';
			this.statusIndicator.classList.remove('recording');
			if (this.isConnected) {
				this.statusText.textContent = 'Connected';
			}
		}
	}

	log(message, type = '') {
		const entry = document.createElement('p');
		entry.className = `log-entry ${type}`;
		entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
		this.logContent.appendChild(entry);
		this.logContent.scrollTop = this.logContent.scrollHeight;

		// Keep only last 50 entries
		while (this.logContent.children.length > 50) {
			this.logContent.removeChild(this.logContent.firstChild);
		}
	}

	checkBrowserCompatibility() {
		const issues = [];

		// Check getUserMedia support
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			issues.push('Microphone access not supported');
		}

		// Check Web Audio API support
		if (!window.AudioContext && !window.webkitAudioContext) {
			issues.push('Web Audio API not supported');
		}

		// Check WebSocket support
		if (!window.WebSocket) {
			issues.push('WebSocket not supported');
		}

		// Check if using secure context (required for getUserMedia)
		if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
			issues.push('HTTPS required (or use localhost)');
		}

		if (issues.length > 0) {
			this.log(`⚠️ Browser compatibility issues: ${issues.join(', ')}`, 'error');
			return false;
		}

		this.log('✓ Browser compatibility check passed', 'success');
		return true;
	}
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
	const client = new AuraGuardClient();
	client.checkBrowserCompatibility();
});
