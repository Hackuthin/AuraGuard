# Phone Call Interface - User Guide

## Overview
The phone call interface (`/phone`) connects callers to the AuraGuard AI system through a queue-based system managed by operators.

## How It Works

### Connection Flow
1. **User opens phone interface** → `/phone`
2. **WebSocket connection established** → Automatic
3. **User enters waiting queue** → Status: "Waiting for operator..."
4. **Operator accepts call** → Status: "Connected"
5. **Microphone access granted** → Audio streaming begins
6. **Real-time AI conversation** → Voice bidirectional communication

### Call States

#### 1. Disconnected (Initial)
- **Status**: "Connecting..."
- **UI**: All buttons disabled
- **Actions**: None available

#### 2. Waiting
- **Status**: "Waiting for operator..." (pulsing orange)
- **UI**: All buttons disabled except "End Call"
- **Actions**: User can only hang up
- **Note**: Caller is in queue, visible to operators

#### 3. Connected
- **Status**: "Connected" (green)
- **UI**: All buttons enabled
- **Actions**: Full functionality available
- **Microphone**: Active and streaming audio to AI

#### 4. Ended/Disconnected
- **Status**: "Call Ended" (red)
- **UI**: All buttons disabled
- **Actions**: None available

## Features

### Visual Indicators

**Call Status**
- 🟠 **Orange pulsing**: Waiting in queue
- 🟢 **Green**: Connected to AI
- 🔴 **Red**: Error or disconnected
- 🔵 **Blue**: Initial state

**Microphone Indicator** (Top-right corner)
- Hidden when not speaking
- Green pulsing circle when actively transmitting audio
- Shows real-time voice activity

### Action Buttons

**Top Row:**
1. **Mute** 🎤
   - Toggles microphone on/off
   - Visual feedback (opacity changes)
   - Only works when connected

2. **Keypad** ⌨️
   - Future feature (TODO)
   - Currently disabled

3. **Reminder** 📅
   - Future feature (TODO)
   - Currently disabled

**Bottom Row:**
4. **Video Call** 📹
   - Future feature (TODO)
   - Currently disabled

5. **Add Call** 👥
   - Future feature (TODO)
   - Currently disabled

6. **Contacts** 📖
   - Future feature (TODO)
   - Currently disabled

### Call Controls

**Record** ⏺️
- Future feature (TODO)
- Will record call locally

**End Call** ☎️ (Red button - Center)
- Always enabled
- Ends call immediately
- Closes WebSocket connection
- Stops microphone capture

**Speaker** 🔊
- Future feature (TODO)
- Will toggle speaker mode

## Audio System

### Microphone Capture
- **Sample Rate**: 16kHz
- **Format**: PCM (Int16)
- **Encoding**: Base64
- **Features**:
  - Echo cancellation enabled
  - Noise suppression enabled
  - Automatic gain control

### Audio Processing
1. Browser captures audio from microphone
2. Audio converted to Float32 PCM
3. Processed through Web Audio API
4. Converted to Int16 PCM
5. Encoded as Base64
6. Sent via WebSocket to server
7. Forwarded to AI when connected

### Voice Activity Detection
- Real-time audio level monitoring
- Threshold: 1% of max amplitude
- Mic indicator shows when speaking
- Helps users know they're being heard

## Permissions

### Required Permissions
- **Microphone Access**: Required for voice calls
- Browser will prompt on first connection after operator accepts

### Denied Permissions
If microphone access is denied:
- Alert shown to user
- Call cannot proceed
- User must manually grant permission in browser settings

## Browser Compatibility

### Fully Supported
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)

### Partially Supported
- ⚠️ Mobile browsers (may have limitations)
- ⚠️ Older browser versions

### Required Features
- WebSocket support
- Web Audio API
- MediaStream API
- ES6+ JavaScript

## Responsive Design

### Mobile (< 480px)
- Reduced padding and gaps
- Smaller buttons
- Optimized touch targets

### Tablet (768px - 1024px)
- Balanced layout
- Medium button sizes

### Desktop (> 1024px)
- Maximum spacing
- Larger, easier to click buttons
- Centered content with max-width

## Security & Privacy

### Data Handling
- Audio streamed in real-time (not stored on client)
- No local recording unless explicitly enabled
- WebSocket connection secured in production (WSS)

### Recommendations
- Use HTTPS/WSS in production
- Implement caller authentication
- Add session encryption
- Enable audit logging

## Troubleshooting

### "Waiting for operator..." never changes
- **Cause**: No operator has accepted your call
- **Solution**: Wait for operator or contact support

### "Connection Error"
- **Cause**: WebSocket connection failed
- **Solution**: Check internet connection, refresh page

### No audio transmission
- **Cause**: Microphone not accessible
- **Solution**: Grant microphone permission, check device

### Buttons are disabled
- **Cause**: Not yet connected to AI
- **Solution**: Wait for operator to accept call

### Microphone indicator not showing
- **Cause**: Audio levels too low or muted
- **Solution**: Speak louder, check if muted

## Testing

### Test Locally
```bash
# Start server
npm run dev

# Open phone interface
open http://localhost:3000/phone

# Open operator dashboard (in another tab)
open http://localhost:3000/operator

# Accept the call from operator dashboard
```

### Test Audio
1. Connect as caller
2. Grant microphone permission when prompted
3. Wait for operator acceptance
4. Speak into microphone
5. Watch for mic indicator (top-right)
6. Check browser console for audio data logs

## Future Enhancements

### Planned Features
- [ ] Audio playback of AI responses
- [ ] Call recording
- [ ] Video call support
- [ ] Screen sharing
- [ ] Multi-language support
- [ ] Call transfer
- [ ] Conference calling
- [ ] Interactive keypad
- [ ] Contact management
- [ ] Call history
- [ ] Voicemail

### UI Improvements
- [ ] Call timer
- [ ] Queue position indicator
- [ ] Estimated wait time
- [ ] Custom ringtones
- [ ] Themes (light/dark mode)
- [ ] Accessibility features
- [ ] Keyboard shortcuts

## API Integration

### WebSocket Messages Sent

**Audio Data** (Binary)
```
Base64 encoded PCM audio data
Sent continuously when connected
```

### WebSocket Messages Received

**Waiting Status**
```json
{
  "type": "waiting",
  "callerId": "caller_123_1",
  "message": "You are in the queue..."
}
```

**Accepted**
```json
{
  "type": "accepted",
  "message": "Your call has been accepted..."
}
```

**Error**
```json
{
  "type": "error",
  "message": "Error description"
}
```

**AI Audio Response**
```
Binary audio data (to be implemented)
```

## Support

For issues or questions:
1. Check browser console for errors
2. Verify microphone permissions
3. Test with different browsers
4. Contact system administrator

## Developer Notes

### Code Structure
- HTML/CSS: Phone UI and styling
- JavaScript: WebSocket, audio capture, state management
- Audio Pipeline: Web Audio API → PCM → Base64 → WebSocket

### Key Functions
- `initializeCall()`: Establishes WebSocket connection
- `startAudioCapture()`: Begins microphone streaming
- `updateCallStatus()`: Updates UI based on state
- `toggleMute()`: Mutes/unmutes microphone
- `endCall()`: Terminates call and cleanup

### Customization
Edit `phone.html` to customize:
- Colors and styling (CSS section)
- Button layouts and icons
- Status messages
- Audio processing parameters
- WebSocket protocol handling
