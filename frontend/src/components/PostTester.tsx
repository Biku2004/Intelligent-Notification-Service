/**
 * Post Tester Component
 * Compact tester for individual posts with auto-filled IDs
 * Uses test endpoints that create REAL database entries with multiple simulated users
 */
import React, { useState } from 'react';
import axios from 'axios';
import { Play, Heart, MessageCircle, ChevronDown, ChevronUp, Users, Trash2 } from 'lucide-react';
import { SOCIAL_API_URL } from '../config/api';

interface PostTesterProps {
  postId: string;
  postOwnerId: string;
  username: string;
  onDataChange?: () => void; // Callback when test data is created/deleted
}

export const PostTester: React.FC<PostTesterProps> = ({ postId, postOwnerId, username, onDataChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [likeCount, setLikeCount] = useState(5);
  const [commentCount, setCommentCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  /**
   * Simulate multiple users liking a post
   * Creates REAL test users and REAL likes in the database
   */
  const simulateLikes = async () => {
    setLoading(true);
    setResult('⏳ Creating test users and likes...');

    try {
      const response = await axios.post(`${SOCIAL_API_URL}/api/test/simulate-likes`, {
        postId,
        targetUserId: postOwnerId,
        count: likeCount,
      });

      const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      setResult(`✅ ${successCount} likes created from ${successCount} different users!`);
      onDataChange?.(); // Notify parent to refresh data
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
        count: commentCount
      });

      const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      setResult(`✅ ${successCount} comments created from ${successCount} different users!`);
      onDataChange?.(); // Notify parent to refresh data
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
      onDataChange?.(); // Notify parent to refresh data
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
    <div className="border-t border-gray-200 bg-purple-50">
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
          <Play className="w-4 h-4" />
          <span>Test Notifications (Real DB)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-purple-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-700" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Info */}
          <div className="text-xs text-purple-700 bg-purple-100 px-3 py-2 rounded">
            <p><strong>Post:</strong> {postId.slice(0, 8)}...</p>
            <p><strong>Owner:</strong> {username} ({postOwnerId.slice(0, 8)}...)</p>
            <p className="mt-1 text-purple-600">
              <Users className="w-3 h-3 inline mr-1" />
              Creates real test users + real DB entries
            </p>
          </div>

          {/* Like Controls */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Heart className="w-3 h-3 text-red-500" />
              Simulate Likes: {likeCount} users
            </label>
            <div className="text-xs text-blue-600 mb-2 bg-blue-50 p-2 rounded">
              💡 Batched: DB writes + notifications after ~60s
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={likeCount}
              onChange={(e) => setLikeCount(parseInt(e.target.value))}
              className="w-full h-1"
            />
            <button
              onClick={simulateLikes}
              disabled={loading}
              className="w-full mt-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Heart className="w-3 h-3" />
              {loading ? 'Processing...' : `Simulate ${likeCount} Like${likeCount > 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Comment Controls */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <MessageCircle className="w-3 h-3 text-blue-500" />
              Simulate Comments: {commentCount} users
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={commentCount}
              onChange={(e) => setCommentCount(parseInt(e.target.value))}
              className="w-full h-1"
            />
            <button
              onClick={simulateComments}
              disabled={loading}
              className="w-full mt-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <MessageCircle className="w-3 h-3" />
              {loading ? 'Processing...' : `Simulate ${commentCount} Comment${commentCount > 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Cleanup Button */}
          <button
            onClick={cleanupTestData}
            disabled={loading}
            className="w-full px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clean Up Test Data
          </button>

          {/* Result */}
          {result && (
            <div className={`text-xs px-3 py-2 rounded ${
              result.startsWith('✅') ? 'bg-green-100 text-green-700' : 
              result.startsWith('⏳') ? 'bg-yellow-100 text-yellow-700' :
              result.startsWith('🧹') ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {result}
            </div>
          )}

          {/* Tip */}
          <div className="text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded space-y-1">
            <p>💡 <strong>Aggregation Thresholds:</strong></p>
            <p>• 1-2 = Instant delivery</p>
            <p>• 3-4 = CRITICAL priority flush</p>
            <p>• 5-9 = Wait for 60s window</p>
            <p>• 10 = Milestone flush</p>
            <p>• 11-49 = Wait for window</p>
            <p>• 50 = Max batch flush</p>
          </div>
        </div>
      )}
    </div>
  );
};
