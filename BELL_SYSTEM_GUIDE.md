# 🔔 Bell Notification System

## Overview
YouTube-style bell notification system that allows users to subscribe to post notifications from specific users they follow.

## Features Implemented

### 1. **Backend API** ✅
- **Database Model**: `BellSubscription` table stores bell preferences
- **Endpoints**:
  - `POST /api/follows/:userId/bell` - Toggle bell subscription
  - `GET /api/users/:userId` - Returns `bellEnabled` status

### 2. **Frontend Components** ✅
- **BellToggle Component**: Reusable component for toggling bell notifications
- **UserProfile Integration**: Shows bell icon next to follow button
- **Authentication**: Properly handles auth tokens

### 3. **Notification Flow** ✅
When a user creates a post:
1. System finds all users with bell subscriptions
2. Sends `BELL_POST` notification to subscribers only
3. Regular followers get NO notification
4. Priority: HIGH (PUSH + EMAIL channels)

---

## User Experience

### Three Relationship Levels:

| Relationship | See Posts | Get Like/Comment Notifications | Get New Post Notifications |
|--------------|-----------|-------------------------------|---------------------------|
| **Stranger** | ❌ | ❌ | ❌ |
| **Follower** | ✅ | ✅ | ❌ |
| **Bell Subscriber** | ✅ | ✅ | ✅ 🔔 |

---

## How to Use

### For Users:
1. **Follow a user** first (required)
2. **Click the bell icon** next to the Following button
3. **Bell turns purple** when enabled (🔔)
4. **Bell turns gray** when disabled (🔕)

### Visual States:
- 🔔 **Purple bell (filled)**: Notifications ON - You'll get notified of new posts
- 🔕 **Gray bell (outlined)**: Notifications OFF - No post notifications
- **No bell shown**: You're not following this user

---

## Component Usage

### BellToggle Component Props:

```tsx
<BellToggle
  userId="user-id-here"           // Required: Target user ID
  isFollowing={true}              // Required: Must be following
  bellEnabled={false}             // Required: Current bell state
  onToggle={(newState) => {...}}  // Optional: Callback on toggle
  size="medium"                   // Optional: 'small' | 'medium' | 'large'
  variant="icon"                  // Optional: 'icon' | 'button'
/>
```

### Example - Icon Variant (Default):
```tsx
<BellToggle
  userId={user.id}
  isFollowing={user.isFollowing}
  bellEnabled={user.bellEnabled}
  onToggle={(enabled) => setUser({...user, bellEnabled: enabled})}
/>
```

### Example - Button Variant:
```tsx
<BellToggle
  userId={user.id}
  isFollowing={user.isFollowing}
  bellEnabled={user.bellEnabled}
  variant="button"
  size="large"
/>
```

---

## Backend Implementation

### Database Schema:
```prisma
model BellSubscription {
  id              String   @id @default(uuid())
  subscriberId    String   // Who wants notifications
  targetUserId    String   // Whose posts to notify about
  createdAt       DateTime @default(now())
  
  @@unique([subscriberId, targetUserId])
}
```

### API Endpoint:
```typescript
POST /api/follows/:userId/bell
Authorization: Bearer <token>

Response:
{
  "success": true,
  "bellEnabled": true  // New state
}
```

### Error Cases:
- **400 Bad Request**: User must follow first before enabling bell
- **401 Unauthorized**: Missing or invalid auth token
- **500 Internal Error**: Database error

---

## Notification Logic

### Post Creation Flow:
```typescript
// In postRoutes.ts - when user creates a post

1. Find all bell subscribers:
   const bellSubscribers = await prisma.bellSubscription.findMany({
     where: { targetUserId: authorId }
   })

2. Send BELL_POST notification to each subscriber:
   - Type: 'BELL_POST'
   - Priority: 'HIGH'
   - Channels: ['PUSH', 'EMAIL']
   - Message: "{Author} posted: {caption}"
```

### Why Bell Notifications?
- **Reduces notification fatigue**: Only interested users get post notifications
- **Higher engagement**: Subscribers are more likely to interact
- **User control**: Users decide which creators to follow closely
- **Similar to YouTube**: Familiar UX pattern

---

## Testing the Feature

### Manual Testing Steps:

1. **Login as User A**
2. **Follow User B**
3. **Click bell icon** on User B's profile (should turn purple)
4. **Login as User B**
5. **Create a new post**
6. **Check User A's notifications** - should see "User B posted: ..."

### Expected Behavior:
- ✅ Bell icon appears only when following
- ✅ Bell toggles between enabled/disabled
- ✅ Icon fills with purple when enabled
- ✅ BELL_POST notifications sent within 30-60 seconds
- ✅ Notification includes post preview

---

## Architecture

```
User Profile → Follow User → Bell Icon Appears
                                    ↓
                            Click Bell Toggle
                                    ↓
                          POST /api/follows/:userId/bell
                                    ↓
                          BellSubscription Created
                                    ↓
                          User Creates Post
                                    ↓
                    Find All Bell Subscribers
                                    ↓
              Send BELL_POST to Ingestion Service
                                    ↓
                        Kafka HIGH Topic
                                    ↓
                    Processing Service (30-60s)
                                    ↓
                    Socket Service (Real-time)
                                    ↓
                Frontend Notification Bell 🔔
```

---

## Current Limitations

1. **No bulk operations**: Can't enable bell for all followed users at once
2. **No bell status in feed**: Only visible on user profiles
3. **No notification preferences**: Can't disable specific notification types

## Future Enhancements

- [ ] Add bell status indicator in feed posts
- [ ] Bulk enable/disable bell for multiple users
- [ ] Notification settings page with bell preferences
- [ ] Bell notification analytics (who has bell enabled)
- [ ] Push notification for bell subscription confirmation
- [ ] Auto-enable bell for close friends

---

## Troubleshooting

### Bell icon not appearing?
- Ensure you're following the user first
- Check that `bellEnabled` is returned from API
- Verify authentication token is valid

### Bell toggle not working?
- Check browser console for errors
- Verify API endpoint is accessible
- Ensure you're following the user

### Not receiving bell notifications?
- Check if bell is enabled (purple icon)
- Wait 30-60 seconds for aggregation window
- Verify processing service is running
- Check socket connection in browser DevTools

---

## Related Files

### Frontend:
- `frontend/src/components/BellToggle.tsx` - Reusable bell component
- `frontend/src/components/UserProfile.tsx` - Profile page with bell
- `frontend/src/types/index.ts` - Type definitions

### Backend:
- `backend/social-api/src/routes/followRoutes.ts` - Bell toggle endpoint
- `backend/social-api/src/routes/postRoutes.ts` - Send BELL_POST notifications
- `backend/social-api/src/routes/userRoutes.ts` - Return bell status
- `backend/social-api/prisma/schema.prisma` - Database schema

---

## Summary

✅ **Fully Functional** - Bell subscription system is complete
✅ **User Control** - Users decide who to get post notifications from
✅ **Backend Integration** - Properly connected to notification system
✅ **UI/UX** - Clean, intuitive interface with visual feedback
