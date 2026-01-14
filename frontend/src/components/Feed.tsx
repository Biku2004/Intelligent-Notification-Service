import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, UserPlus, UserCheck, Send, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { SOCIAL_API_URL } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { PostTester } from './PostTester';
import { UserProfile } from './UserProfile';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
  replies?: Comment[];
}

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
  likesCount: number;
  isLiked: boolean;
  likes?: Array<{ userId: string }>;
}

export const Feed: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // Comments state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [submittingComment, setSubmittingComment] = useState<Set<string>>(new Set());

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${SOCIAL_API_URL}/api/posts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const fetchedPosts = response.data.posts || [];
      setPosts(fetchedPosts);
      
      // Track which posts are liked by current user using isLiked from backend
      const liked = new Set<string>();
      fetchedPosts.forEach((post: Post) => {
        if (post.isLiked) {
          liked.add(post.id);
        }
      });
      setLikedPosts(liked);
      
      // Fetch follow status for all post authors
      if (token && user) {
        const uniqueUserIds = Array.from(new Set(fetchedPosts.map((p: Post) => p.userId)));
        const followStatuses = await Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const followRes = await axios.get(`${SOCIAL_API_URL}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              return { userId, isFollowing: followRes.data.user?.isFollowing || false };
            } catch {
              return { userId, isFollowing: false };
            }
          })
        );
        
        const followed = new Set<string>();
        followStatuses.forEach(({ userId, isFollowing }) => {
          if (isFollowing) followed.add(userId);
        });
        setFollowedUsers(followed);
      }
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

      const response = await axios.post(
        `${SOCIAL_API_URL}/api/posts/${postId}/like`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Use backend response to update state
      const { liked, likesCount } = response.data;
      
      // Update liked posts state based on backend response
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (liked) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });

      // Update like count from backend response
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likesCount: likesCount,
            _count: {
              ...post._count,
              likes: likesCount
            },
            isLiked: liked
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

  const handleFollow = async (userId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        alert('Please login to follow users');
        return;
      }

      await axios.post(
        `${SOCIAL_API_URL}/api/follows/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Toggle follow status
      setFollowedUsers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(userId)) {
          newSet.delete(userId);
        } else {
          newSet.add(userId);
        }
        return newSet;
      });
    } catch (err: any) {
      console.error('Failed to follow user:', err);
      alert(err.response?.data?.error || 'Failed to follow user');
    }
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
  };

  // Fetch comments for a post
  const fetchComments = async (postId: string) => {
    try {
      setLoadingComments(prev => new Set(prev).add(postId));
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${SOCIAL_API_URL}/api/comments?postId=${postId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      setPostComments(prev => ({
        ...prev,
        [postId]: response.data.comments || []
      }));
    } catch (err: any) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  // Toggle comments section
  const handleComment = async (postId: string) => {
    const isExpanded = expandedComments.has(postId);
    
    if (isExpanded) {
      // Collapse
      setExpandedComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      // Expand and fetch comments
      setExpandedComments(prev => new Set(prev).add(postId));
      if (!postComments[postId]) {
        await fetchComments(postId);
      }
    }
  };

  // Submit a new comment
  const submitComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Please login to comment');
      return;
    }

    try {
      setSubmittingComment(prev => new Set(prev).add(postId));
      
      const response = await axios.post(
        `${SOCIAL_API_URL}/api/comments`,
        { postId, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add the new comment to the list
      setPostComments(prev => ({
        ...prev,
        [postId]: [response.data.comment, ...(prev[postId] || [])]
      }));

      // Update the comment count in posts
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            _count: { ...post._count, comments: post._count.comments + 1 }
          };
        }
        return post;
      }));

      // Clear the input
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      console.error('Failed to post comment:', err);
      alert(err.response?.data?.error || 'Failed to post comment');
    } finally {
      setSubmittingComment(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
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

  // Show user profile if selected
  if (selectedUserId) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <button
          onClick={() => setSelectedUserId(null)}
          className="mb-4 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-medium transition"
        >
          ← Back to Feed
        </button>
        <UserProfile userId={selectedUserId} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h2>
      
      <div className="space-y-6">
        {posts.map((post) => {
          const isLiked = likedPosts.has(post.id);
          const isFollowing = followedUsers.has(post.userId);
          const isOwnPost = post.userId === user?.id;
          
          return (
            <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Post Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleUserClick(post.userId)}
                    className="hover:opacity-80 transition"
                  >
                    <img
                      src={post.user.avatarUrl || `https://ui-avatars.com/api/?name=${post.user.username}&background=random`}
                      alt={post.user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </button>
                  <div>
                    <button 
                      onClick={() => handleUserClick(post.userId)}
                      className="font-semibold text-gray-900 hover:text-purple-600 transition"
                    >
                      {post.user.name || post.user.username}
                    </button>
                    <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                  </div>
                </div>
                
                {/* Follow Button */}
                {!isOwnPost && (
                  <button
                    onClick={() => handleFollow(post.userId)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-sm transition ${
                      isFollowing
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck size={16} />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Follow
                      </>
                    )}
                  </button>
                )}
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
                  {(post.likesCount || post._count?.likes || 0).toLocaleString()} {(post.likesCount || post._count?.likes || 0) === 1 ? 'like' : 'likes'}
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

              {/* Comments Section */}
              <div className="border-t border-gray-100 mt-2 pt-2">
                {/* View/Hide Comments Toggle */}
                {post._count.comments > 0 && (
                  <button
                    onClick={() => handleComment(post.id)}
                    className="text-gray-500 text-sm hover:text-gray-700 flex items-center gap-1 mb-2"
                  >
                    {expandedComments.has(post.id) ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide comments
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        View all {post._count.comments} comments
                      </>
                    )}
                  </button>
                )}

                {/* Expanded Comments List */}
                {expandedComments.has(post.id) && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {loadingComments.has(post.id) ? (
                      <p className="text-gray-400 text-sm">Loading comments...</p>
                    ) : postComments[post.id]?.length > 0 ? (
                      postComments[post.id].map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <img
                            src={comment.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user.username}`}
                            alt={comment.user.username}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold mr-2">
                                {comment.user.username}
                                {/* Show test badge for test users */}
                                {comment.user.username.startsWith('test_') && (
                                  <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-1 rounded">test</span>
                                )}
                              </span>
                              <span className="text-gray-800">{comment.content}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatTime(comment.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-sm">No comments yet</p>
                    )}
                  </div>
                )}

                {/* Add Comment Input */}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={commentInputs[post.id] || ''}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitComment(post.id);
                      }
                    }}
                    className="flex-1 text-sm border-none outline-none placeholder-gray-400"
                    disabled={submittingComment.has(post.id)}
                  />
                  <button
                    onClick={() => submitComment(post.id)}
                    disabled={!commentInputs[post.id]?.trim() || submittingComment.has(post.id)}
                    className={`text-blue-500 font-semibold text-sm ${
                      !commentInputs[post.id]?.trim() || submittingComment.has(post.id)
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:text-blue-600'
                    }`}
                  >
                    {submittingComment.has(post.id) ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Post Tester - Auto-filled with post ID and user info */}
            <PostTester 
              postId={post.id}
              postOwnerId={post.user.id}
              username={post.user.username}
              onDataChange={() => {
                // Refresh posts and comments when test data changes
                fetchPosts();
                if (expandedComments.has(post.id)) {
                  fetchComments(post.id);
                }
              }}
            />
          </div>
          );
        })}
      </div>
    </div>
  );
};
