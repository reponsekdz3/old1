# Call Participant Management API Documentation

## Overview
The Call Participant Management API provides comprehensive backend endpoints for managing call participants in VipChat, supporting both peer-to-peer and group calls with advanced role-based access control, media quality management, and real-time participant tracking.

## Architecture

### Components
- **CallParticipant Model** - Database model tracking individual participant state
- **Enhanced Call Model** - Extended to support group calls with participant management
- **SFUMediaServer** - In-memory media room management with participant role enforcement
- **call_management.py** - REST API endpoints for participant operations
- **sfu_routes.py** - WebSocket event handlers for real-time participant updates

### Design Principles
- **Role-Based Access Control** - Host-only operations are strictly validated
- **State Synchronization** - Database and in-memory states kept in sync
- **Real-Time Broadcasting** - WebSocket events notify all participants of changes
- **Comprehensive Logging** - All operations logged for audit trails
- **Production-Grade Error Handling** - Specific error codes and messages for each scenario

---

## REST API Endpoints

### 1. Get All Participants
**GET** `/api/calls/{call_id}/participants`

Retrieve all participants in a call with their status and media states.

**Required**
- Authentication: JWT token
- Authorization: User must be a participant in the call

**Response (200)**
```json
{
  "call_id": "call-123",
  "status": "answered",
  "participants_count": 5,
  "room_id": "room-abc",
  "participants": [
    {
      "id": "participant-id",
      "user_id": "user-123",
      "user_name": "John Doe",
      "user_avatar": "https://...",
      "role": "host",
      "status": "joined",
      "audio_enabled": true,
      "video_enabled": true,
      "screen_share": false,
      "video_quality": "high",
      "bandwidth_limit": 5000,
      "is_muted": false,
      "is_video_muted": false,
      "joined_at": "2024-01-15T10:30:00Z",
      "left_at": null,
      "duration": 120,
      "invited_at": "2024-01-15T10:25:00Z",
      "responded_at": "2024-01-15T10:28:00Z"
    }
  ]
}
```

**Error Responses**
- `404` - Call not found
- `403` - User not authorized to view this call

---

### 2. Add Participant
**POST** `/api/calls/{call_id}/add-participant`

Add a new participant to the call. Only the call host can perform this operation.

**Required**
- Authentication: JWT token
- Authorization: Caller must be the call host

**Request Body**
```json
{
  "user_id": "user-456",
  "role": "participant"
}
```

**Parameters**
- `user_id` (string, required) - ID of user to add
- `role` (string, optional) - Role for participant: "participant" or "viewer" (default: "participant")

**Response (201)**
```json
{
  "message": "Participant added successfully",
  "participant": {
    "id": "participant-id",
    "call_id": "call-123",
    "user_id": "user-456",
    "user_name": "Jane Smith",
    "user_avatar": "https://...",
    "role": "participant",
    "status": "invited",
    "audio_enabled": true,
    "video_enabled": true,
    "screen_share": false,
    "video_quality": "medium",
    "bandwidth_limit": 2500,
    "is_muted": false,
    "is_video_muted": false,
    "joined_at": null,
    "left_at": null,
    "duration": 0,
    "invited_at": "2024-01-15T10:30:00Z",
    "responded_at": null
  }
}
```

**Error Responses**
- `400` - Missing user_id or invalid role
- `403` - Only host can add participants
- `404` - Call not found or target user not found
- `409` - Participant already in call or call at max capacity

---

### 3. Remove Participant
**POST** `/api/calls/{call_id}/remove-participant`

Remove a participant from the call. Only the call host can perform this operation.

**Required**
- Authentication: JWT token
- Authorization: Caller must be the call host

**Request Body**
```json
{
  "user_id": "user-456"
}
```

**Parameters**
- `user_id` (string, required) - ID of participant to remove

**Response (200)**
```json
{
  "message": "Participant removed successfully",
  "participant": {
    "id": "participant-id",
    "call_id": "call-123",
    "user_id": "user-456",
    "user_name": "Jane Smith",
    "role": "participant",
    "status": "left",
    "audio_enabled": true,
    "video_enabled": true,
    "joined_at": "2024-01-15T10:28:00Z",
    "left_at": "2024-01-15T10:35:00Z",
    "duration": 420
  }
}
```

**Error Responses**
- `403` - Only host can remove participants
- `404` - Call not found or participant not in call
- `400` - Cannot remove host

---

### 4. Promote Participant
**POST** `/api/calls/{call_id}/promote-participant`

Promote a participant to host role. Only the current call host can perform this operation.

