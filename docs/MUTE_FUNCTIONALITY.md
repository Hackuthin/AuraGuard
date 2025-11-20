# Mute Functionality Documentation

## Overview
The mute functionality allows users to mute/unmute their microphone during a call. When muted, the user's audio is not sent to the AI, but they can still hear the AI's responses.

## Features

### 🎤 Mute/Unmute Button
- **Location**: Left button in the call controls (replaces the record button)
- **Visual States**:
  - **Unmuted** (Default): Gray background, microphone icon, label "Mute"
  - **Muted**: Red background, muted microphone icon with slash, label "Unmute"

### 🔇 Mute Behavior
When muted:
- User's microphone audio is **not sent** to the AI
- User can still **hear** AI responses
- Microphone indicator (green bar) is hidden
- Console logs: `🔇 Microphone muted`

### 🔊 Unmute Behavior
When unmuted:
- User's microphone audio is **sent** to the AI normally
- Microphone indicator shows when user speaks
- Console logs: `🔊 Microphone unmuted`

## Implementation Details

### State Management

```javascript
let isMuted = false; // Global state variable
```

### Audio Processing with Mute

The audio processing checks mute state before sending:

```javascript
processor.onaudioprocess = (e) => {
    if (ws && ws.readyState === WebSocket.OPEN && callStatus === "connected") {
        const inputData = e.inputBuffer.getChannelData(0);
        const hasAudio = checkForAudio(inputData);
        
        // Mic indicator only shows when unmuted
        updateMicIndicator(hasAudio && !isMuted);

        // Only send audio if not muted
        if (!isMuted) {
            const pcmData = convertFloat32ToInt16(inputData);
            const base64Data = arrayBufferToBase64(pcmData.buffer);
            ws.send(base64Data);
        }
    }
};
```

### Toggle Function

```javascript
function toggleMute() {
    isMuted = !isMuted;
    
    const muteIcon = document.getElementById('muteIcon');
    const muteLabel = document.getElementById('muteLabel');
    const micOnPath = document.getElementById('micOnPath');
    const micOffGroup = document.getElementById('micOffGroup');
    
    if (isMuted) {
        // Muted state
        muteIcon.classList.add('active');
        muteLabel.textContent = 'Unmute';
        micOnPath.style.display = 'none';
        micOffGroup.style.display = 'block';
        console.log('🔇 Microphone muted');
    } else {
        // Unmuted state
        muteIcon.classList.remove('active');
        muteLabel.textContent = 'Mute';
        micOnPath.style.display = 'block';
        micOffGroup.style.display = 'none';
        console.log('🔊 Microphone unmuted');
    }
    
    updateMicIndicator(false);
}
```

## Visual Design

### CSS Styling

```css
.mute-icon {
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.3s ease;
}

.mute-icon.active {
    background: #ff3b30; /* Red when muted */
}
```

### SVG Icons

**Unmuted Icon** (Default):
- Standard microphone icon
- Gray circular background
- Label: "Mute"

**Muted Icon** (Active):
- Microphone with slash through it
- Red circular background
- Label: "Unmute"

## User Experience Flow

### Scenario 1: User Wants to Mute During Call

```
1. User is in active call
2. User clicks "Mute" button
3. Button turns red with muted icon
4. Label changes to "Unmute"
5. User's audio stops being sent to AI
6. Mic indicator disappears
7. Console logs: 🔇 Microphone muted
```

### Scenario 2: User Wants to Unmute

```
1. User is muted
2. User clicks "Unmute" button
3. Button turns gray with normal mic icon
4. Label changes to "Mute"
5. User's audio resumes being sent to AI
6. Mic indicator shows when speaking
7. Console logs: 🔊 Microphone unmuted
```

### Scenario 3: Call Ends While Muted

```
1. User is muted
2. Call ends (user or operator ends call)
3. Mute state automatically resets to unmuted
4. Next call starts in unmuted state
```

