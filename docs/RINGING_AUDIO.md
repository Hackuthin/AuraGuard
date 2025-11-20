# Ringing Audio Implementation

## Overview
The phone interface now plays `calling.mp3` on loop when the call is in the "waiting" state (ringing). The audio automatically stops when the call is answered, rejected, ended, or encounters an error.

## Implementation Details

### Audio Variables
```javascript
// Ringing audio
let ringingAudio = null;
```

### Initialization Function
```javascript
function initRingingAudio() {
    if (!ringingAudio) {
        ringingAudio = new Audio('/calling.mp3');
        ringingAudio.loop = true;
        ringingAudio.volume = 0.5; // Set volume to 50%
    }
}
```

### Play Function
```javascript
function playRinging() {
    initRingingAudio();
    if (ringingAudio && ringingAudio.paused) {
        ringingAudio.play().catch(error => {
            console.error('Error playing ringing audio:', error);
        });
        console.log('Ringing audio started');
    }
}
```

### Stop Function
```javascript
function stopRinging() {
    if (ringingAudio && !ringingAudio.paused) {
        ringingAudio.pause();
        ringingAudio.currentTime = 0;
        console.log('Ringing audio stopped');
    }
}
```

## When Audio Plays

### ✅ Starts Playing:
- **Status: "waiting"** - When caller enters the queue waiting for an operator

### ⏹️ Stops Playing:
- **Status: "connected"** - When operator accepts the call and AI connects
- **Status: "rejected"** - When operator rejects the call
- **Status: "ended"** - When call is ended by either party
- **Status: "disconnected"** - When connection is lost
- **Status: "error"** - When an error occurs
- **Page unload** - When user navigates away or closes the page

## Audio Settings

- **File**: `/calling.mp3` (served from public directory)
- **Loop**: Enabled (plays continuously)
- **Volume**: 50% (0.5) - Not too loud, not too quiet
- **Format**: MP3 audio file

## Code Integration

### In `updateCallStatus()` Function:
```javascript
case "waiting":
    statusElement.textContent = message;
    statusElement.classList.add("waiting", "calling");
    disableActionButtons(true);
    // Start playing ringing sound
    playRinging();
    break;

case "connected":
    statusElement.textContent = message;
    statusElement.classList.add("connected");
    disableActionButtons(false);
    // Stop ringing when connected
    stopRinging();
    break;

// Similar stopRinging() calls for rejected, ended, disconnected, and error states
```

### In Page Cleanup:
```javascript
window.addEventListener("beforeunload", () => {
    if (ws) {
        ws.close();
    }
    stopAudioCapture();
    stopRinging(); // Cleanup ringing audio
});
```

## User Experience

1. **Caller opens phone page** → Sees "Connecting..." status
2. **WebSocket connects** → Status changes to "Waiting for operator..."
3. **🔔 Ringing starts playing** → Looping audio provides feedback to caller
4. **Operator accepts call** → Status changes to "Connected"
5. **🔇 Ringing stops** → Caller can hear AI introduction
6. **Call proceeds normally** → No more ringing

## Alternative Scenarios

### If Call is Rejected:
- Ringing stops immediately
- Status shows "Call Rejected"
- "Call Again" button appears

### If Connection Drops:
- Ringing stops
- Status shows "Call Disconnected"
- "Call Again" button appears

### If User Ends Call:
- Ringing stops
- Status shows "Call Ended"
- "Call Again" button appears

## Error Handling

```javascript
ringingAudio.play().catch(error => {
    console.error('Error playing ringing audio:', error);
});
```

Errors are caught and logged to console without breaking the application. This handles cases where:
- Browser blocks autoplay
- Audio file is not found
- Playback permission is denied

## Browser Compatibility

The implementation uses:
- **HTML5 Audio API** - Supported in all modern browsers
- **Audio loop attribute** - Supported in all modern browsers
- **Promise-based play()** - Catches autoplay policy violations

## Testing

### Manual Test Steps:
1. Open `http://localhost:3000/phone`
2. Listen for ringing sound when "Waiting for operator..." appears
3. Open `http://localhost:3000/operator` in another tab/window
4. Accept the call from operator dashboard
5. Verify ringing stops when status changes to "Connected"
6. Test rejection flow:
   - Make another call
   - Reject from operator dashboard
   - Verify ringing stops immediately

### Autoplay Policy:
Some browsers may block autoplay. If this happens:
- User may need to interact with the page first
- Error will be logged to console
- Application continues to work normally

## Future Enhancements

Possible improvements:
- Add volume control slider for user
- Allow custom ringtone selection
- Add vibration pattern for mobile devices
- Fade in/out transitions for smoother audio experience
- Different ringtones for different call types
