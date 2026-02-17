import { useState, useEffect } from 'react';
import { SocketProvider } from './context/SocketProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { AppModeProvider } from './context/AppModeContext';
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
import { SystemDashboard } from './components/SystemDashboard';
import DatabaseViewer from './pages/DatabaseViewer';

type Page = 'feed' | 'preferences' | 'profile' | 'tester' | 'dashboard' | 'database';

function AppContent() {
  const { user } = useAuth();
  const { notifications } = useSocket();
  const [currentPage, setCurrentPage] = useState<Page>('feed');
  const [showPostCreation, setShowPostCreation] = useState(false);
  const [showAuth, setShowAuth] = useState<'login' | 'register'>('login');
  const [refreshFeed, setRefreshFeed] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Deep-link support: parse URL hash for post ID or user profile
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    // Format: #/post/<postId>
    const postMatch = hash.match(/^#\/post\/(.+)$/);
    if (postMatch) {
      setDeepLinkPostId(postMatch[1]);
      setCurrentPage('feed');
    }
    // Format: #/user/<userId>
    const userMatch = hash.match(/^#\/user\/(.+)$/);
    if (userMatch) {
      setViewingUserId(userMatch[1]);
      setCurrentPage('profile');
    }
  }, []);

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
        message: latestNotification.message || '',
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

  /**
   * Handle navigating to a user profile from search or other components
   */
  const handleUserSelect = (userId: string) => {
    setViewingUserId(userId);
    setCurrentPage('profile');
    window.location.hash = `/user/${userId}`;
  };

  /**
   * Handle page navigation and update hash
   */
  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    if (page === 'feed') {
      setDeepLinkPostId(null);
      window.location.hash = '';
    } else if (page === 'profile') {
      setViewingUserId(null); // Will show own profile
      window.location.hash = '';
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

  const profileUserId = viewingUserId || user.id;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onCreatePost={() => setShowPostCreation(true)}
        onProfileClick={() => {
          setViewingUserId(null);
          setCurrentPage('profile');
          window.location.hash = '';
        }}
        onUserSelect={handleUserSelect}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={handleCloseToast} />

      <main className="pt-20 pb-8">
        {currentPage === 'feed' ? (
          <Feed key={refreshFeed} highlightPostId={deepLinkPostId} />
        ) : currentPage === 'preferences' ? (
          <NotificationPreferences />
        ) : currentPage === 'tester' ? (
          <NotificationTester />
        ) : currentPage === 'dashboard' ? (
          <SystemDashboard />
        ) : currentPage === 'database' ? (
          <DatabaseViewer />
        ) : (
          <UserProfile userId={profileUserId} />
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
        <AppModeProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AppModeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;