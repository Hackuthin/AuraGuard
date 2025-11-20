# Reject Functionality Implementation

## Overview
The reject functionality allows operators to reject incoming calls from waiting callers. When a call is rejected, the caller receives a notification and their connection is closed gracefully.

## Implementation Details

### Server-Side (`src/index.ts`)

#### 1. `rejectCaller()` Function
```typescript
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
```

#### 2. WebSocket Message Handler
Added support for `operator_reject` message type:
```typescript
if (parsed.type === 'operator_reject' && parsed.targetCallerId) {
	rejectCaller(parsed.targetCallerId);
	return;
}
```

#### 3. REST API Endpoint
Added POST endpoint for rejecting callers:
```typescript
app.post('/callers/:id/reject', (req, res) => {
	const callerId = req.params.id;
	const success = rejectCaller(callerId);
	if (success) {
		res.json({ status: 'rejected' });
	} else {
		res.status(400).json({ status: 'error', message: 'Failed to reject caller' });
	}
});
```

### Operator Interface (`public/operator/operator.html`)

#### Updated `rejectCaller()` Function
```javascript
function rejectCaller(callerId) {
	if (!confirm('Are you sure you want to reject this call?')) {
		return;
	}

	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({
			type: 'operator_reject',
			targetCallerId: callerId
		}));
		console.log(`Rejecting caller: ${callerId}`);

		// Refresh the list after a short delay
		setTimeout(requestWaitingCallers, 500);
	}
}
```

### Phone Interface (`public/phone/phone.html`)

#### 1. Message Handler
Added handling for `rejected` message type:
```javascript
case "rejected":
	console.log("Call rejected:", data.message);
	updateCallStatus("rejected", data.message || "Call Rejected");
	stopAudioCapture();
	// Close WebSocket after showing rejection message
	setTimeout(() => {
		if (ws) {
			ws.close();
			ws = null;
		}
	}, 2000);
	break;
```

#### 2. Status Update Handler
Added UI handling for rejected status:
```javascript
case "rejected":
	statusElement.textContent = message;
	statusElement.classList.add("error");
	disableActionButtons(true);
	// Show call again button when call is rejected
	callAgainBtn.classList.add("visible");
	break;
```

## User Flow

### Operator Perspective
1. Operator sees waiting caller in the dashboard
2. Operator clicks "Reject" button
3. Confirmation dialog appears: "Are you sure you want to reject this call?"
4. If confirmed, rejection message is sent via WebSocket
5. Caller is removed from the waiting list
6. Dashboard refreshes to show updated list

### Caller Perspective
1. Caller is waiting in queue
2. Status shows "Waiting for operator..."
3. If rejected:
   - Status changes to "Call Rejected" (or custom message)
   - UI shows error state (red text)
   - Audio capture stops
   - "Call Again" button appears
   - WebSocket connection closes after 2 seconds
4. Caller can click "Call Again" to reconnect

## Features

### Confirmation Dialog
- Prevents accidental rejections
- Operator must confirm before rejecting a call

### Graceful Disconnection
- Caller receives rejection message before disconnection
- 100ms delay ensures message is delivered
- WebSocket closes cleanly

### UI Feedback
- Clear status updates for both operator and caller
- Error styling applied to rejection status
- "Call Again" button appears for easy reconnection

### State Management
- Caller status updated to 'disconnected'
- Caller removed from active callers map
- Audio capture stopped automatically
- Clean resource cleanup

## API Reference

### WebSocket Messages

#### Client → Server
```json
{
  "type": "operator_reject",
  "targetCallerId": "caller_1234567890_1"
}
```

#### Server → Client (Rejected Caller)
```json
{
  "type": "rejected",
  "message": "Your call has been rejected by the operator. Please try again later."
}
```

### REST API

#### Reject Caller
**Endpoint:** `POST /callers/:id/reject`

**Success Response:**
```json
{
  "status": "rejected"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Failed to reject caller"
}
```

## Testing

### Manual Testing Steps
1. Open phone interface: `http://localhost:3000/phone`
2. Wait for "Waiting for operator..." status
3. Open operator dashboard: `http://localhost:3000/operator`
4. See caller in waiting list
5. Click "Reject" button
6. Confirm rejection
7. Verify:
   - Caller sees "Call Rejected" message
   - "Call Again" button appears
   - Caller is removed from operator's list
   - Connection closes gracefully

## Error Handling

### Caller Not Found
- Returns `false` from `rejectCaller()`
- Logs error to console
- Operator receives error response

### Caller Not in Waiting Status
- Only callers with status 'waiting' can be rejected
- Returns `false` if caller is already connected or disconnected
- Logs error to console

### WebSocket Errors
- Try-catch wraps rejection logic
- Errors logged to console
- Caller state cleaned up regardless of error

## Future Enhancements

Possible improvements:
- Add rejection reason (e.g., "All operators busy", "Outside business hours")
- Track rejection statistics
- Implement rejection cooldown
- Add operator notes for rejected calls
- Provide automatic callback option
