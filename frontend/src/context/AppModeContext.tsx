/**
 * App Mode Context
 * Provides a Production/Testing mode toggle across the app.
 * Testing mode shows dev tools (PostTester, Dashboard, Database, Notification Tester).
 * Production mode hides them for a clean showcase experience.
 * 
 * Persists the user's choice in localStorage so it survives page refreshes.
 */
import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type AppMode = 'production' | 'testing';

interface AppModeContextType {
    mode: AppMode;
    toggleMode: () => void;
    isTesting: boolean;
}

const AppModeContext = createContext<AppModeContextType | null>(null);

export const useAppMode = (): AppModeContextType => {
    const context = useContext(AppModeContext);
    if (!context) {
        throw new Error('useAppMode must be used within AppModeProvider');
    }
    return context;
};

export const AppModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<AppMode>(() => {
        const saved = localStorage.getItem('appMode');
        return (saved === 'testing' || saved === 'production') ? saved : 'production';
    });

    const toggleMode = () => {
        setMode(prev => {
            const next = prev === 'production' ? 'testing' : 'production';
            localStorage.setItem('appMode', next);
            return next;
        });
    };

    return (
        <AppModeContext.Provider value={{ mode, toggleMode, isTesting: mode === 'testing' }}>
            {children}
        </AppModeContext.Provider>
    );
};
