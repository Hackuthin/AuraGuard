# Transcript Testing Guide

## Issue
The Gemini 2.5 Flash Native Audio API sends **audio-only responses** without text transcripts. The API returns audio in PCM format but does not provide text versions of what the AI is saying.

## Current Solution
The system now adds placeholder entries `[AI spoke - audio response]` to the transcript whenever the AI responds with audio. This lets operators know when the AI spoke, even though we don't have the exact text.

## Testing Steps

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open operator dashboard**:
   - Navigate to: http://localhost:3000/operator

3. **Make a test call**:
   - Open phone interface: http://localhost:3000
   - The call should appear in "Waiting Callers"

4. **Accept the call**:
   - Click "Accept Call" in the operator dashboard
   - The call should move to "Active Calls" section

5. **Let the AI speak**:
   - The AI should introduce itself automatically
   - Check the server console - you should see:
     ```
     📝 Added audio placeholder to transcript for caller_xxx
     ```

6. **View transcript**:
   - Click "View Transcript" on the active call
   - You should see entries like:
     ```
     🤖 AI Assistant
     [AI spoke - audio response]
     ```

## Expected Behavior

- **Transcript modal opens** when you click "View Transcript"
- **Caller information** displays at the top (name, phone, ID)
- **AI responses** appear as `[AI spoke - audio response]` with timestamps
- **Real-time updates**: Click "Refresh" button to see new messages

## Known Limitations

1. **No text transcription**: The Gemini Audio API doesn't provide text versions of AI speech
2. **User speech not captured**: We only see when the AI responds, not what the user said
3. **Audio-only placeholder**: Transcript shows `[AI spoke - audio response]` instead of actual text

## Future Enhancements

To get actual text transcripts, you would need to:

1. **Add Speech-to-Text**: Use a service like Google Cloud Speech-to-Text to transcribe both AI and user audio
2. **Use Text Mode**: Switch Gemini to text-only mode (loses natural voice quality)
3. **Hybrid Approach**: Keep audio for calls, but log text summaries using a separate LLM call

## Troubleshooting

### Transcript is empty
- Make sure the AI has responded at least once
- Check server console for `📝 Added audio placeholder` logs
- Verify the call is in "Active Calls" (status: 'connected')

### Modal doesn't open
- Check browser console for JavaScript errors
- Verify WebSocket connection is established
- Make sure you clicked "View Transcript" on an active call

### "No messages yet" appears
- The call needs to be accepted first (status must be 'connected')
- The AI needs to have responded at least once
- Check that `caller.transcript` array exists in server logs

## Server Console Messages

When transcripts are working, you'll see:
```
🤖 AI Response for caller_xxx (Xms after user speech): {"serverContent":{"modelTurn":...
📝 Added audio placeholder to transcript for caller_xxx
```

If you see errors:
```
Error adding to transcript for caller_xxx: [error details]
```

Check the `onmessage` handler in `src/index.ts` for issues.
