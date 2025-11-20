# Quick Start Guide - Testing AuraGuard Phone System

## 🚀 Quick Start (2 minutes)

### Step 1: Start Server
```bash
cd /home/danieljohn/Desktop/AuraGuard
npm run dev
```

### Step 2: Open Operator Dashboard
```
Browser Tab 1: http://localhost:3000/operator
```

### Step 3: Open Phone Interface
```
Browser Tab 2: http://localhost:3000/phone
```

### Step 4: Accept Call
1. Switch to **Operator Dashboard** (Tab 1)
2. See the waiting caller appear
3. Click **"Accept Call"** button

### Step 5: Test Call
1. Switch to **Phone Interface** (Tab 2)
2. Grant microphone permission when prompted
3. Speak into microphone
4. Watch mic indicator pulse (top-right corner)
5. Check browser console for logs

### Step 6: End Call
Click the red phone button in the center

## 🎯 Visual Checklist

### Phone Interface Should Show:
- ✅ Status: "Waiting for operator..." (orange, pulsing)
- ✅ After acceptance: "Connected" (green)
- ✅ Mic indicator pulses when you speak (top-right)
- ✅ Mute button works (becomes semi-transparent)
- ✅ End call button always works (red, center)

### Operator Dashboard Should Show:
- ✅ Caller card with details
- ✅ "Accept Call" button (green)
- ✅ Waiting count increases
- ✅ After acceptance, caller disappears from list

## 🐛 Debug Checklist

### Phone Interface Console
```javascript
// Should see:
"Initializing call..."
"WebSocket connected"
"Server message: {type: 'waiting', ...}"
"Audio capture started"
// When speaking:
"[continuous audio data being sent]"
```

### Operator Dashboard Console
```javascript
// Should see:
"Connected to server"
"Server message: {type: 'waiting_callers', callers: [...]}"
"Accepting caller: caller_xxx_xxx"
```

### Server Console
```bash
# Should see:
"New caller caller_xxx_xxx connected. Status: waiting."
"Caller caller_xxx_xxx accepted and connected to AI"
"AI Session opened for caller_xxx_xxx"
```

## 🔧 Common Issues

### "Stuck on Connecting..."
- ❌ Server not running
- ✅ Run `npm run dev`

### "Waiting for operator..." forever
- ❌ No operator accepted
- ✅ Open operator dashboard and click "Accept Call"

### No mic indicator showing
- ❌ Not speaking loud enough
- ❌ Microphone muted in system
- ❌ Browser didn't grant permission
- ✅ Speak louder, check system mic, grant permission

### Buttons disabled
- ❌ Not connected yet
- ✅ Wait for operator to accept call

## 📊 Expected Behavior

### Timeline
```
0s   → User opens /phone
0.5s → WebSocket connects
1s   → Status: "Waiting for operator..."
      → Operator sees caller in dashboard
      → Operator clicks "Accept Call"
3s   → Status: "Connected"
      → Browser requests mic permission
4s   → User grants permission
      → Audio streaming begins
5s+  → Active call with AI
```

### State Flow
```
┌─────────────┐
│ Open /phone │
└──────┬──────┘
       ▼
┌─────────────┐
│  Connecting │ (1 second)
└──────┬──────┘
       ▼
┌─────────────┐
│   Waiting   │ (until operator accepts)
└──────┬──────┘
       ▼
┌─────────────┐
│  Connected  │ (active call)
└──────┬──────┘
       ▼
┌─────────────┐
│    Ended    │
└─────────────┘
```

## 🎨 UI Reference

### Status Colors
- 🔵 Blue → Initial/Connecting
- 🟠 Orange (pulsing) → Waiting in queue
- 🟢 Green → Connected to AI
- 🔴 Red → Ended/Error

### Button States
- Full opacity → Enabled
- 30% opacity → Disabled
- 50% opacity → Muted

## 📱 URLs Quick Reference

| Page     | URL                              | Purpose             |
| -------- | -------------------------------- | ------------------- |
| Phone    | `http://localhost:3000/phone`    | Caller interface    |
| Operator | `http://localhost:3000/operator` | Accept/manage calls |
| Home     | `http://localhost:3000/`         | Landing page        |

## 🔍 Monitoring

### Watch These Metrics
- Number of waiting callers
- Time in queue
- Connection success rate
- Audio streaming stability

### Browser Dev Tools
- Console: Check for errors
- Network: Monitor WebSocket connection
- Performance: Check audio processing load

## ✨ Success Criteria

Your implementation is working if:
- [x] Caller connects and enters queue automatically
- [x] Operator can see caller in dashboard
- [x] Accepting call changes caller status
- [x] Microphone captures audio after acceptance
- [x] Audio streams to server continuously
- [x] Mic indicator shows voice activity
- [x] Mute button toggles audio
- [x] End call cleans up properly

## 🎓 Next Steps

Once basic flow works:
1. Test with multiple callers
2. Test audio quality
3. Test on different browsers
4. Test on mobile devices
5. Implement audio playback
6. Add error recovery
7. Add reconnection logic
8. Deploy to production

## 💡 Pro Tips

1. **Keep both tabs open** (operator + phone) for easy testing
2. **Use Chrome DevTools** for best debugging experience
3. **Check all three consoles** (phone, operator, server)
4. **Test mute** by watching mic indicator disappear
5. **Use headphones** to avoid echo/feedback
6. **Speak clearly** for mic indicator to show

## 🆘 Emergency Troubleshooting

If nothing works:
```bash
# Stop server
Ctrl+C

# Clean and rebuild
npm run build

# Restart
npm run dev

# Hard refresh browsers
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

## 📞 Contact Flow Test Script

Use this to test the complete flow:

1. **Start**: Open phone interface
   - Verify: Shows "Connecting..." then "Waiting for operator..."

2. **Queue**: Check operator dashboard
   - Verify: Caller appears in waiting list

3. **Accept**: Click "Accept Call"
   - Verify: Phone status changes to "Connected"
   - Verify: Browser asks for mic permission

4. **Permission**: Grant microphone access
   - Verify: Mic indicator appears (top-right)

5. **Talk**: Speak into microphone
   - Verify: Mic indicator pulses green
   - Verify: Console shows audio data being sent

6. **Mute**: Click mute button
   - Verify: Button becomes semi-transparent
   - Verify: Mic indicator stops pulsing

7. **Unmute**: Click mute button again
   - Verify: Button returns to full opacity
   - Verify: Mic indicator resumes when speaking

8. **End**: Click red phone button
   - Verify: Status shows "Call Ended"
   - Verify: WebSocket disconnects
   - Verify: Audio capture stops

## 🎉 Done!

Your AuraGuard phone system is now fully integrated and ready for testing!

For detailed documentation, see:
- `/docs/PHONE_INTERFACE_GUIDE.md` - User guide
- `/docs/CALLER_QUEUE_SYSTEM.md` - System architecture
- `/docs/PHONE_IMPLEMENTATION_SUMMARY.md` - Implementation details
