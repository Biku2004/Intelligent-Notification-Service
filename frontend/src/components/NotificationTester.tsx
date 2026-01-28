/**
 * Notification Tester Component
 * Standalone notification testing panel for simulating various scenarios
 * Simplified version - for individual post testing, use PostTester instead
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Users, UserCheck, MessageCircle, Heart, Zap, Clock, AlertCircle } from 'lucide-react';

const SOCIAL_API_URL = 'http://localhost:3003';

interface Post {
  id: string;
  caption: string;
  user: {
    id: string;
    username: string;
  };
}

export const NotificationTester: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [likeCount, setLikeCount] = useState(3);
  const [commentCount, setCommentCount] = useState(2);
  const [isFollowed, setIsFollowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  // Fetch available posts on mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await axios.get(`${SOCIAL_API_URL}/api/posts`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setPosts(response.data.posts || []);
        if (response.data.posts?.length > 0) {
          setSelectedPost(response.data.posts[0]);
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error);
      }
    };
    fetchPosts();
  }, []);

  // Calculate expected delivery behavior
  const getDeliveryType = () => {
    if (likeCount <= 3) {
      return { type: 'INSTANT', color: 'green', icon: <Zap className="w-4 h-4" /> };
    }
    return { type: 'BATCHED (~60s)', color: 'yellow', icon: <Clock className="w-4 h-4" /> };
  };

  const delivery = getDeliveryType();

  const simulateLikes = async () => {
    if (!selectedPost) {
      setResult('❌ Please select a post first');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const response = await axios.post(`${SOCIAL_API_URL}/api/test/simulate-likes`, {
        postId: selectedPost.id,
        targetUserId: selectedPost.user.id,
        count: likeCount,
        simulationType: isFollowed ? 'followers' : 'non-followers',
      });

      const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      const deliveryMsg = response.data.deliveryType || 'BATCHED';
      setResult(`✅ ${successCount} likes simulated! Delivery: ${deliveryMsg}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateComments = async () => {
    if (!selectedPost) {
      setResult('❌ Please select a post first');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const response = await axios.post(`${SOCIAL_API_URL}/api/test/simulate-comments`, {
        postId: selectedPost.id,
        targetUserId: selectedPost.user.id,
        count: commentCount,
      });

      const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      setResult(`✅ ${successCount} comments simulated! Delivery: BATCHED (~60s)`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Play className="w-6 h-6 text-purple-600" />
        Notification Tester
      </h2>

      <div className="space-y-5">
        {/* Post Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Post to Test
          </label>
          {posts.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              No posts available. Create a post first!
            </div>
          ) : (
            <select
              value={selectedPost?.id || ''}
              onChange={(e) => {
                const post = posts.find(p => p.id === e.target.value);
                setSelectedPost(post || null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {posts.map(post => (
                <option key={post.id} value={post.id}>
                  {post.caption?.substring(0, 50) || 'Untitled'} - by @{post.user.username}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Like Count Slider */}
        <div className="bg-red-50 rounded-lg p-4">
          <label className="flex text-sm font-semibold text-gray-700 mb-3 items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            Like Count: <span className="text-xl font-bold text-red-600">{likeCount}</span>
          </label>

          {/* Delivery Indicator */}
          <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-sm ${delivery.color === 'green'
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            }`}>
            {delivery.icon}
            <span className="font-semibold">
              {delivery.type === 'INSTANT'
                ? '⚡ Instant Delivery: 1-3 likes = immediate notification'
                : '⏳ Batched: 4+ likes aggregated after 60s'}
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="15"
            value={likeCount}
            onChange={(e) => setLikeCount(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>1</span>
            <span className="text-green-600 font-medium">Instant (1-3)</span>
            <span className="text-yellow-600 font-medium">Batched (4+)</span>
            <span>15</span>
          </div>
        </div>

        {/* Comment Count Slider */}
        <div className="bg-blue-50 rounded-lg p-4">
          <label className="flex text-sm font-semibold text-gray-700 mb-3 items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-500" />
            Comment Count: <span className="text-xl font-bold text-blue-600">{commentCount}</span>
          </label>

          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-sm bg-yellow-100 text-yellow-700 border border-yellow-200">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">Always Batched: Comments wait for 60s aggregation window</span>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            value={commentCount}
            onChange={(e) => setCommentCount(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Follower Toggle */}
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isFollowed}
              onChange={(e) => setIsFollowed(e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              {isFollowed ? (
                <>
                  <UserCheck className="w-5 h-5 text-green-500" />
                  <span>Simulate as <strong className="text-green-600">Followers</strong></span>
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 text-gray-400" />
                  <span>Simulate as <strong className="text-gray-600">Non-Followers</strong></span>
                </>
              )}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2 ml-8">
            Followers are shown with priority in aggregated notifications
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={simulateLikes}
            disabled={loading || !selectedPost}
            className="px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <Heart className="w-5 h-5" />
            Send {likeCount} Like{likeCount > 1 ? 's' : ''}
          </button>

          <button
            onClick={simulateComments}
            disabled={loading || commentCount === 0 || !selectedPost}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            Send {commentCount} Comment{commentCount > 1 ? 's' : ''}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg font-medium ${result.startsWith('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
            {result}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg text-sm border border-indigo-200">
          <p className="font-bold mb-3 text-indigo-700">📊 Smart Notification Logic:</p>
          <div className="space-y-2 text-gray-700">
            <p className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              <strong>1-3 likes:</strong> Instant notification to post owner
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <strong>4+ likes:</strong> Aggregated → "John and 4 others liked..."
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <strong>Comments:</strong> Always batched (60s window)
            </p>
            <p className="flex items-center gap-2 mt-3 pt-2 border-t border-indigo-200 text-indigo-600">
              <UserCheck className="w-4 h-4" />
              <strong>Followers</strong> are prioritized in aggregated notifications
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
