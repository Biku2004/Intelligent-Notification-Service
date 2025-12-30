import { useState, useEffect } from 'react';
import { SocketProvider } from './context/SocketProvider';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { Navbar } from './components/Navbar';
import { Feed } from './components/Feed';
import { NotificationPreferences } from './components/NotificationPreferences';
import { UserProfile } from './components/UserProfile';
import { PostCreation } from './components/PostCreation';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ToastContainer } from './components/ToastNotification';
import type { Toast } from './components/ToastNotification';
import { NotificationTester } from './components/NotificationTester';

type Page = 'feed' | 'preferences' | 'profile' | 'tester';

function AppContent() {
  const { user } = useAuth();
  const { notifications } = useSocket();
  const [currentPage, setCurrentPage] = useState<Page>('feed');
  const [showPostCreation, setShowPostCreation] = useState(false);
  const [showAuth, setShowAuth] = useState<'login' | 'register'>('login');
  const [refreshFeed, setRefreshFeed] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Handle incoming notifications and show toasts for likes (1-5 count)
  useEffect(() => {
    if (notifications.length === 0) return;
    
    const latestNotification = notifications[0];
    
    // Show toast for LIKE with count 1-5, COMMENT always, FOLLOW 1-3
    const shouldShowToast = 
      (latestNotification.type === 'LIKE' && (latestNotification.metadata?.aggregatedCount || 1) <= 5) ||
      (latestNotification.type === 'COMMENT') ||
      (latestNotification.type === 'COMMENT_REPLY') ||
      (latestNotification.type === 'FOLLOW' && (latestNotification.metadata?.aggregatedCount || 1) <= 3) ||
      (latestNotification.type === 'BELL_POST');

    if (shouldShowToast) {
      const toastType = latestNotification.type.toLowerCase();
      const validTypes = ['like', 'comment', 'follow', 'bell_post'];
      const mappedType = validTypes.includes(toastType) ? toastType : 'like';
      
      const newToast: Toast = {
        id: latestNotification.id,
        type: mappedType as Toast['type'],
        message: latestNotification.message,
        actorName: latestNotification.actorName || 'Someone',
        actorAvatar: latestNotification.actorAvatar,
        imageUrl: latestNotification.imageUrl,
        count: latestNotification.metadata?.aggregatedCount,
      };

      // Use setTimeout to avoid setState in effect
      setTimeout(() => {
        setToasts(prev => [newToast, ...prev]);

        // Auto-remove toast after 5 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== newToast.id));
        }, 5000);
      }, 0);
    }
  }, [notifications.length]); // Only depend on length to avoid infinite loop

  const handleCloseToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={handleCloseToast} />

      <main className="pt-20 pb-8">
        {currentPage === 'feed' ? (
          <Feed key={refreshFeed} />
        ) : currentPage === 'preferences' ? (
          <NotificationPreferences />
        ) : currentPage === 'tester' ? (
          <NotificationTester />
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