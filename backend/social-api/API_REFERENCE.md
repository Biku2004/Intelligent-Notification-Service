# Social API Quick Reference

## Base URL
```
http://localhost:3003
```

## Authentication
All authenticated endpoints require JWT token in header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 🔐 Authentication Endpoints

### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "password123",
  "name": "John Doe"  // Optional
}

Response:
{
  "success": true,
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 👤 User Endpoints

### Get User Profile
```http
GET /api/users/:userId
Authorization: Bearer <token>  // Optional

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "name": "John Doe",
    "bio": "Hello world",
    "avatarUrl": "https://...",
    "postsCount": 10,
    "followersCount": 100,
    "followingCount": 50,
    "isFollowing": true,  // Only if authenticated
    "bellEnabled": false
  }
}
```

### Update Profile
```http
PATCH /api/users/:userId
Authorization: Bearer <token>  // Required
Content-Type: application/json

{
  "name": "New Name",
  "bio": "Updated bio",
  "avatarUrl": "https://..."
}
```

### Search Users
```http
GET /api/users?q=john

Response:
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "username": "johndoe",
      "name": "John Doe",
      "avatarUrl": "https://...",
      "followersCount": 100
    }
  ]
}
```

---

## 📝 Post Endpoints

### Create Post
```http
POST /api/posts
Authorization: Bearer <token>  // Required
Content-Type: application/json

{
  "caption": "Beautiful sunset!",
  "imageUrl": "https://images.unsplash.com/..."
}

Response:
{
  "success": true,
  "post": {
    "id": "uuid",
    "userId": "uuid",
    "caption": "...",
    "imageUrl": "...",
    "likesCount": 0,
    "commentsCount": 0,
    "user": { ... },
    "createdAt": "2025-12-30T..."
  }
}
```

### Get Single Post
```http
GET /api/posts/:postId
Authorization: Bearer <token>  // Optional

Response:
{
  "success": true,
  "post": {
    "id": "uuid",
    "caption": "...",
    "imageUrl": "...",
    "likesCount": 10,
    "commentsCount": 5,
    "isLiked": true,  // Only if authenticated
    "user": { ... }
  }
}
```

### Get Feed Posts
```http
GET /api/posts?page=1&limit=10&userId=<optional>
Authorization: Bearer <token>  // Optional

Response:
{
  "success": true,
  "posts": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Like/Unlike Post
```http
POST /api/posts/:postId/like
Authorization: Bearer <token>  // Required

Response:
{
  "success": true,
  "liked": true,  // or false if unliked
  "likesCount": 11
}
```

### Delete Post
```http
DELETE /api/posts/:postId
Authorization: Bearer <token>  // Required (own posts only)

Response:
{
  "success": true,
  "message": "Post deleted"
}
```

---

## 💬 Comment Endpoints

### Add Comment
```http
POST /api/comments
Authorization: Bearer <token>  // Required
Content-Type: application/json

{
  "postId": "uuid",
  "content": "Great photo!",
  "gifUrl": "https://..."  // Optional
}

Response:
{
  "success": true,
  "comment": {
    "id": "uuid",
    "postId": "uuid",
    "content": "Great photo!",
    "user": { ... },
    "createdAt": "..."
  }
}
```

### Reply to Comment
```http
POST /api/comments/:commentId/reply
Authorization: Bearer <token>  // Required
Content-Type: application/json

{
  "content": "Thanks!",
  "gifUrl": "https://..."  // Optional
}
```

### Get Comments
```http
GET /api/comments?postId=<uuid>

Response:
{
  "success": true,
  "comments": [
    {
      "id": "uuid",
      "content": "...",
      "user": { ... },
      "replies": [
        {
          "id": "uuid",
          "content": "...",
          "user": { ... }
        }
      ]
    }
  ]
}
```

### Delete Comment
```http
DELETE /api/comments/:commentId
Authorization: Bearer <token>  // Required (own comments only)
```

---

## 👥 Follow Endpoints

### Follow/Unfollow User
```http
POST /api/follows/:userId
Authorization: Bearer <token>  // Required

Response:
{
  "success": true,
  "following": true  // or false if unfollowed
}
```

### Get Followers
```http
GET /api/follows/:userId/followers

Response:
{
  "success": true,
  "followers": [
    {
      "id": "uuid",
      "username": "...",
      "name": "...",
      "avatarUrl": "..."
    }
  ]
}
```

### Get Following
```http
GET /api/follows/:userId/following

Response:
{
  "success": true,
  "following": [...]
}
```

### Toggle Bell Subscription
```http
POST /api/follows/:userId/bell
Authorization: Bearer <token>  // Required (must be following first)

Response:
{
  "success": true,
  "bellEnabled": true
}
```

---

## 🔔 Notification Trigger Flow

When a user **likes a post**, here's what happens:

1. Frontend calls: `POST /api/posts/:postId/like`
2. Social API creates Like record
3. Social API sends event to Kafka:
```javascript
{
  id: 'uuid',
  type: 'LIKE',
  priority: 'LOW',
  actorId: 'user_who_liked',
  actorName: 'John Doe',
  targetId: 'post_owner_id',
  targetType: 'POST',
  targetEntityId: 'post_id',
  message: 'John Doe liked your post',
  timestamp: '2025-12-30T...'
}
```
4. Processing Service aggregates likes
5. Socket Service delivers real-time notification
6. Email Service sends email (if enabled)

---

## 🧪 Testing with cURL

### Register
```bash
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "test123",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

### Create Post (with token)
```bash
curl -X POST http://localhost:3003/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "caption": "My first post!",
    "imageUrl": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"
  }'
```

---

## 🔥 Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Caption or image required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Cannot delete another user's post"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Post not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "Email already registered"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 📱 Frontend Integration Examples

### Using with Axios
```typescript
import axios from 'axios';

// Set base URL
const API = axios.create({
  baseURL: 'http://localhost:3003'
});

// Login
const { data } = await API.post('/api/auth/login', {
  email: 'user@example.com',
  password: 'password123'
});

// Store token
localStorage.setItem('token', data.token);

// Set auth header for all requests
API.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

// Create post (automatically includes auth header)
const post = await API.post('/api/posts', {
  caption: 'Hello world!',
  imageUrl: 'https://...'
});
```

---

## 🎯 Rate Limiting (Future Enhancement)

Currently no rate limiting. Future implementation:
- 100 requests/minute per IP
- 1000 requests/hour per user
- Burst allowance: 20 requests in 10 seconds

---

## 🔐 Security Best Practices

1. **Never expose JWT_SECRET** - Keep it in .env file
2. **Use HTTPS** in production
3. **Hash passwords** - Already done with bcrypt (10 rounds)
4. **Validate input** - Check email format, username length, etc.
5. **Sanitize data** - Prevent SQL injection (Prisma handles this)
6. **Set token expiry** - Default 7 days, adjust as needed
7. **Implement refresh tokens** - For better security (future)

---

**📚 For complete documentation, see SOCIAL_PLATFORM_COMPLETE.md**
