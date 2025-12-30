import React from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';

interface Post {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
}

const samplePosts: Post[] = [
  {
    id: '1',
    userId: 'user_123',
    username: 'john_doe',
    userAvatar: 'https://i.pravatar.cc/150?img=12',
    imageUrl: 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=500',
    caption: 'Beautiful sunset at the beach 🌅',
    likes: 234,
    comments: 18,
    timestamp: '2h ago'
  },
  {
    id: '2',
    userId: 'user_456',
    username: 'jane_smith',
    userAvatar: 'https://i.pravatar.cc/150?img=5',
    imageUrl: 'https://images.unsplash.com/photo-1511715282680-fbf93a50e721?w=500',
    caption: 'Coffee and coding ☕💻',
    likes: 189,
    comments: 12,
    timestamp: '4h ago'
  },
  {
    id: '3',
    userId: 'user_789',
    username: 'travel_lover',
    userAvatar: 'https://i.pravatar.cc/150?img=8',
    imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500',
    caption: 'Exploring new horizons 🌍✈️',
    likes: 456,
    comments: 34,
    timestamp: '6h ago'
  }
];

export const Feed: React.FC = () => {
  const handleLike = (postId: string) => {
    console.log('Liked post:', postId);
    // TODO: Implement like functionality with API call
  };

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId);
    // TODO: Implement comment functionality
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h2>
      
      <div className="space-y-6">
        {samplePosts.map((post) => (
          <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Post Header */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <img
                  src={post.userAvatar}
                  alt={post.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-gray-900">{post.username}</p>
                  <p className="text-xs text-gray-500">{post.timestamp}</p>
                </div>
              </div>
              <button className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>

            {/* Post Image */}
            <img
              src={post.imageUrl}
              alt="Post"
              className="w-full h-96 object-cover"
            />

            {/* Post Actions */}
            <div className="p-4">
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={() => handleLike(post.id)}
                  className="hover:text-red-500 transition-colors group"
                >
                  <Heart size={24} className="group-hover:scale-110 transition-transform" />
                </button>
                <button
                  onClick={() => handleComment(post.id)}
                  className="hover:text-blue-500 transition-colors"
                >
                  <MessageCircle size={24} />
                </button>
                <button className="hover:text-green-500 transition-colors">
                  <Share2 size={24} />
                </button>
                <button className="ml-auto hover:text-yellow-500 transition-colors">
                  <Bookmark size={24} />
                </button>
              </div>

              {/* Likes Count */}
              <p className="font-semibold text-gray-900 mb-2">{post.likes.toLocaleString()} likes</p>

              {/* Caption */}
              <p className="text-gray-900">
                <span className="font-semibold mr-2">{post.username}</span>
                {post.caption}
              </p>

              {/* Comments */}
              {post.comments > 0 && (
                <button className="text-gray-500 text-sm mt-2 hover:text-gray-700">
                  View all {post.comments} comments
                </button>
              )}

              {/* Add Comment */}
              <div className="mt-3 pt-3 border-t">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  className="w-full text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="text-center mt-8">
        <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg">
          Load More Posts
        </button>
      </div>
    </div>
  );
};
