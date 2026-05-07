# HeyGen Wrapper API - Complete Flow

## 🎨 FLOW 1: Create Avatar with 4 Looks

### Step 1: Call Create API

```bash
curl -X POST http://gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com/api/photo-avatars/create-with-looks \
  -F "image=@photo.jpg" \
  -F "name=John Doe"
```

### Step 2: Get Immediate Response (2 seconds)

```json
{
  "success": true,
  "group_id": "abc123xyz",
  "avatar_name": "John Doe",
  "training_status": "processing",
  "looks": [],
  "message": "Avatar created and training started! Poll the status endpoint to track progress.",
  "check_status_url": "/api/photo-avatars/status/abc123xyz"
}
```

**Save the `group_id`!**

### Step 3: Poll Status API (every 30 seconds for 6-8 minutes)

```bash
curl http://gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com/api/photo-avatars/status/abc123xyz
```

**While processing:**

```json
{
  "training": {"status": "processing"},
  "workflow_status": {
    "percent_complete": 45,
    "ready_for_looks": false
  }
}
```

### Step 4: Final Response (when complete)

```json
{
  "group_id": "abc123xyz",
  "training": {
    "status": "ready",
    "is_complete": true
  },
  "avatar": {
    "name": "John Doe",
    "status": "completed"
  },
  "looks": {
    "count": 4,
    "list": [
      {
        "id": "look1",
        "name": "Professional Look 1",
        "image_url": "https://heygen.ai/looks/1.jpg",
        "status": "completed"
      },
      {
        "id": "look2",
        "name": "Casual Look 2",
        "image_url": "https://heygen.ai/looks/2.jpg",
        "status": "completed"
      },
      {
        "id": "look3",
        "name": "Formal Look 3",
        "image_url": "https://heygen.ai/looks/3.jpg",
        "status": "completed"
      },
      {
        "id": "look4",
        "name": "Business Casual Look 4",
        "image_url": "https://heygen.ai/looks/4.jpg",
        "status": "completed"
      }
    ]
  },
  "workflow_status": {
    "percent_complete": 100,
    "ready_for_video": true,
    "ready_for_looks": true
  }
}
```

**Done! You have 4 professional look images.**

---

## API Reference

### Create Avatar with Looks

| Field | Description |
|-------|-------------|
| `image` | Photo file (JPG/PNG) |
| `name` | Avatar name |
| `prompt` | (Optional) Style prompt |
| `orientation` | `square`, `portrait`, `landscape` |
| `pose` | `half_body`, `full_body` |
| `style` | `Realistic`, `Artistic` |

### Status Response Fields

| Field | Description |
|-------|-------------|
| `training.status` | `pending`, `processing`, `ready`, `failed` |
| `training.is_complete` | Boolean - training done |
| `looks.count` | Number of looks generated |
| `looks.list` | Array of look objects |
| `workflow_status.percent_complete` | 0-100% progress |
| `workflow_status.ready_for_video` | Boolean - can generate video |
