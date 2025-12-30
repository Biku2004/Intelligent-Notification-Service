import { useState } from 'react';
import { SocketProvider } from './context/SocketProvider';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { Feed } from './components/Feed';
import { NotificationPreferences } from './components/NotificationPreferences';
import { UserProfile } from './components/UserProfile';
import { PostCreation } from './components/PostCreation';
import { Login } from './components/Login';
import { Register } from './components/Register';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

type Page = 'feed' | 'preferences' | 'profile';

function AppContent() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('feed');
  const [showPostCreation, setShowPostCreation] = useState(false);
  const [showAuth, setShowAuth] = useState<'login' | 'register'>('login');
  const [refreshFeed, setRefreshFeed] = useState(0);

  // Test trigger function for development
  const handleTestTrigger = async (type: 'LIKE' | 'COMMENT' | 'FOLLOW') => {
    try {
      await axios.post(`${API_BASE}/api/events`, {
        type,
        priority: type === 'COMMENT' ? 'HIGH' : 'LOW',
        actorId: 'test_user_123',
        actorName: 'Test User',
        actorAvatar: 'https://i.pravatar.cc/150?img=68',
        targetId: user?.id || 'user_999',
        targetType: 'POST',
        targetEntityId: 'post_123',
        message: type === 'LIKE' ? 'liked your post' : type === 'COMMENT' ? 'Nice post!' : 'started following you',
        timestamp: new Date().toISOString(),
        metadata: {
          postUrl: '/posts/123'
        }
      });
      console.log(`✅ ${type} notification triggered`);
    } catch (error) {
      console.error('Failed to trigger notification:', error);
    }
  };

  // Show auth screen if not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-purple-100 p-4">
        {showAuth === 'login' ? (
          <Login onSwitchToRegister={() => setShowAuth('register')} />
        ) : (
          <Register onSwitchToLogin={() => setShowAuth('login')} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        onNavigate={setCurrentPage} 
        currentPage={currentPage}
        onCreatePost={() => setShowPostCreation(true)}
        onProfileClick={() => setCurrentPage('profile')}
      />

      <main className="pt-20 pb-8">
        {currentPage === 'feed' ? (
          <Feed key={refreshFeed} />
        ) : currentPage === 'preferences' ? (
          <NotificationPreferences />
        ) : (
          <UserProfile userId={user.id} />
        )}
      </main>

      {/* Post Creation Modal */}
      {showPostCreation && (
        <PostCreation 
          onClose={() => setShowPostCreation(false)}
          onPostCreated={() => {
            setRefreshFeed(prev => prev + 1);
            setCurrentPage('feed');
          }}
        />
      )}

      {/* Test Control Panel (Development Only) */}
      {currentPage === 'feed' && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl p-4 border-2 border-purple-200 z-40">
          <h3 className="text-sm font-bold text-gray-700 mb-3 text-center">
            🧪 Test Panel
          </h3>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleTestTrigger('LIKE')}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
            >
              ❤️ Trigger LIKE
            </button>
            <button 
              onClick={() => handleTestTrigger('COMMENT')}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
            >
              💬 Trigger COMMENT
            </button>
            <button 
              onClick={() => handleTestTrigger('FOLLOW')}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium"
            >
              ➕ Trigger FOLLOW
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Events → Kafka → Processing → Socket
          </p>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-100">
        <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />
        
        <main className="max-w-7xl mx-auto px-4 py-6">
          {currentPage === 'feed' ? (
            <>
              {/* Feed Content */}
              <Feed />
              
              {/* Test Controls (Development Only) */}
              <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl p-6 border-2 border-purple-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Test Notifications
                </h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => handleTestTrigger('LIKE')}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
                  >
                    ❤️ Trigger LIKE
                  </button>
                  <button 
                    onClick={() => handleTestTrigger('COMMENT')}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                  >
                    💬 Trigger COMMENT
                  </button>
                  <button 
                    onClick={() => handleTestTrigger('FOLLOW')}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium"
                  >
                    ➕ Trigger FOLLOW
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Events → Kafka → Processing → Socket
                </p>
              </div>
            </>
          ) : (
            <NotificationPreferences />
          )}
        </main>
      </div>
    </SocketProvider>
  );
}

export default App;