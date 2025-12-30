/**
 * User Profile Component
 * Displays user information, posts, followers, and follow button
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Calendar, Settings as SettingsIcon, Bell, BellOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { User, Post } from '../types';

const API_BASE = 'http://localhost:3003';

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

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch user profile
      const userResponse = await axios.get(`${API_BASE}/api/users/${userId}`);
      if (userResponse.data.success) {
        setUser(userResponse.data.user);
      }

      // Fetch user's posts
      const postsResponse = await axios.get(`${API_BASE}/api/posts`, {
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
      const response = await axios.get(`${API_BASE}/api/follows/${userId}/followers`);
      if (response.data.success) {
        setFollowers(response.data.followers);
      }
    } catch (error) {
      console.error('Failed to load followers:', error);
    }
  }, [userId]);

  const fetchFollowing = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/follows/${userId}/following`);
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
      const response = await axios.post(`${API_BASE}/api/follows/${userId}`);
      if (response.data.success) {
        setUser(prev => prev ? {
          ...prev,
          isFollowing: response.data.following,
          followersCount: (prev.followersCount || 0) + (response.data.following ? 1 : -1)
        } : null);
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
    }
  };

  const handleBellToggle = async () => {
    if (!currentUser || !user?.isFollowing) return;
    
    try {
      const response = await axios.post(`${API_BASE}/api/follows/${userId}/bell`);
      if (response.data.success) {
        setUser(prev => prev ? { ...prev, bellEnabled: response.data.bellEnabled } : null);
      }
    } catch (error) {
      console.error('Failed to toggle bell:', error);
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
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition flex items-center gap-2"
              >
                <SettingsIcon size={18} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-lg font-semibold transition ${
                    user.isFollowing
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                  }`}
                >
                  {user.isFollowing ? 'Following' : 'Follow'}
                </button>
                
                {user.isFollowing && (
                  <button
                    onClick={handleBellToggle}
                    className={`p-2 rounded-lg transition ${
                      user.bellEnabled
                        ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                    title={user.bellEnabled ? 'Turn off notifications' : 'Turn on notifications'}
                  >
                    {user.bellEnabled ? <Bell size={20} fill="currentColor" /> : <BellOff size={20} />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* User Info */}
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
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'posts'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'followers'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Followers
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'following'
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
