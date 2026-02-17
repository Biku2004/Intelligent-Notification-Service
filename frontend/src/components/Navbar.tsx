import React, { useState, useEffect, useRef } from 'react';
import { Home, Search, PlusSquare, User, Settings, FlaskConical, LayoutDashboard, Database, LogOut, X } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useAppMode } from '../context/AppModeContext';
import { useAuth } from '../hooks/useAuth';
import { SOCIAL_API_URL } from '../config/api';
import axios from 'axios';

interface NavbarProps {
  onNavigate: (page: 'feed' | 'preferences' | 'profile' | 'tester' | 'dashboard' | 'database') => void;
  currentPage: string;
  onCreatePost: () => void;
  onProfileClick: () => void;
  onUserSelect?: (userId: string) => void;
}

interface SearchResult {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage, onCreatePost, onProfileClick, onUserSelect }) => {
  const { isTesting, toggleMode, mode } = useAppMode();
  const { logout } = useAuth();

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await axios.get(`${SOCIAL_API_URL}/api/users?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleUserClick = (userId: string) => {
    setShowSearch(false);
    setSearchQuery('');
    if (onUserSelect) {
      onUserSelect(userId);
    }
  };

  const activeClass = (page: string) =>
    currentPage === page ? 'bg-gray-800' : 'hover:bg-gray-800';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo + Mode Toggle */}
          <div className="flex items-center gap-4">
            <h1
              className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent cursor-pointer"
              onClick={() => onNavigate('feed')}
            >
              InstaNotify
            </h1>

            {/* Mode Toggle */}
            <button
              onClick={toggleMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${isTesting
                ? 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30'
                : 'bg-gray-700/50 border-gray-600/40 text-gray-300 hover:bg-gray-700/80'
                }`}
              title={`Switch to ${isTesting ? 'Production' : 'Testing'} mode`}
            >
              <span className={`w-2 h-2 rounded-full ${isTesting ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              {mode === 'production' ? 'Production' : 'Testing'}
            </button>
          </div>

          {/* Center + Right: Navigation Icons */}
          <div className="flex items-center gap-1">
            {/* Home */}
            <button
              onClick={() => onNavigate('feed')}
              className={`p-2 rounded-lg transition-colors ${activeClass('feed')}`}
              aria-label="Home"
            >
              <Home size={22} />
            </button>

            {/* Search */}
            <div className="relative" ref={searchRef}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
                aria-label="Search"
              >
                <Search size={22} />
              </button>

              {/* Search Dropdown */}
              {showSearch && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <Search size={16} className="text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="flex-1 text-gray-900 text-sm outline-none placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {searchLoading ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleUserClick(result.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {result.avatarUrl ? (
                              <img src={result.avatarUrl} alt={result.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              result.username[0].toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{result.username}</p>
                            {result.name && <p className="text-gray-500 text-xs truncate">{result.name}</p>}
                          </div>
                        </button>
                      ))
                    ) : searchQuery.trim() ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        No users found
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        Type to search for users
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Create Post */}
            <button
              onClick={onCreatePost}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Create Post"
            >
              <PlusSquare size={22} />
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* Settings */}
            <button
              onClick={() => onNavigate('preferences')}
              className={`p-2 rounded-lg transition-colors ${activeClass('preferences')}`}
              aria-label="Settings"
            >
              <Settings size={22} />
            </button>

            {/* Dev Tools - Only in Testing mode */}
            {isTesting && (
              <>
                <div className="w-px h-6 bg-gray-700 mx-1" />
                <button
                  onClick={() => onNavigate('tester')}
                  className={`p-2 rounded-lg transition-colors ${currentPage === 'tester' ? 'bg-gray-800 text-green-400' : 'hover:bg-gray-800 text-green-500'}`}
                  aria-label="Notification Tester"
                  title="Test Notifications"
                >
                  <FlaskConical size={22} />
                </button>
                {/* <button
                  onClick={() => onNavigate('dashboard')}
                  className={`p-2 rounded-lg transition-colors ${currentPage === 'dashboard' ? 'bg-gray-800 text-cyan-400' : 'hover:bg-gray-800 text-cyan-500'}`}
                  aria-label="System Dashboard"
                  title="System Dashboard"
                >
                  <LayoutDashboard size={22} />
                </button> */}
                <button
                  onClick={() => onNavigate('database')}
                  className={`p-2 rounded-lg transition-colors ${currentPage === 'database' ? 'bg-gray-800 text-orange-400' : 'hover:bg-gray-800 text-orange-500'}`}
                  aria-label="Database Viewer"
                  title="Database Monitor"
                >
                  <Database size={22} />
                </button>
              </>
            )}

            <div className="w-px h-6 bg-gray-700 mx-1" />

            {/* Profile */}
            <button
              onClick={onProfileClick}
              className={`p-2 rounded-lg transition-colors ${activeClass('profile')}`}
              aria-label="Profile"
            >
              <User size={22} />
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-gray-400 hover:text-red-400"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};