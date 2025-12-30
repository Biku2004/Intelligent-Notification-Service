import React from 'react';
import { Home, Search, PlusSquare, User, Settings } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  onNavigate: (page: 'feed' | 'preferences' | 'profile') => void;
  currentPage: string;
  onCreatePost: () => void;
  onProfileClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage, onCreatePost, onProfileClick }) => {
  return (
    <nav className="sticky top-0 z-50 bg-black text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              InstaNotify
            </h1>
          </div>

          {/* Navigation Icons */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('feed')}
              className={`p-2 rounded-lg transition-colors ${
                currentPage === 'feed' ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
              aria-label="Home"
            >
              <Home size={24} />
            </button>

            <button
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Search"
            >
              <Search size={24} />
            </button>

            <button
              onClick={onCreatePost}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Create Post"
            >
              <PlusSquare size={24} />
            </button>

            <NotificationBell />

            <button
              onClick={() => onNavigate('preferences')}
              className={`p-2 rounded-lg transition-colors ${
                currentPage === 'preferences' ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
              aria-label="Settings"
            >
              <Settings size={24} />
            </button>

            <button
              onClick={onProfileClick}
              className={`p-2 rounded-lg transition-colors ${
                currentPage === 'profile' ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
              aria-label="Profile"
            >
              <User size={24} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};