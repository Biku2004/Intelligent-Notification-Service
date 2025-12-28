import { SocketProvider } from './context/SocketProvider';
import { Navbar } from './components/Navbar';
import axios from 'axios';

function App() {
  // A button to simulate "Someone liking MY post" (for testing)
  const handleTestTrigger = async () => {
    await axios.post('http://localhost:3000/api/events/trigger', {
      type: 'LIKE',
      actorId: 'user_Random',
      targetId: 'user_999', // Matches the ID in SocketContext
      metadata: { postId: 123 }
    });
  };

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="p-10 flex flex-col items-center gap-5">
          <h2 className="text-2xl font-bold">Welcome to the Feed</h2>
          <p>Click the button below to simulate another user liking your photo.</p>
          
          <button 
            onClick={handleTestTrigger}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Trigger "Like" Event
          </button>
        </div>
      </div>
    </SocketProvider>
  );
}

export default App;