/**
 * User Profile Component
 * Displays user information, posts, followers, and follow button
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Calendar, Settings as SettingsIcon, Save, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BellToggle } from './BellToggle';
import type { User, Post } from '../types';
import { SOCIAL_API_URL } from '../config/api';

interface UserProfileProps {
  userId: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following'>('posts');
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);

  const isOwnProfile = currentUser?.id === userId;

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem('authToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch user profile with auth to get bellEnabled status
      const userResponse = await axios.get(`${SOCIAL_API_URL}/api/users/${userId}`, { headers });
      if (userResponse.data.success) {
        setUser(userResponse.data.user);
      }

      // Fetch user's posts
      const postsResponse = await axios.get(`${SOCIAL_API_URL}/api/posts`, {
        params: { userId, limit: 12 }
      });
      if (postsResponse.data.success) {
        setPosts(postsResponse.data.posts);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load user data:', error);
      setLoading(false);
    }
  }, [userId]);

  const fetchFollowers = useCallback(async () => {
    try {
      const response = await axios.get(`${SOCIAL_API_URL}/api/follows/${userId}/followers`);
      if (response.data.success) {
        setFollowers(response.data.followers);
      }
    } catch (error) {
      console.error('Failed to load followers:', error);
    }
  }, [userId]);

  const fetchFollowing = useCallback(async () => {
    try {
      const response = await axios.get(`${SOCIAL_API_URL}/api/follows/${userId}/following`);
      if (response.data.success) {
        setFollowing(response.data.following);
      }
    } catch (error) {
      console.error('Failed to load following:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (activeTab === 'followers' && followers.length === 0) {
      fetchFollowers();
    } else if (activeTab === 'following' && following.length === 0) {
      fetchFollowing();
    }
  }, [activeTab, fetchFollowers, fetchFollowing, followers.length, following.length]);

  const handleFollow = async () => {
    if (!currentUser) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${SOCIAL_API_URL}/api/follows/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        setUser(prev => prev ? {
          ...prev,
          isFollowing: response.data.following,
          followersCount: (prev.followersCount || 0) + (response.data.following ? 1 : -1),
          bellEnabled: response.data.following ? false : prev.bellEnabled, // Reset bell when unfollowing
        } : null);
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
    }
  };

  const handleBellToggle = (newState: boolean) => {
    setUser(prev => prev ? { ...prev, bellEnabled: newState } : null);
  };

  /** Open edit form pre-filled with current values */
  const startEditing = () => {
    if (user) {
      setEditName(user.name || '');
      setEditBio(user.bio || '');
      setEditError(null);
      setIsEditing(true);
    }
  };

  /** Save profile edits via PATCH API */
  const handleSaveProfile = async () => {
    const token = localStorage.getItem('authToken');
    if (!token || !user) return;

    setEditSaving(true);
    setEditError(null);
    try {
      const response = await axios.patch(
        `${SOCIAL_API_URL}/api/users/${userId}`,
        { name: editName.trim(), bio: editBio.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setUser(prev => prev ? {
          ...prev,
          name: editName.trim(),
          bio: editBio.trim()
        } : null);
        setIsEditing(false);
      }
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">User not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header with background gradient */}
      <div className="h-32 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600"></div>

      {/* Profile Info */}
      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="flex justify-between items-start -mt-16 mb-4">
          <div className="w-32 h-32 rounded-full border-4 border-white bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              user.name?.[0]?.toUpperCase() || user.username[0].toUpperCase()
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-20">
            {isOwnProfile ? (
              <button
                onClick={startEditing}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition flex items-center gap-2"
              >
                <SettingsIcon size={18} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-lg font-semibold transition ${user.isFollowing
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                    }`}
                >
                  {user.isFollowing ? 'Following' : 'Follow'}
                </button>

                <BellToggle
                  userId={userId}
                  isFollowing={user.isFollowing ?? false}
                  bellEnabled={user.bellEnabled || false}
                  onToggle={handleBellToggle}
                  size="medium"
                  variant="icon"
                />
              </>
            )}
          </div>
        </div>

        {/* User Info / Edit Form */}
        {isEditing ? (
          <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Edit Profile</h3>

            {editError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {editError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-gray-900"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{editBio.length}/160</p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition flex items-center gap-1"
                  disabled={editSaving}
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={editSaving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-1 disabled:opacity-50"
                >
                  {editSaving ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                  ) : (
                    <><Save size={16} /> Save</>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{user.name || user.username}</h1>
            <p className="text-gray-500">@{user.username}</p>
            {user.bio && <p className="mt-3 text-gray-700">{user.bio}</p>}

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar size={16} />
                <span>Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-6 mb-6 pb-6 border-b border-gray-200">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{user.postsCount || 0}</div>
            <div className="text-sm text-gray-500">Posts</div>
          </div>
          <button
            onClick={() => setActiveTab('followers')}
            className="text-center hover:bg-gray-50 px-3 rounded transition"
          >
            <div className="text-xl font-bold text-gray-900">{user.followersCount || 0}</div>
            <div className="text-sm text-gray-500">Followers</div>
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className="text-center hover:bg-gray-50 px-3 rounded transition"
          >
            <div className="text-xl font-bold text-gray-900">{user.followingCount || 0}</div>
            <div className="text-sm text-gray-500">Following</div>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'posts'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'followers'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Followers
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'following'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Following
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'posts' && (
          <div className="grid grid-cols-3 gap-1">
            {posts.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-500">
                No posts yet
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="aspect-square bg-gray-100 rounded overflow-hidden hover:opacity-90 transition cursor-pointer">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.caption || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-200 to-pink-200">
                      <p className="text-gray-600 p-4 text-center text-sm line-clamp-3">{post.caption}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="space-y-3">
            {followers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No followers yet</div>
            ) : (
              followers.map(follower => (
                <div key={follower.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold">
                      {follower.avatarUrl ? (
                        <img src={follower.avatarUrl} alt={follower.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        follower.name?.[0]?.toUpperCase() || follower.username[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{follower.name || follower.username}</div>
                      <div className="text-sm text-gray-500">@{follower.username}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'following' && (
          <div className="space-y-3">
            {following.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Not following anyone yet</div>
            ) : (
              following.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        user.name?.[0]?.toUpperCase() || user.username[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.name || user.username}</div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
