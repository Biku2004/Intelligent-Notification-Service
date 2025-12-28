import React, { useState } from 'react';
import { Bell, MessageSquare, Heart } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export const Navbar = () => {
  const { unreadCount, notifications, markAsRead } = useSocket()!;
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) markAsRead();
  };

  return (
    <nav className="p-4 bg-black text-white flex justify-between items-center">
      <h1 className="text-xl font-bold">InstaNotify</h1>
      
      {/* Bell Container */}
      <div className="relative">
        <button onClick={handleToggle} className="relative p-2 hover:bg-gray-800 rounded-full">
          <Bell size={24} />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-xs w-5 h-5 flex items-center justify-center rounded-full">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Feed */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white text-black shadow-xl rounded-lg overflow-hidden z-50">
            <div className="p-3 font-bold border-b">Notifications</div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No notifications yet</div>
              ) : (
                notifications.map((n, i) => (
                  <div key={i} className="p-3 border-b hover:bg-gray-50 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                      {n.type === 'LIKE' ? <Heart size={16} /> : <MessageSquare size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {n.actorId} {n.type === 'LIKE' ? 'liked your post' : 'commented'}
                      </p>
                      <p className="text-xs text-gray-400">Just now</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};