# Enhanced AI Introduction Trigger System

## Overview
The AI introduction system has been significantly enhanced to provide more natural, context-aware greetings with better timing and customization options.

## Key Enhancements

### 1. Rich Context Awareness
The AI now receives comprehensive context about the call:
- **Time of Day**: Morning, afternoon, or evening
- **Day of Week**: Current weekday
- **Wait Time**: How long the caller has been waiting
- **Caller Information**: Name and phone number (if available)
- **Caller ID**: Unique identifier for tracking

### 2. Dynamic Greeting Adaptation
The AI adjusts its greeting based on wait time:

| Wait Time     | Acknowledgment                                          |
| ------------- | ------------------------------------------------------- |
| < 10 seconds  | "Thank you for calling"                                 |
| 10-30 seconds | "Thank you for your patience"                           |
| 30-60 seconds | "Thank you for waiting"                                 |
| > 60 seconds  | "Thank you very much for your patience during the wait" |

### 3. Improved Timing
- **Increased delay**: 500ms → 800ms
- **Reason**: Allows audio systems (both server and client) to fully initialize
- **Result**: More reliable audio playback, fewer missed introductions

## Implementation Details

### `triggerAIIntroduction()` Function

```typescript
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
3. Introduce yourself as AuraGuard, your company Hackuthin, and mention you support NexLink Solutions
4. Express genuine readiness to help
5. Ask an open-ended question: "How may I assist you today?" or "What brings you to us today?"

Guidelines:
- Speak naturally as if in a real phone conversation
- Use a warm, professional, and empathetic tone
- Keep the introduction brief (15-20 seconds)
- Make the customer feel valued and heard
- Be ready to listen actively after your introduction

Begin speaking now.`;

	caller.session.sendRealtimeInput({
		text: introPrompt
	});
	
	console.log(`✓ AI introduction triggered for ${caller.id} (waited ${waitTimeSeconds}s)`);
}
```

### Integration in `acceptCaller()`

```typescript
// Trigger AI introduction with enhanced context after brief delay
// The delay allows audio systems to fully initialize
setTimeout(() => {
	triggerAIIntroduction(caller);
}, 800); // Increased to 800ms for better audio system readiness
```

## Trigger Options

### Option 1: Auto-Trigger (Current - DEFAULT)
**When**: Automatically after operator accepts call
**Timing**: 800ms delay after connection
**Pros**: 
- Immediate greeting
- Consistent experience
- No dead air time
**Cons**:
- AI speaks first
- User might not be ready

**Implementation**: ✅ Already active

### Option 2: User-Speech Trigger (OPTIONAL)
**When**: When user first speaks after connection
**Timing**: Immediate upon first audio input
**Pros**:
- More natural interaction
- User initiates conversation
- AI responds to user
**Cons**:
- Potential awkward silence
- User might not know what to say

**Implementation**: 
```typescript
// In ws.on('message') handler, add:
if (caller.status === 'connected' && caller.session) {
	if (!(caller as any).aiHasIntroduced) {
		(caller as any).aiHasIntroduced = true;
		triggerAIIntroduction(caller);
	}
	
	// Then forward audio...
}
```

**To Enable**: Uncomment the block in `src/index.ts` around line 340

### Option 3: Hybrid Approach (RECOMMENDED FOR TESTING)
**When**: Auto-trigger with fallback
**Timing**: Auto at 2s, or immediately on user speech (whichever comes first)

**Implementation**:
```typescript
// In acceptCaller()
let introTriggered = false;
const autoTriggerTimeout = setTimeout(() => {
	if (!introTriggered && caller.session) {
		introTriggered = true;
		triggerAIIntroduction(caller);
	}
}, 2000); // Wait 2 seconds

// In ws.on('message')
if (caller.status === 'connected' && !introTriggered) {
	introTriggered = true;
	clearTimeout(autoTriggerTimeout);
	triggerAIIntroduction(caller);
}
```

## Example AI Introductions

### Short Wait (< 10 seconds)
```
"Good afternoon! Thank you for calling. This is AuraGuard from Hackuthin, 
supporting NexLink Solutions. I'm here and ready to help you today. 
How may I assist you?"
```

### Medium Wait (30-60 seconds)
```
"Good evening! Thank you for waiting. My name is AuraGuard, calling from 
Hackuthin on behalf of NexLink Solutions. I appreciate your patience and 
I'm ready to help resolve whatever you need today. What brings you to 
us this evening?"
```

### Long Wait (> 60 seconds)
```
"Hello! Thank you very much for your patience during the wait. This is 
AuraGuard from Hackuthin, your dedicated support for NexLink Solutions. 
I sincerely apologize for the delay, and I'm here now to give you my 
full attention. How can I help you today?"
```

## Context Data Flow

```
Caller Connects
     ↓
Operator Accepts
     ↓
AI Session Created
     ↓
Context Gathered:
  - Current time/day
  - Wait duration
  - Caller info
     ↓
Build Rich Prompt
     ↓
Send to AI (800ms delay)
     ↓
AI Processes Context
     ↓
AI Generates Natural Introduction
     ↓