**Required**
- Authentication: JWT token
- Authorization: Caller must be the call host

**Request Body**
```json
{
  "user_id": "user-456"
}
```

**Parameters**
- `user_id` (string, required) - ID of participant to promote

**Response (200)**
```json
{
  "message": "Participant promoted to host",
  "participant": {
    "id": "participant-id",
    "call_id": "call-123",
    "user_id": "user-456",
    "user_name": "Jane Smith",
    "role": "host",
    "status": "joined",
    "audio_enabled": true,
    "video_enabled": true
  }
}
```

**Error Responses**
- `403` - Only host can promote participants
- `404` - Participant not found in call
- `409` - Cannot promote participant with current status
- `400` - Cannot promote yourself

---

### 5. Mute Participant
**POST** `/api/calls/{call_id}/mute-participant`

Mute or unmute a participant's audio or video. Host can mute anyone; participants can only mute/unmute themselves.

**Required**
- Authentication: JWT token
- Authorization: Self-only or host

**Request Body**
```json
{
  "user_id": "user-456",
  "mute_audio": true,
  "mute_video": false
}
```

**Parameters**
- `user_id` (string, required) - ID of participant to mute
- `mute_audio` (boolean, optional) - Mute audio (default: false)
- `mute_video` (boolean, optional) - Mute video (default: false)

**Response (200)**
```json
{
  "message": "Participant mute state updated",
  "participant": {
    "id": "participant-id",
    "user_id": "user-456",
    "user_name": "Jane Smith",
    "audio_enabled": false,
    "video_enabled": true,
    "is_muted": true,
    "is_video_muted": false
  }
}
```

**Error Responses**
- `400` - mute_audio/mute_video must be boolean
- `403` - Only host can mute other participants
- `404` - Participant not found

---

### 6. Update Video Quality
**POST** `/api/calls/{call_id}/update-quality`

Update video quality and bandwidth limit for a participant. Host can update anyone; participants can only update themselves.

**Required**
- Authentication: JWT token
- Authorization: Self-only or host

**Request Body**
```json
{
  "user_id": "user-456",
  "quality": "high"
}
```

**Parameters**
- `user_id` (string, required) - ID of participant
- `quality` (string, required) - Quality level: "low", "medium", or "high"

**Quality Profiles**
| Quality | Resolution | Bandwidth |
|---------|-----------|-----------|
| low     | 320x240   | 500 kbps  |
| medium  | 640x480   | 2500 kbps |
| high    | 1280x720  | 5000 kbps |

**Response (200)**
```json
{
  "message": "Video quality updated",
  "quality": "high",
  "bandwidth_limit": 5000,
  "resolution": "1280x720",
  "participant": {
    "id": "participant-id",
    "user_id": "user-456",
    "video_quality": "high",
    "bandwidth_limit": 5000
  }
}
```

**Error Responses**
- `400` - Quality must be low, medium, or high
- `403` - Only host can update quality for other participants
- `404` - Participant not found

---

### 7. Get Call State
**GET** `/api/calls/{call_id}/state`

Get complete call state including all participants and room information.

**Required**
- Authentication: JWT token
- Authorization: User must be a participant in the call

**Response (200)**
```json
{
  "id": "call-123",
  "caller_id": "user-123",
  "caller_name": "John Doe",
  "group_id": "group-456",
  "call_type": "video",
  "call_mode": "group",
  "status": "answered",
  "duration": 120,
  "room_id": "room-abc",
  "recording": true,
  "max_participants": 50,
  "participants_count": 5,
  "started_at": "2024-01-15T10:25:00Z",
  "ended_at": null,
  "participants": [...],
  "room_state": {
    "room_id": "room-abc",
    "host_user_id": 123,
    "participants_count": 5,
    "recording": true,
    "created_at": "2024-01-15T10:25:00Z",
    "participants": [...],
    "invitations": {...}
  }
}
```

**Error Responses**
- `404` - Call not found
- `403` - User not authorized to view this call

---

### 8. Get Participant Details
**GET** `/api/calls/{call_id}/participants/{participant_id}`

Get detailed information about a specific participant.

**Required**
- Authentication: JWT token
- Authorization: User must be a participant in the call

**Response (200)**
```json
{
  "id": "participant-id",
  "call_id": "call-123",
  "user_id": "user-456",
  "user_name": "Jane Smith",
  "user_avatar": "https://...",
  "role": "participant",
  "status": "joined",
  "audio_enabled": true,
  "video_enabled": true,
  "screen_share": false,
  "video_quality": "high",
  "bandwidth_limit": 5000,
  "is_muted": false,
  "is_video_muted": false,
  "joined_at": "2024-01-15T10:28:00Z",
  "left_at": null,
  "duration": 180,
  "invited_at": "2024-01-15T10:25:00Z",
  "responded_at": "2024-01-15T10:27:00Z"
}
```

