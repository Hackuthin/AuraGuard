# AuraGuard - Caller Queue System

## Overview
Implemented a caller queue management system where all connections are stored in a `callers` Map and must be accepted by an operator before they can communicate with the AI.

## Architecture Changes

### 1. Caller Management System (`src/index.ts`)

#### Data Structure
```typescript
interface Caller {
  id: string;              // Unique identifier
  ws: WebSocket;           // WebSocket connection
  session: AISession;      // AI session (null until accepted)
  status: 'waiting' | 'connected' | 'disconnected';
  connectedAt: Date;       // When they connected
  acceptedAt?: Date;       // When operator accepted them
  phoneNumber?: string;    // Optional phone number
  name?: string;           // Optional caller name
}
```

#### Key Features

**Caller Storage**
- All connections immediately added to `callers` Map
- Each caller gets a unique ID: `caller_${timestamp}_${counter}`
- Initial status is always `waiting`

**Operator Control**
- `acceptCaller(callerId)` - Accepts a caller and creates AI session
- `getWaitingCallers()` - Returns list of callers in queue
- Callers can only send audio after being accepted

**Message Handling**
- JSON messages = control messages (operator commands)
- Binary/string data = audio data (only processed if caller is connected)
- Waiting callers receive error if they try to send audio

### 2. Operator Dashboard (`/operator`)

#### Features
- **Real-time Queue Display**: Shows all waiting callers
- **Caller Information**: Name, phone number, wait time, caller ID
- **Accept/Reject Actions**: Buttons to manage each caller
- **Statistics**: Count of waiting callers, active calls, total
- **Auto-refresh**: Polls for updates every 3 seconds
- **Connection Status**: Visual indicator of server connection

#### Routes
- `GET /operator` - Operator dashboard interface
- `GET /phone` - Caller interface (existing)
- `GET /` - Main page (existing)

## WebSocket Protocol

### Client → Server

**Get Waiting Callers** (Operator)
```json
{
  "type": "get_waiting_callers"
}
```

**Accept Caller** (Operator)
```json
{
  "type": "operator_accept",
  "targetCallerId": "caller_123_1"
}
```

**Audio Data** (Caller)
```
Base64 encoded PCM audio (only processed if status='connected')
```

### Server → Client

**Waiting Status** (New Connection)
```json
{
  "type": "waiting",
  "callerId": "caller_123_1",
  "message": "You are in the queue..."
}
```

**Accepted Status**
```json
{
  "type": "accepted",
  "message": "Your call has been accepted..."
}
```

**Waiting Callers List** (Operator)
```json
{
  "type": "waiting_callers",
  "callers": [
    {
      "id": "caller_123_1",
      "phoneNumber": "123-456-7890",
      "name": "John Doe",
      "connectedAt": "2025-11-20T..."
    }
  ]
}
```

**Error Message**
```json
{
  "type": "error",
  "message": "You are not yet connected..."
}
```

## Security Considerations

### Current Implementation
- All operators can see all callers (no authentication yet)
- Phone numbers and names from headers (can be spoofed)
- No rate limiting on connections

### Recommended Improvements
1. **Operator Authentication**: Add login system for operators
2. **Caller Verification**: Implement proper caller ID verification
3. **Rate Limiting**: Prevent spam connections
4. **Session Management**: Add session tokens
5. **Encryption**: Ensure WSS (WebSocket Secure) in production
6. **Audit Logging**: Track all operator actions

## Usage

### For Operators
1. Navigate to `http://localhost:3000/operator`
2. View waiting callers in real-time
3. Click "Accept Call" to connect caller to AI
4. Click "Reject" to dismiss caller (TODO)

### For Callers
1. Connect to WebSocket at `ws://localhost:3000`
2. Receive "waiting" status message
3. Wait for operator acceptance
4. Once accepted, can send audio to AI
5. Receive AI responses

## Future Enhancements

### Phase 1 (Immediate)
- [ ] Implement reject functionality
- [ ] Add caller timeout (auto-disconnect after X minutes)
- [ ] Add operator notes field
- [ ] Show active (connected) callers separately

### Phase 2 (Short-term)
- [ ] Operator authentication system
- [ ] Multiple operator support
- [ ] Call transfer between operators
- [ ] Call recording functionality
- [ ] Priority queue system

### Phase 3 (Long-term)
- [ ] Analytics dashboard
- [ ] Caller history and CRM integration
- [ ] Automated routing based on caller data
- [ ] AI-powered call screening
- [ ] Multi-language support

## Testing

### Test Operator Dashboard
```bash
# Start server
npm run dev

# Open browser
open http://localhost:3000/operator
```

### Test Caller Flow
```javascript
// In browser console or client app
const ws = new WebSocket('ws://localhost:3000');
ws.onmessage = (e) => console.log('Received:', e.data);

// Try sending audio before acceptance (should fail)
ws.send('audio_data_here');
```

## Migration Notes

### Breaking Changes
- Callers no longer auto-connect to AI
- Must wait for operator acceptance
- Audio sent before acceptance is rejected

### Backwards Compatibility
- Existing phone interface still works
- WebSocket protocol extended (not breaking)
- All old messages still supported