Audio Response to Caller
```

## Customization Options

### Adjust Timing
```typescript
// In acceptCaller()
setTimeout(() => {
	triggerAIIntroduction(caller);
}, 800); // Change this value (in milliseconds)
```

**Recommendations**:
- **500ms**: Minimal delay, might miss audio setup
- **800ms**: Balanced (current default)
- **1000-1500ms**: Very safe, slight awkward pause
- **2000ms+**: Too long, uncomfortable silence

### Customize Greeting Style

Edit the `introPrompt` in `triggerAIIntroduction()`:

```typescript
const introPrompt = `[SYSTEM CONTEXT]
${contextInfo}

[INSTRUCTION]
// YOUR CUSTOM INSTRUCTIONS HERE

Guidelines:
// YOUR CUSTOM GUIDELINES
`;
```

### Add More Context

```typescript
// In triggerAIIntroduction()
const contextInfo = [
	`Current time: ${timeOfDay} on ${dayOfWeek}`,
	`Caller ID: ${caller.id}`,
	caller.name ? `Caller name: ${caller.name}` : null,
	caller.phoneNumber ? `Phone number: ${caller.phoneNumber}` : null,
	`Wait time: ${waitTimeSeconds} seconds`,
	`Previous calls: ${getPreviousCallCount(caller)}`, // Add custom data
	`Account status: ${getAccountStatus(caller)}`,      // Add custom data
].filter(Boolean).join('\n');
```

## Monitoring & Logging

### Console Logs

```bash
# Successful trigger
✓ AI introduction triggered for caller_1234567890_1 (waited 15s)

# Failed trigger
✗ Cannot trigger AI introduction: No session for caller_1234567890_2
```

### Track Introduction Timing

```typescript
// Add to triggerAIIntroduction()
const triggerTime = Date.now();
console.log(`Introduction trigger timing:
  - Caller connected: ${caller.connectedAt.getTime()}
  - Operator accepted: ${caller.acceptedAt?.getTime() || 'N/A'}
  - AI triggered: ${triggerTime}
  - Total delay: ${triggerTime - caller.connectedAt.getTime()}ms
`);
```

## Testing Scenarios

### Test 1: Quick Connection (< 10s wait)
1. Open phone page
2. Operator accepts immediately
3. **Expected**: "Thank you for calling..."
4. **Verify**: Greeting plays within 1 second

### Test 2: Medium Wait (30s)
1. Open phone page
2. Wait 30 seconds
3. Operator accepts
4. **Expected**: "Thank you for waiting..."
5. **Verify**: Wait time acknowledged

### Test 3: Long Wait (90s)
1. Open phone page
2. Wait 90 seconds
3. Operator accepts
4. **Expected**: "Thank you very much for your patience..."
5. **Verify**: Apology included

### Test 4: With Caller Info
1. Open phone with headers:
   ```javascript
   headers: {
     'x-caller-name': 'John Doe',
     'x-phone-number': '555-0123'
   }
   ```
2. **Expected**: AI has context about caller
3. **Verify**: Check logs for context info

## Performance Considerations

### Memory
- ✅ Minimal overhead (only context strings)
- ✅ No persistent storage required
- ✅ Context garbage collected after use

### Network
- ✅ Single text prompt (~500-800 bytes)
- ✅ No additional API calls
- ✅ Efficient data transfer

### Latency
- 800ms initial delay
- ~200-500ms AI processing
- ~500ms audio generation
- **Total**: ~1.5-2 seconds from accept to speech

## Troubleshooting

### AI Doesn't Speak
**Problem**: Silent after operator accepts
**Solutions**:
1. Check console for errors
2. Verify AI session is created
3. Increase delay to 1500ms
4. Check Gemini API key

### Introduction Too Fast
**Problem**: Audio cuts off at beginning
**Solution**: Increase delay from 800ms to 1000-1200ms

### Introduction Too Slow
**Problem**: Awkward silence before greeting
**Solution**: Decrease delay from 800ms to 500-600ms

### Wrong Time of Day
**Problem**: Says "good morning" at night
**Solution**: Check server timezone settings

### Generic Greeting
**Problem**: Doesn't use caller context
**Solution**: Verify caller info is being captured

## Future Enhancements

### Possible Improvements
1. **Personalized greetings** based on caller history
2. **Language detection** and multilingual support
3. **Mood detection** from wait time pattern
4. **A/B testing** different introduction styles
5. **Analytics** on greeting effectiveness
6. **Dynamic tone** based on time of day
7. **Holiday greetings** for special occasions
8. **VIP treatment** for premium customers

### Advanced Context
- Customer account status
- Previous call history
- Current service issues
- Ongoing promotions
- Weather in caller's location

## API Reference

### `triggerAIIntroduction(caller: Caller): void`

Triggers the AI to introduce itself with rich context.

**Parameters**:
- `caller`: Caller object with session and metadata

**Returns**: `void`

**Side Effects**:
- Sends text prompt to AI session
- Logs trigger event to console

**Example**:
```typescript
const caller = callers.get(callerId);
if (caller && caller.session) {
	triggerAIIntroduction(caller);
}
```

## Best Practices

1. **Always check session exists** before triggering
2. **Use appropriate delays** for audio initialization
3. **Include relevant context** but keep prompt concise
4. **Test with different wait times** to verify adaptation
5. **Monitor logs** for failed triggers
6. **Keep introduction brief** (15-20 seconds target)
7. **Maintain professional tone** across all scenarios
8. **Handle edge cases** (missing caller info, etc.)

## Configuration Summary

| Setting                 | Current Value | Range        | Recommendation  |
| ----------------------- | ------------- | ------------ | --------------- |
| Trigger Delay           | 800ms         | 500-2000ms   | 800-1000ms      |
| Max Introduction Length | 15-20s        | 10-30s       | 15-20s          |
| Wait Time Thresholds    | 10s, 30s, 60s | Customizable | Keep as-is      |
| Retry on Failure        | No            | N/A          | Consider adding |
| User Speech Trigger     | Disabled      | On/Off       | Optional        |