**Error Responses**
- `404` - Call or participant not found
- `403` - Not authorized to view this call

---

### 9. Update Participant Media
**POST** `/api/calls/{call_id}/update-media`

Update your own media state (audio/video/screen share). Self-only operation.

**Required**
- Authentication: JWT token

**Request Body**
```json
{
  "audio_enabled": true,
  "video_enabled": false,
  "screen_share": false
}
```

**Parameters**
- `audio_enabled` (boolean, optional) - Enable/disable audio
- `video_enabled` (boolean, optional) - Enable/disable video
- `screen_share` (boolean, optional) - Enable/disable screen sharing

**Response (200)**
```json
{
  "message": "Media state updated",
  "participant": {
    "id": "participant-id",
    "user_id": "current-user",
    "audio_enabled": true,
    "video_enabled": false,
    "screen_share": false
  }
}
```

**Error Responses**
- `404` - You are not in this call
- `400` - Request body is required

---

## WebSocket Events

### Real-Time Participant Events

All WebSocket events use the `sfu_` namespace prefix and are broadcast to all participants in the room.

#### Invite Participant
**Emit Event** `sfu_invite_participant`

```json
{
  "room_id": "room-abc",
  "target_user_id": "user-789",
  "sender_user_id": "user-123"
}
```

**Broadcast Event** `sfu_participant_invited`
```json
{
  "target_user_id": "user-789",
  "invited_by": "user-123",
  "room_id": "room-abc"
}
```

**Authorization** - Only host can invite

---

#### Promote to Host
**Emit Event** `sfu_promote_to_host`

```json
{
  "room_id": "room-abc",
  "target_user_id": "user-789",
  "sender_user_id": "user-123"
}
```

**Broadcast Event** `sfu_participant_promoted`
```json
{
  "promoted_user_id": "user-789",
  "promoted_by": "user-123",
  "room_id": "room-abc"
}
```

**Authorization** - Only host can promote

---

#### Remove Participant
**Emit Event** `sfu_remove_participant`

```json
{
  "room_id": "room-abc",
  "target_user_id": "user-789",
  "sender_user_id": "user-123"
}
```

**Broadcast Event** `sfu_participant_removed`
```json
{
  "removed_user_id": "user-789",
  "removed_by": "user-123",
  "room_id": "room-abc"
}
```

**Authorization** - Only host can remove

---

#### Mute Participant
**Emit Event** `sfu_mute_participant`

```json
{
  "room_id": "room-abc",
  "target_user_id": "user-789",
  "sender_user_id": "user-123",
  "mute_audio": true,
  "mute_video": false
}
```

**Broadcast Event** `sfu_participant_muted`
```json
{
  "user_id": "user-789",
  "mute_audio": true,
  "mute_video": false,
  "room_id": "room-abc"
}
```

**Authorization** - Host for others, self for own

---

#### Update Video Quality
**Emit Event** `sfu_update_quality`

```json
{
  "room_id": "room-abc",
  "target_user_id": "user-789",
  "sender_user_id": "user-123",
  "quality": "high"
}
```

**Broadcast Event** `sfu_participant_quality_updated`
```json
{
  "user_id": "user-789",
  "quality": "high",
  "room_id": "room-abc"
}
```

**Authorization** - Host for others, self for own

---

#### Get Room State
**Emit Event** `sfu_get_room_state`

```json
{
  "room_id": "room-abc"
}
```

**Response Event** `sfu_room_state`
```json
{
  "room_id": "room-abc",
  "call_id": "call-123",
  "host_user_id": 123,
  "participants_count": 5,
  "max_participants": 50,
  "recording": true,
  "e2ee_enabled": true,
  "created_at": "2024-01-15T10:25:00Z",
  "participants": [...],
  "invitations": {...}
}
```

---

## Database Models

### Call Model
```python
class Call(db.Model):
    id: str (PK)
    caller_id: str (FK)
    receiver_id: str (FK, nullable for group calls)
    group_id: str (FK, nullable)
    call_type: str (voice, video)
    call_mode: str (peer, group)
    status: str (initiated, ringing, answered, ended, missed)
    duration: int (seconds)
    room_id: str (SFU room reference)
    recording: bool
    recording_url: str
    max_participants: int
    started_at: datetime
    ended_at: datetime (nullable)
```

