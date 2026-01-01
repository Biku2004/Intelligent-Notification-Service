/**
 * Notification Tester Component
 * Simulates likes and comments with different scenarios
 */
import React, { useState } from 'react';
import axios from 'axios';
import { Play, Users, UserCheck, MessageCircle, Heart } from 'lucide-react';

const SOCIAL_API_URL = 'http://localhost:3003';

interface TesterMode {
  likeCount: number;
  commentCount: number;
  isFollowed: boolean;
  targetUserId: string;
  postId: string;
}

export const NotificationTester: React.FC = () => {
  const [config, setConfig] = useState<TesterMode>({
    likeCount: 1,
    commentCount: 0,
    isFollowed: false,
    targetUserId: '',
    postId: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const simulateLikes = async () => {
    setLoading(true);
    setResult('');

    try {
      const token = localStorage.getItem('authToken');
      
      if (!config.postId || !config.targetUserId) {
        setResult('❌ Please provide Post ID and Target User ID');
        setLoading(false);
        return;
      }

      // Simulate multiple likes from different users
      for (let i = 0; i < config.likeCount; i++) {
        await axios.post(
          `${SOCIAL_API_URL}/api/posts/${config.postId}/like`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between likes
      }

      setResult(`✅ Simulated ${config.likeCount} like(s) successfully!`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateComments = async () => {
    setLoading(true);
    setResult('');

    try {
      const token = localStorage.getItem('authToken');
      
      if (!config.postId) {
        setResult('❌ Please provide Post ID');
        setLoading(false);
        return;
      }

      // Simulate comments
      for (let i = 0; i < config.commentCount; i++) {
        await axios.post(
          `${SOCIAL_API_URL}/api/posts/${config.postId}/comments`,
          {
            content: `Test comment ${i + 1} from tester mode`
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setResult(`✅ Simulated ${config.commentCount} comment(s) successfully!`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Play className="w-6 h-6 text-purple-600" />
        Notification Tester
      </h2>

      <div className="space-y-4">
        {/* Post ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post ID (required)
          </label>
          <input
            type="text"
            value={config.postId}
            onChange={(e) => setConfig({ ...config, postId: e.target.value })}
            placeholder="Enter post ID to test"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Target User ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target User ID (post owner)
          </label>
          <input
            type="text"
            value={config.targetUserId}
            onChange={(e) => setConfig({ ...config, targetUserId: e.target.value })}
            placeholder="User who will receive notifications"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Like Count */}
        <div>
          <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            Like Count: {config.likeCount}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={config.likeCount}
            onChange={(e) => setConfig({ ...config, likeCount: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 (Toast + Notification)</span>
            <span>5 (Toast + Notification)</span>
            <span>20 (Notification only)</span>
          </div>
        </div>

        {/* Comment Count */}
        <div>
          <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-500" />
            Comment Count: {config.commentCount}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={config.commentCount}
            onChange={(e) => setConfig({ ...config, commentCount: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Follow Status */}
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.isFollowed}
              onChange={(e) => setConfig({ ...config, isFollowed: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              {config.isFollowed ? (
                <>
                  <UserCheck className="w-4 h-4 text-green-500" />
                  Followed (HIGH priority)
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 text-gray-500" />
                  Not Followed (LOW priority)
                </>
              )}
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={simulateLikes}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Heart className="w-5 h-5" />
            Simulate {config.likeCount} Like{config.likeCount > 1 ? 's' : ''}
          </button>

          <button
            onClick={simulateComments}
            disabled={loading || config.commentCount === 0}
            className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Simulate {config.commentCount} Comment{config.commentCount > 1 ? 's' : ''}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg ${result.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {result}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
          <p className="font-semibold mb-2">📊 Expected Behavior:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>1-2 likes: Instant delivery (no aggregation)</li>
            <li>3-49 likes: Aggregated after 60 seconds</li>
            <li>50+ likes: Instant delivery (batch full)</li>
            <li>Comments: Always Toast + Notification (immediate)</li>
            <li>All social interactions: HIGH priority (faster delivery)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
