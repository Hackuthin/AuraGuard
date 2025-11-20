# Audio Transcription Setup

## Overview
AuraGuard now uses **Google Gemini 2.0 Flash** to transcribe both AI and user audio in real-time, providing accurate conversation transcripts for the operator dashboard.

## Features
- ✅ Real-time transcription of AI responses
- ✅ Real-time transcription of user speech
- ✅ Automatic transcript generation visible in operator dashboard
- ✅ High accuracy using Google's Gemini 2.0 Flash model
- ✅ No additional API keys needed - uses your existing Gemini key
- ✅ Completely free transcription (included in Gemini API usage)

## Setup Instructions

### Start the Server
```bash
npm run build
npm start
```

That's it! Transcription works automatically using your existing `GEMINI_API_KEY` from the `.env` file.

## How It Works

### AI Response Transcription
1. When Gemini sends an audio response, the system:
   - Extracts the PCM audio data (24kHz)
   - Converts it to WAV format
   - Sends it to OpenAI Whisper for transcription
   - Adds the transcribed text to the transcript with timestamp

### User Speech Transcription
1. When a user speaks, the system:
   - Accumulates audio chunks
   - After a 2-second pause, combines all chunks
   - Converts PCM audio (16kHz) to WAV format
   - Transcribes using Whisper
   - Adds the transcribed text to the transcript

### Viewing Transcripts
1. Open the operator dashboard at `http://localhost:3000/operator`
2. In the **Active Calls** section, click **View Transcript**
3. See the full conversation with timestamps:
   - 👤 **User**: "Hello, I need help with my account"
   - 🤖 **AI**: "Hello! I'd be happy to help you with your account today."

## Pricing
- **Completely FREE** - Transcription uses Gemini 2.0 Flash which is included in your existing Gemini API usage
- No per-minute charges
- Uses the same API key as the main conversation system

## Troubleshooting

### "Transcription failed" messages
- Check that your Gemini API key is correctly set in `.env`
- Verify your Gemini API quota hasn't been exceeded
- Check the console logs for detailed error messages

### Transcripts not appearing
- Ensure the server was restarted after updating `.env`
- Check that audio is being captured (look for 🎙️ emojis in logs)
- Verify the transcript modal is refreshed after audio plays

### Audio quality issues
- Ensure proper microphone/speaker setup
- Check that audio sample rates match (16kHz input, 24kHz AI output)
- Verify network connectivity for API calls

## How It Works Technically

### Transcription Process
1. **AI Response Transcription**:
   - When Gemini Native Audio API sends an audio response, the system extracts the PCM audio data
   - Opens a separate Gemini 2.0 Flash session configured for TEXT output
   - Sends the audio with a transcription prompt
   - Captures the text response and adds it to the transcript

2. **User Speech Transcription**:
   - Accumulates user audio chunks as they speak
   - After detecting a 2-second pause (indicating they finished speaking)
   - Combines all chunks into a single audio buffer
   - Sends to Gemini for transcription
   - Adds the transcribed text to the transcript

### Performance Optimization
- Transcription happens asynchronously and doesn't block the conversation
- Failed transcriptions fallback to "[Transcription failed]" gracefully
- User audio only transcribed after speech completion (not every chunk)
- Sessions are automatically cleaned up after transcription

## Support
For issues or questions, check the console logs which show:
- 🎙️ When transcription starts
- 📝 When transcription completes
- ❌ Any errors during transcription
