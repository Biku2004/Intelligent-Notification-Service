import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { NOTIFICATION_API_URL } from '../config/api';

interface DBRecord {
    id: string;
    createdAt: string;
    [key: string]: any;
}

interface DBStats {
    total: {
        notifications: number;
        likes: number;
        comments: number;
        follows: number;
    };
    recent: {
        notifications: number;
        likes: number;
        comments: number;
        follows: number;
    };
}

const DatabaseViewer: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'notifications' | 'likes' | 'comments' | 'follows'>('notifications');
    const [data, setData] = useState<DBRecord[]>([]);
    const [stats, setStats] = useState<DBStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    const fetchData = async (table: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`${NOTIFICATION_API_URL}/api/admin/db/${table}?limit=50`);
            if (response.data.success) {
                setData(response.data.data);
                setLastUpdate(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${NOTIFICATION_API_URL}/api/admin/db/stats`);
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const clearData = async () => {
        if (!confirm('Are you sure you want to clear all test data?')) return;

        try {
            await axios.delete(`${NOTIFICATION_API_URL}/api/admin/db/clear`);
            alert('Data cleared successfully!');
            fetchData(activeTab);
            fetchStats();
        } catch (error) {
            console.error('Failed to clear data:', error);
            alert('Failed to clear data');
        }
    };

    useEffect(() => {
        fetchData(activeTab);
        fetchStats();
    }, [activeTab]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchData(activeTab);
            fetchStats();
        }, 3000); // Refresh every 3 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, activeTab]);

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString() + '.' + date.getMilliseconds();
    };

    const renderTable = () => {
        if (loading && data.length === 0) {
            return <div className="loading">Loading...</div>;
        }

        if (data.length === 0) {
            return <div className="empty">No records found</div>;
        }

        const columns = Object.keys(data[0]).filter(key => key !== 'id');

        return (
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th key={col}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((record, idx) => (
                            <tr key={record.id || idx}>
                                {columns.map(col => (
                                    <td key={col}>
                                        {col === 'createdAt'
                                            ? formatTimestamp(record[col])
                                            : typeof record[col] === 'boolean'
                                                ? record[col] ? '✓' : '✗'
                                                : Array.isArray(record[col])
                                                    ? record[col].join(', ')
                                                    : record[col]?.toString() || '-'
                                        }
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="db-viewer">
            <div className="header">
                <h1>📊 Database Monitor</h1>
                <div className="controls">
                    <label className="auto-refresh">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh (3s)
                    </label>
                    <button onClick={() => fetchData(activeTab)} className="refresh-btn">
                        🔄 Refresh
                    </button>
                    <button onClick={clearData} className="clear-btn">
                        🗑️ Clear All Data
                    </button>
                    <span className="last-update">Last update: {lastUpdate}</span>
                </div>
            </div>

            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">Notifications</div>
                        <div className="stat-value">{stats.total.notifications}</div>
                        <div className="stat-recent">+{stats.recent.notifications} (5min)</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Likes</div>
                        <div className="stat-value">{stats.total.likes}</div>
                        <div className="stat-recent">+{stats.recent.likes} (5min)</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Comments</div>
                        <div className="stat-value">{stats.total.comments}</div>
                        <div className="stat-recent">+{stats.recent.comments} (5min)</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Follows</div>
                        <div className="stat-value">{stats.total.follows}</div>
                        <div className="stat-recent">+{stats.recent.follows} (5min)</div>
                    </div>
                </div>
            )}

            <div className="tabs">
                <button
                    className={activeTab === 'notifications' ? 'active' : ''}
                    onClick={() => setActiveTab('notifications')}
                >
                    Notification History ({stats?.total.notifications || 0})
                </button>
                <button
                    className={activeTab === 'likes' ? 'active' : ''}
                    onClick={() => setActiveTab('likes')}
                >
                    Likes ({stats?.total.likes || 0})
                </button>
                <button
                    className={activeTab === 'comments' ? 'active' : ''}
                    onClick={() => setActiveTab('comments')}
                >
                    Comments ({stats?.total.comments || 0})
                </button>
                <button
                    className={activeTab === 'follows' ? 'active' : ''}
                    onClick={() => setActiveTab('follows')}
                >
                    Follows ({stats?.total.follows || 0})
                </button>
            </div>

            {renderTable()}

            <style>{`
        .db-viewer {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header h1 {
          margin: 0;
          font-size: 24px;
        }

        .controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .auto-refresh {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .refresh-btn, .clear-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .refresh-btn {
          background: #3b82f6;
          color: white;
        }

        .refresh-btn:hover {
          background: #2563eb;
        }

        .clear-btn {
          background: #ef4444;
          color: white;
        }

        .clear-btn:hover {
          background: #dc2626;
        }

        .last-update {
          font-size: 12px;
          color: #666;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          border-radius: 12px;
          color: white;
        }

        .stat-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .stat-recent {
          font-size: 12px;
          opacity: 0.8;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 2px solid #e5e7eb;
        }

        .tabs button {
          padding: 12px 24px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s;
        }

        .tabs button:hover {
          color: #3b82f6;
        }

        .tabs button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .table-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid #e5e7eb;
        }

        td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 14px;
          color: #1f2937;
        }

        tr:hover {
          background: #f9fafb;
        }

        .loading, .empty {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .loading {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
};

export default DatabaseViewer;
