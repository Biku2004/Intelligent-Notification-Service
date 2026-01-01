/**
 * Post Tester Component
 * Compact tester for individual posts with auto-filled IDs
 */
import React, { useState } from 'react';
import axios from 'axios';
import { Play, Heart, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { SOCIAL_API_URL } from '../config/api';

interface PostTesterProps {
  postId: string;
  username: string;
}

export const PostTester: React.FC<PostTesterProps> = ({ postId, username }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [likeCount, setLikeCount] = useState(1);
  const [commentCount, setCommentCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const simulateLikes = async () => {
    setLoading(true);
    setResult('');

    try {
      const token = localStorage.getItem('authToken');
      
      for (let i = 0; i < likeCount; i++) {
        await axios.post(
          `${SOCIAL_API_URL}/api/posts/${postId}/like`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setResult(`✅ ${likeCount} like(s) sent!`);
      setTimeout(() => setResult(''), 3000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult(`❌ ${err.response?.data?.error || err.message}`);
      setTimeout(() => setResult(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const simulateComments = async () => {
    setLoading(true);
    setResult('');

    try {
      const token = localStorage.getItem('authToken');

      for (let i = 0; i < commentCount; i++) {
        await axios.post(
          `${SOCIAL_API_URL}/api/posts/${postId}/comments`,
          {
            content: `Test comment ${i + 1} from notification tester`
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setResult(`✅ ${commentCount} comment(s) sent!`);
      setTimeout(() => setResult(''), 3000);
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
          <span>Test Notifications</span>
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
            <p><strong>Owner:</strong> {username}</p>
          </div>

          {/* Like Controls */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Heart className="w-3 h-3 text-red-500" />
              Likes: {likeCount}
            </label>
            <input
              type="range"
              min="1"
              max="10"
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
              Send {likeCount} Like{likeCount > 1 ? 's' : ''}
            </button>
          </div>

          {/* Comment Controls */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <MessageCircle className="w-3 h-3 text-blue-500" />
              Comments: {commentCount}
            </label>
            <input
              type="range"
              min="1"
              max="5"
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
              Send {commentCount} Comment{commentCount > 1 ? 's' : ''}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className={`text-xs px-3 py-2 rounded ${result.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {result}
            </div>
          )}

          {/* Tip */}
          <div className="text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded">
            💡 <strong>Tip:</strong> 1-2 likes = Instant, 3+ = Aggregated after 30-60s
          </div>
        </div>
      )}
    </div>
  );
};
