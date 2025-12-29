# Interswitch Key Exchange API Endpoints

This document describes the HTTP endpoints for managing Interswitch socket operations.

## Base URL

All endpoints are prefixed with `/interswitch`

## Endpoints

### 1. Trigger Key Exchange

Manually trigger a key exchange with Interswitch.

**Endpoint:** `POST /interswitch/key-exchange`

**Request:**
```bash
curl -X POST http://localhost:3000/interswitch/key-exchange \
  -H "Content-Type: application/json"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Key exchange triggered successfully",
  "timestamp": "2025-12-11T10:30:45.123Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Socket server handler is not initialized",
  "error": "..."
}
```

**Status Codes:**
- `200 OK` - Key exchange triggered successfully
- `500 Internal Server Error` - Failed to trigger key exchange
- `503 Service Unavailable` - Socket server handler not initialized

---

### 2. Trigger Echo Request

Manually trigger an echo request to Interswitch.

**Endpoint:** `POST /interswitch/echo`

**Request:**
```bash
curl -X POST http://localhost:3000/interswitch/echo \
  -H "Content-Type: application/json"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Echo request triggered successfully",
  "timestamp": "2025-12-11T10:30:45.123Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Socket server handler is not initialized",
  "error": "..."
}
```

**Status Codes:**
- `200 OK` - Echo request triggered successfully
- `500 Internal Server Error` - Failed to trigger echo
- `503 Service Unavailable` - Socket server handler not initialized

---

### 3. Get Socket Status

Check the status of the Interswitch socket connection.

**Endpoint:** `GET /interswitch/status`

**Request:**
```bash
curl -X GET http://localhost:3000/interswitch/status
```

**Response (Success):**
```json
{
  "success": true,
  "status": "available",
  "socketClosed": false,
  "timestamp": "2025-12-11T10:30:45.123Z"
}
```

**Response (Unavailable):**
```json
{
  "success": false,
  "message": "Socket server handler is not initialized",
  "status": "unavailable"
}
```

**Status Codes:**
- `200 OK` - Status retrieved successfully
- `500 Internal Server Error` - Failed to get status
- `503 Service Unavailable` - Socket server handler not initialized

---

## Usage Examples

### Using cURL

**Trigger Key Exchange:**
```bash
curl -X POST http://localhost:3000/interswitch/key-exchange
```

**Trigger Echo:**
```bash
curl -X POST http://localhost:3000/interswitch/echo
```

**Check Status:**
```bash
curl -X GET http://localhost:3000/interswitch/status
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

// Trigger Key Exchange
async function triggerKeyExchange() {
  try {
    const response = await axios.post('http://localhost:3000/interswitch/key-exchange');
    console.log('Key Exchange:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Trigger Echo
async function triggerEcho() {
  try {
    const response = await axios.post('http://localhost:3000/interswitch/echo');
    console.log('Echo:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Check Status
async function checkStatus() {
  try {
    const response = await axios.get('http://localhost:3000/interswitch/status');
    console.log('Status:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
```

### Using Python

```python
import requests

BASE_URL = "http://localhost:3000/interswitch"

# Trigger Key Exchange
def trigger_key_exchange():
    response = requests.post(f"{BASE_URL}/key-exchange")
    print(response.json())

# Trigger Echo
def trigger_echo():
    response = requests.post(f"{BASE_URL}/echo")
    print(response.json())

# Check Status
def check_status():
    response = requests.get(f"{BASE_URL}/status")
    print(response.json())
```

---

## Notes

- The key exchange is automatically triggered on socket connection (after 8 seconds)
- Echo requests are automatically scheduled every 55 seconds via cron
- These endpoints allow manual triggering for testing or maintenance purposes
- The socket server handler must be initialized before these endpoints can be used
- All operations are logged to the application logger

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details (only in development)"
}
```

---

## Security Considerations

**Important:** In production, these endpoints should be protected with authentication/authorization middleware to prevent unauthorized access.

Example with simple API key authentication:

```typescript
// Add to routes/Interswitch.ts
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.ADMIN_API_KEY) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};

router.post('/key-exchange', apiKeyAuth, triggerKeyExchange);
router.post('/echo', apiKeyAuth, triggerEcho);
```