### Scenario 4: Call Again While Muted

```
1. User was muted when previous call ended
2. User clicks "Call Again"
3. Mute state automatically resets to unmuted
4. New call starts in unmuted state
```

## State Reset

Mute state is automatically reset in these situations:

1. **Call Ends**: `endCall()` function resets mute state
2. **Call Again**: `callAgain()` function resets mute state
3. **Page Reload**: Default state is unmuted

```javascript
// In endCall() and callAgain()
if (isMuted) {
    toggleMute(); // Reset to unmuted
}
```

## Console Logging

### Mute/Unmute Events

```bash
# When user mutes
🔇 Microphone muted

# When user unmutes
🔊 Microphone unmuted
```

### Audio Processing

When muted, audio processing still happens but no data is sent:
- Audio is captured from microphone
- Audio level is checked
- Mic indicator is **not** updated
- Audio data is **not** sent via WebSocket

## Technical Specifications

### Audio Flow

**Unmuted State**:
```
Microphone → AudioContext → ScriptProcessor → Check Audio Level → 
Update Mic Indicator → Convert to PCM → Send to Server
```

**Muted State**:
```
Microphone → AudioContext → ScriptProcessor → Check Audio Level → 
Update Mic Indicator (false) → [STOP - No data sent]
```

### Performance Impact

- **Minimal**: Audio processing continues, only WebSocket send is skipped
- **CPU**: No additional CPU usage (just a boolean check)
- **Memory**: No additional memory usage (no buffering)
- **Network**: Significantly reduced (no audio data sent while muted)

### Network Bandwidth

**Unmuted** (approximate):
- Audio chunks sent: ~10-20 per second
- Data rate: ~16-32 KB/s (depends on audio activity)

**Muted**:
- Audio chunks sent: 0
- Data rate: 0 KB/s
- Network completely idle for user audio

## Use Cases

### 1. Background Noise
**Situation**: User is in noisy environment  
**Action**: Mute while listening to AI  
**Benefit**: AI doesn't hear background noise

### 2. Thinking Time
**Situation**: User needs time to think  
**Action**: Mute while considering response  
**Benefit**: No accidental sounds sent to AI

### 3. Side Conversation
**Situation**: Someone interrupts user during call  
**Action**: Mute to talk to someone else  
**Benefit**: Private conversation not heard by AI

### 4. Privacy
**Situation**: User doesn't want to be heard temporarily  
**Action**: Mute during sensitive moment  
**Benefit**: Complete privacy control

### 5. Technical Issues
**Situation**: User experiences echo or feedback  
**Action**: Mute to stop audio loop  
**Benefit**: Prevents audio quality issues

## Accessibility

### Keyboard Support
Currently click-only. Future enhancement could add:
- Spacebar to toggle mute (like Zoom)
- 'M' key shortcut

### Screen Readers
Button has:
- Descriptive label that changes (Mute/Unmute)
- Visual icon that changes
- Color change (red = muted)

### Visual Feedback
Multiple indicators of mute state:
- ✅ Icon changes
- ✅ Label changes
- ✅ Background color changes (red)
- ✅ Mic indicator disappears

## Testing Scenarios

### Test 1: Basic Mute/Unmute
1. Start a call
2. Click "Mute" button
3. **Verify**: Button turns red, label says "Unmute"
4. Speak into microphone
5. **Verify**: AI does not hear you, mic indicator doesn't show
6. Click "Unmute" button
7. **Verify**: Button turns gray, label says "Mute"
8. Speak into microphone
9. **Verify**: AI hears you, mic indicator shows

### Test 2: Mute State Reset on End Call
1. Start a call
2. Mute microphone
3. End the call
4. Start a new call
5. **Verify**: Microphone is unmuted (not muted from previous call)

