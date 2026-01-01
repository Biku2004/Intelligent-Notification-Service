import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import axios from 'axios';
import { SOCIAL_API_URL } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { PostTester } from './PostTester';

interface Post {
  id: string;
  userId: string;
  caption: string;
  imageUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
  _count: {
    likes: number;
    comments: number;
  };
  likes?: Array<{ userId: string }>;
}

export const Feed: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${SOCIAL_API_URL}/api/posts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPosts(response.data.posts || []);
      
      // Track which posts are liked by current user
      const liked = new Set<string>();
      response.data.posts.forEach((post: Post) => {
        if (post.likes?.some(like => like.userId === user?.id)) {
          liked.add(post.id);
        }
      });
      setLikedPosts(liked);
    } catch (err: any) {
      console.error('Failed to fetch posts:', err);
      setError(err.response?.data?.error || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleLike = async (postId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        alert('Please login to like posts');
        return;
      }

      await axios.post(
        `${SOCIAL_API_URL}/api/posts/${postId}/like`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Toggle like status
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });

      // Update like count
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const isLiked = likedPosts.has(postId);
          return {
            ...post,
            _count: {
              ...post._count,
              likes: post._count.likes + (isLiked ? -1 : 1)
            }
          };
        }
        return post;
      }));
    } catch (err: unknown) {
      console.error('Failed to like post:', err);
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      
      if (error.response?.status === 401) {
        alert('Session expired. Please login again.');
        localStorage.clear();
        window.location.reload();
      } else {
        alert(error.response?.data?.error || 'Failed to like post');
      }
    }
  };

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId);
    // TODO: Navigate to post detail page
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="text-center text-gray-500">Loading posts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchPosts}
            className="mt-2 text-red-700 hover:text-red-900 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No posts yet</h3>
          <p className="text-gray-600 mb-4">Create your first post or follow users to see content!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h2>
      
      <div className="space-y-6">
        {posts.map((post) => {
          const isLiked = likedPosts.has(post.id);
          
          return (
            <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Post Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={post.user.avatarUrl || `https://ui-avatars.com/api/?name=${post.user.username}&background=random`}
                    alt={post.user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{post.user.name || post.user.username}</p>
                    <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                  </div>
                </div>
              </div>

            {/* Post Image */}
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt="Post content"
                className="w-full h-96 object-cover"
              />
            )}

            {/* Post Actions */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="hover:opacity-70 transition-opacity"
                    aria-label="Like"
                  >
                    <Heart 
                      className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => handleComment(post.id)}
                    className="hover:opacity-70 transition-opacity"
                    aria-label="Comment"
                  >
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  <button
                    className="hover:opacity-70 transition-opacity"
                    aria-label="Share"
                  >
                    <Share2 className="w-6 h-6" />
                  </button>
                </div>
                <button
                  className="hover:opacity-70 transition-opacity"
                  aria-label="Save"
                >
                  <Bookmark className="w-6 h-6" />
                </button>
              </div>

              {/* Post Stats */}
              <div className="mb-2">
                <p className="font-semibold text-gray-900">
                  {post._count.likes.toLocaleString()} {post._count.likes === 1 ? 'like' : 'likes'}
                </p>
              </div>

              {/* Post Caption */}
              {post.caption && (
                <div className="mb-2">
                  <p className="text-gray-900">
                    <span className="font-semibold mr-2">{post.user.username}</span>
                    {post.caption}
                  </p>
                </div>
              )}

              {/* View Comments */}
              {post._count.comments > 0 && (
                <button
                  onClick={() => handleComment(post.id)}
                  className="text-gray-500 text-sm hover:text-gray-700"
                >
                  View all {post._count.comments} comments
                </button>
              )}
            </div>

            {/* Post Tester - Auto-filled with post ID and user info */}
            <PostTester 
              postId={post.id}
              username={post.user.username}
            />
          </div>
          );
        })}
      </div>
    </div>
  );
};
