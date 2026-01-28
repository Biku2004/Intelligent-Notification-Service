/**
 * Connection Status Indicator
 * Shows WebSocket connection state and allows manual reconnection
 * 
 * RELIABILITY: P1 Fix #2 - Visual feedback for connection status
 */
import React from 'react';
import { useSocket } from '../hooks/useSocket';
import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
    const { connectionState, reconnect } = useSocket();

    // Only show when not connected
    if (connectionState === 'connected') {
        return null;
    }

    const statusConfig = {
        disconnected: {
            icon: WifiOff,
            color: 'bg-red-500',
            text: 'Disconnected',
            showRetry: true,
        },
        connecting: {
            icon: Loader2,
            color: 'bg-yellow-500',
            text: 'Connecting...',
            showRetry: false,
        },
        reconnecting: {
            icon: RefreshCw,
            color: 'bg-yellow-500',
            text: 'Reconnecting...',
            showRetry: false,
        },
        connected: {
            icon: Wifi,
            color: 'bg-green-500',
            text: 'Connected',
            showRetry: false,
        },
    };

    const config = statusConfig[connectionState];
    const Icon = config.icon;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${config.color} text-white`}>
                <Icon
                    className={`w-5 h-5 ${connectionState === 'connecting' || connectionState === 'reconnecting' ? 'animate-spin' : ''}`}
                />
                <span className="font-medium">{config.text}</span>

                {config.showRetry && (
                    <button
                        onClick={reconnect}
                        className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Compact connection indicator for navbar
 */
export const ConnectionDot: React.FC = () => {
    const { connectionState, reconnect } = useSocket();

    const colorMap = {
        connected: 'bg-green-500',
        connecting: 'bg-yellow-500 animate-pulse',
        reconnecting: 'bg-yellow-500 animate-pulse',
        disconnected: 'bg-red-500',
    };

    const titleMap = {
        connected: 'Connected to notification server',
        connecting: 'Connecting to notification server...',
        reconnecting: 'Reconnecting to notification server...',
        disconnected: 'Disconnected from notification server - Click to retry',
    };

    return (
        <button
            onClick={connectionState === 'disconnected' ? reconnect : undefined}
            title={titleMap[connectionState]}
            className={`w-3 h-3 rounded-full ${colorMap[connectionState]} ${connectionState === 'disconnected' ? 'cursor-pointer hover:ring-2 hover:ring-red-300' : 'cursor-default'
                }`}
        />
    );
};