### Test 3: Mute State Reset on Call Again
1. Start a call
2. Mute microphone
3. Wait for call to end (or operator rejects)
4. Click "Call Again"
5. **Verify**: Microphone is unmuted

### Test 4: Mute While AI is Speaking
1. Start a call
2. AI starts speaking
3. Click "Mute" while AI is talking
4. **Verify**: You can still hear AI, button turns red
5. AI finishes speaking
6. **Verify**: Your mic is still muted

### Test 5: Rapid Toggle
1. Start a call
2. Quickly click Mute/Unmute multiple times
3. **Verify**: State changes correctly each time
4. **Verify**: Final state matches button appearance

## Troubleshooting

### Issue: Button Doesn't Change Color
**Check**: CSS classes being applied?  
**Solution**: Inspect element, verify `active` class on mute-icon

### Issue: Still Sending Audio When Muted
**Check**: `isMuted` variable state  
**Solution**: Add console.log in audio processing to verify boolean

### Issue: Mic Indicator Still Shows When Muted
**Check**: `updateMicIndicator(hasAudio && !isMuted)`  
**Solution**: Verify the AND condition is working

### Issue: Mute State Persists Across Calls
**Check**: Reset logic in `endCall()` and `callAgain()`  
**Solution**: Ensure `if (isMuted) toggleMute()` is called

### Issue: Icon Doesn't Change
**Check**: SVG path display property  
**Solution**: Verify `micOnPath` and `micOffGroup` elements exist

## Future Enhancements

### Possible Improvements

1. **Keyboard Shortcut**
   - Add spacebar or 'M' key to toggle mute
   - Show keyboard hint in tooltip

2. **Push-to-Talk Mode**
   - Hold button to temporarily unmute
   - Release to mute again

3. **Visual Indicator on Screen**
   - Show "MUTED" banner when muted
   - Add red border around call screen

4. **Audio Feedback**
   - Play beep sound when muting
   - Play different beep when unmuting

5. **Mute Reminder**
   - If AI asks a question while muted
   - Show notification: "You're muted"

6. **Analytics**
   - Track how often users mute
   - Track average mute duration
   - Identify if mute causes issues

7. **Server-Side Awareness**
   - Send mute state to server
   - AI knows user is muted
   - AI can say "I notice you're muted"

## API Reference

### `toggleMute(): void`

Toggles the microphone mute state.

**Parameters**: None

**Returns**: `void`

**Side Effects**:
- Updates `isMuted` state
- Changes button appearance
- Updates console log
- Updates mic indicator

**Example**:
```javascript
// Call from button onclick
<button onclick="toggleMute()">Mute</button>

// Call programmatically
toggleMute();
```

### State Variable

```javascript
let isMuted = false;
```

**Type**: `boolean`  
**Default**: `false` (unmuted)  
**Access**: Global scope

## Configuration

### Colors

```css
/* Unmuted background */
background: rgba(255, 255, 255, 0.15);

/* Muted background */
background: #ff3b30; /* Red */
```

### Icons

Icons are inline SVG in the HTML:
- `#micOnPath`: Normal microphone (shown when unmuted)
- `#micOffGroup`: Muted microphone with slash (shown when muted)

## Best Practices

1. **Always reset mute on call end** - Prevents confusion in next call
2. **Show clear visual feedback** - User should always know mute state
3. **Log mute events** - Helps with debugging
4. **Don't send silence** - Better to send nothing when muted
5. **Keep mic indicator in sync** - Indicator should reflect mute state

## Summary

The mute functionality provides users with:

✅ **Privacy control** - Choose when to be heard  
✅ **Noise reduction** - Block background sounds  
✅ **Clear visual feedback** - Always know mute state  
✅ **Automatic reset** - No confusion between calls  
✅ **Simple operation** - One-click toggle  
✅ **No audio sent** - Complete silence when muted  
✅ **Continues receiving** - Still hear AI responses  

The feature is production-ready and provides a professional calling experience! 🎙️
