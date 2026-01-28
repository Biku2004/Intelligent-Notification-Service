/**
 * Post Tester Component - Enhanced Version
 * Compact tester for individual posts with auto-filled IDs
 * Features:
 * - Follower-based simulation (followers vs non-followers)
 * - Real DB entries with multiple simulated users
 * - Visual feedback for expected notification behavior
 */
import React, { useState } from 'react';
import axios from 'axios';
import { Play, Heart, MessageCircle, ChevronDown, ChevronUp, Users, UserCheck, Trash2, Clock, Zap } from 'lucide-react';
import { SOCIAL_API_URL } from '../config/api';

interface PostTesterProps {
  postId: string;
  postOwnerId: string;
  username: string;
  onDataChange?: () => void;
}

type SimulationType = 'mixed' | 'followers' | 'non-followers';

export const PostTester: React.FC<PostTesterProps> = ({ postId, postOwnerId, username, onDataChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [likeCount, setLikeCount] = useState(5);
  const [commentCount, setCommentCount] = useState(3);
  const [simulationType, setSimulationType] = useState<SimulationType>('mixed');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  // Calculate expected notification behavior
  const getExpectedBehavior = (count: number, type: 'like' | 'comment') => {
    if (type === 'comment') {
      return {
        delivery: 'Batched',
        timing: '~60s wait',
        reason: 'Comments always wait for aggregation window',
        icon: <Clock className="w-4 h-4 text-yellow-500" />,
      };
    }

    if (count <= 3) {
      return {
        delivery: 'Instant',
        timing: 'Immediate',
        reason: `1-3 likes = instant notification`,
        icon: <Zap className="w-4 h-4 text-green-500" />,
      };
    }

    return {
      delivery: 'Batched',
      timing: '~60s wait',
      reason: `4+ likes = aggregated notification`,
      icon: <Clock className="w-4 h-4 text-yellow-500" />,
    };
  };

  const likeBehavior = getExpectedBehavior(likeCount, 'like');
  const commentBehavior = getExpectedBehavior(commentCount, 'comment');

  /**
   * Simulate multiple users liking a post
   */
  const simulateLikes = async () => {
    setLoading(true);
    setResult('⏳ Creating test users and likes...');

    try {
      const response = await axios.post(`${SOCIAL_API_URL}/api/test/simulate-likes`, {
        postId,
        targetUserId: postOwnerId,
        count: likeCount,
        simulationType, // Pass follower type to backend
      });

      const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length || 0;

      if (likeCount <= 3) {
        setResult(`✅ ${successCount} likes sent → Instant notifications delivered!`);
      } else {
        setResult(`✅ ${successCount} likes queued → Will aggregate in ~60s`);
      }

      onDataChange?.();
      setTimeout(() => setResult(''), 5000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ ${err.response?.data?.error || err.message}`);
      setTimeout(() => setResult(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simulate multiple users commenting on a post
   */
  const simulateComments = async () => {
    setLoading(true);
    setResult('⏳ Creating test users and comments...');

    try {
      const response = await axios.post(`${SOCIAL_API_URL}/api/test/simulate-comments`, {
        postId,
        targetUserId: postOwnerId,
        count: commentCount,
        simulationType,
      });

      const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      setResult(`✅ ${successCount} comments queued → Will aggregate in ~60s`);
      onDataChange?.();
      setTimeout(() => setResult(''), 5000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ ${err.response?.data?.error || err.message}`);
      setTimeout(() => setResult(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clean up all test users and their data
   */
  const cleanupTestData = async () => {
    setLoading(true);
    setResult('🧹 Cleaning up test data...');

    try {
      const response = await axios.delete(`${SOCIAL_API_URL}/api/test/cleanup`);
      setResult(`✅ ${response.data.message}`);
      onDataChange?.();
      setTimeout(() => setResult(''), 5000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ ${err.response?.data?.error || err.message}`);
      setTimeout(() => setResult(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
          <Play className="w-4 h-4" />
          <span>🧪 Notification Tester</span>
          <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">Real DB</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-purple-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-700" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Post Info */}
          <div className="text-xs text-purple-700 bg-purple-100 px-3 py-2 rounded-lg">
            <p><strong>Post:</strong> {postId.slice(0, 8)}...</p>
            <p><strong>Owner:</strong> {username} ({postOwnerId.slice(0, 8)}...)</p>
          </div>

          {/* Simulation Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              <Users className="w-3 h-3 inline mr-1" />
              Simulation Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSimulationType('mixed')}
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${simulationType === 'mixed'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
              >
                🔀 Mixed
              </button>
              <button
                onClick={() => setSimulationType('followers')}
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${simulationType === 'followers'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
              >
                <UserCheck className="w-3 h-3" />
                Followers
              </button>
              <button
                onClick={() => setSimulationType('non-followers')}
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-all ${simulationType === 'non-followers'
                    ? 'bg-gray-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
              >
                👤 Non-Followers
              </button>
            </div>
          </div>

          {/* Like Controls */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-red-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
              <Heart className="w-4 h-4 text-red-500" />
              Simulate Likes: {likeCount} users
            </label>

            {/* Expected Behavior Indicator */}
            <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs ${likeBehavior.delivery === 'Instant'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
              {likeBehavior.icon}
              <div>
                <span className="font-semibold">{likeBehavior.delivery}:</span> {likeBehavior.reason}
                <span className="ml-2 opacity-70">({likeBehavior.timing})</span>
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="15"
              value={likeCount}
              onChange={(e) => setLikeCount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span className="text-green-600 font-medium">← Instant (1-3)</span>
              <span className="text-yellow-600 font-medium">Batched (4+) →</span>
              <span>15</span>
            </div>

            <button
              onClick={simulateLikes}
              disabled={loading}
              className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Heart className="w-4 h-4" />
              {loading ? 'Processing...' : `Send ${likeCount} Like${likeCount > 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Comment Controls */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              Simulate Comments: {commentCount} users
            </label>

            {/* Expected Behavior Indicator */}
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
              {commentBehavior.icon}
              <div>
                <span className="font-semibold">Always Batched:</span> Comments wait for 60s aggregation window
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="10"
              value={commentCount}
              onChange={(e) => setCommentCount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            <button
              onClick={simulateComments}
              disabled={loading}
              className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              {loading ? 'Processing...' : `Send ${commentCount} Comment${commentCount > 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Cleanup Button */}
          <button
            onClick={cleanupTestData}
            disabled={loading}
            className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-300 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clean Up Test Data
          </button>

          {/* Result */}
          {result && (
            <div className={`text-sm px-4 py-3 rounded-lg font-medium ${result.startsWith('✅') ? 'bg-green-100 text-green-700 border border-green-200' :
                result.startsWith('⏳') ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                  result.startsWith('🧹') ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    'bg-red-100 text-red-700 border border-red-200'
              }`}>
              {result}
            </div>
          )}

          {/* Smart Notification Guide */}
          <div className="text-xs bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 rounded-lg border border-indigo-200">
            <p className="font-bold text-indigo-700 mb-2">📊 Smart Notification Logic:</p>
            <div className="space-y-1 text-gray-700">
              <p className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-green-500" />
                <strong>1-3 likes:</strong> Instant notification to post owner
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-yellow-500" />
                <strong>4+ likes:</strong> Batched → "John and 4 others liked..."
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-yellow-500" />
                <strong>Comments:</strong> Always batched (60s window)
              </p>
              <p className="flex items-center gap-2 mt-2 text-indigo-600">
                <UserCheck className="w-3 h-3" />
                <strong>Followers:</strong> Shown with priority in notification
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
