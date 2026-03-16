1

2

3

4

5

Unset
External Video Avatar Creation API
Specification

Consent Script
Every Video Avatar request must contain both training footage of the video avatar as well as a
video consent statement of the same person in the training footage. In the consent footage, the
subject must speak the following statement aloud:

“I, [full name], hereby allow HeyGen to use the footage of me to build a HeyGen Avatar for use
on the [partner name] platform.
Endpoints

1. Submit Video Avatar Creation Request
   Endpoint: POST /v2/video_avatar
   Description: Submit URLs for the required training footage and consent statement to create a
   video avatar. Optionally, specify an avatar name and an existing Avatar Group ID. If no group ID
   is provided, a new one will be created.
   Request
   ● Headers:

○ x-api-key: {API_KEY}
○ Content-Type: application/json
● Body (JSON):

{
Unset
"training_footage_url":
"https://example.com/training-footage.mp4", // Required: URL to
training footage
"consent_statement_url":
"https://example.com/consent-statement.mp4", // Required: URL to
consent statement
"avatar_name": "John Doe", // Required: Name of the avatar
"avatar_group_id":
"965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da97
6", // Optional: Existing Avatar Group ID
"callback_id": "callback_12345", // Optional: Unique identifier
for callback
"callback_url": "https://example.com/webhook" // Optional: URL
for asynchronous status updates
}
Response
● Status Code: 202 Accepted
● Body (JSON)
{
"avatar_id": "avatar_123",
"avatar_group_id":
"965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da97
6", // Existing or newly created
}

2. Check Video Avatar Generation Status
   Endpoint: GET /v2/video_avatar/id
   Description: Check the status of the avatar and details
   Request
   Unset
   Unset
   Unset
   ● Headers:
   ○ x-api-key: {API_KEY}
   Response
   ● Status Code: 200 OK
   ● Body (JSON):
   ○ If Avatar Generation is in Progress:
   {
   "status": "in_progress", // Possible values: in_progress,
   completed, failed
   "avatar_id": "avatar_123",
   "avatar_group_id":
   "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da97
   6"
   "other avatar details information"
   }
   ○ If Avatar Generation is Complete:
   {
   "avatar_id": "avatar_123",
   "status": "completed",
   "avatar_group_id":
   "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da97
   6"
   }
   ○ If Avatar Generation Failed:
   {
   "avatar_id": "avatar_123",
   "status": "failed",
   Unset
   "error": "Invalid training footage format.",
   "avatar_group_id":
   "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da97
   6"
   }
   Error Responses
   ● 404 Not Found: avatar ID not found.

Workflow

1.  Submit Training Footage and Consent Statement:
    Use the /v2/video_avatar endpoint to submit video URLs, specify an avatar name,
    and optionally assign it to an existing group or let the system create a new one. If
    callback_url is provided, notifications will be sent asynchronously.

2.  Check Avatar Creation Status:
    Use the /v2/video-avatar/{avatar_id} endpoint to monitor progress. If the
    Avatar ID exists, the status is returned. If it doesn’t, the call will return an error message.

3.  Callback Workflow (if applicable):
    If a callback_url is provided, the system will send a POST request to the specified
    URL upon completion or failure.
    Callback Payload:

{
"avatar_id": "avatar_123",
"status": "completed", // Possible values: completed, failed
"avatar_group_id":
"965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da97
6",
"callback_id": "callback_12345"
}

Technical Requirements

1.  Training Footage & Consent Statement URL Requirements:

○ Must be a publicly accessible or authenticated URL.
○ Format: .mp4 (H.264 codec preferred).
○ Resolution: Minimum 720p.
○ Training footage duration: Minimum 2 minutes.

2.  Callback Parameters (Optional):

○ callback_id: A user-provided unique identifier for tracking.
○ callback_url: A user-provided URL to receive status updates.