### CallParticipant Model
```python
class CallParticipant(db.Model):
    id: str (PK)
    call_id: str (FK)
    user_id: str (FK)
    role: str (host, participant, viewer)
    status: str (invited, joined, left, declined)
    audio_enabled: bool
    video_enabled: bool
    screen_share: bool
    video_quality: str (low, medium, high)
    bandwidth_limit: int (kbps)
    socket_id: str (for SFU tracking)
    joined_at: datetime (nullable)
    left_at: datetime (nullable)
    duration: int (seconds)
    is_muted: bool
    is_video_muted: bool
    invited_at: datetime
    responded_at: datetime (nullable)
```

---

## Role-Based Access Control

### Roles
- **host** - Can invite, remove, promote, mute, and control quality for all participants
- **participant** - Can speak, share video/screen, can only control own media state
- **viewer** - Read-only access, no media transmission

### Host-Only Operations
1. Add participants to call
2. Remove participants from call
3. Promote participants to host
4. Mute other participants
5. Update quality for other participants

### Self-Only Operations
1. Update own media state (audio/video/screen)
2. Leave the call

---

## Error Handling

All endpoints return standard HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Resource created |
| 400 | Bad request (validation error) |
| 403 | Forbidden (authorization failure) |
| 404 | Not found |
| 409 | Conflict (state violation) |
| 500 | Server error |

Error response format:
```json
{
  "error": "Description of what went wrong"
}
```

---

## Logging and Audit Trail

All operations are logged with:
- Operation timestamp
- User ID performing the action
- Target participant/call
- Action details
- Success/failure status

Logs are prefixed with `[CALL_MGMT]` for easy filtering.

---

## Best Practices

### For Clients
1. Always verify JWT token is valid before making requests
2. Handle connection failures gracefully
3. Listen to WebSocket broadcasts for real-time updates
4. Cache participant list locally and update on broadcast events
5. Implement exponential backoff for retries

### For Security
1. Only hosts should be able to invite/remove participants
2. Validate user authorization on every host-only operation
3. Never trust client-provided role values
4. Log all participant management actions for audit
5. Rate-limit participant management endpoints

### For Performance
1. Use video quality "low" for poor network conditions
2. Implement bandwidth monitoring client-side
3. Cache call state locally and only refresh on changes
4. Use WebSocket for real-time updates instead of polling

---

## Integration Example

```javascript
// Initialize call
const callId = "call-123";
const token = "jwt-token";

// Get all participants
const response = await fetch(`/api/calls/${callId}/participants`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// Add participant (host only)
const addResponse = await fetch(`/api/calls/${callId}/add-participant`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: "user-456",
    role: "participant"
  })
});

// Listen to real-time updates
socket.on('sfu_participant_invited', (data) => {
  console.log(`Participant ${data.target_user_id} was invited`);
});

// Mute participant
const muteResponse = await fetch(`/api/calls/${callId}/mute-participant`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: "user-456",
    mute_audio: true
  })
});
```

---

## Migration and Deployment

To deploy the call participant management system:

```bash
# Run database migrations
python backend/migrate.py

# Restart Flask application
# The blueprints will be automatically registered
```

The migration will:
1. Create `calls` table (enhanced with group call support)
2. Create `call_participants` table with all required fields
3. Create optimal indices for query performance
4. Initialize role-based access control

---

## Testing Checklist

- [ ] Add participant with valid user
- [ ] Add participant with invalid user
- [ ] Add participant without host privileges
- [ ] Remove participant as host
- [ ] Remove participant as non-host
- [ ] Promote participant as host
- [ ] Promote participant as non-host
- [ ] Mute/unmute own audio
- [ ] Mute/unmute other participant as host
- [ ] Mute/unmute other participant as non-host
- [ ] Update quality for self
- [ ] Update quality for others as host
- [ ] Get participant list as authorized member
- [ ] Get participant list as unauthorized user
- [ ] Handle call not found
- [ ] Handle participant not found
- [ ] Handle database errors gracefully

---

## Support and Troubleshooting

### Common Issues

**Q: "Only the call host can add participants" error**
A: Ensure you're using the correct user ID and that they are the call initiator.

**Q: WebSocket events not received**
A: Verify Socket.IO connection is established and listen to the `sfu_` prefixed events.

**Q: Video quality doesn't update**
A: Ensure the participant exists in the call and the quality value is one of: low, medium, high.

---

## Version History

- **v1.0** (2024-01-15) - Initial production release
  - Complete participant management API
  - Role-based access control
  - Video quality management
  - Real-time WebSocket events
  - Comprehensive audit logging
