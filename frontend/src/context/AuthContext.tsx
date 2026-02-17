/**
 * Authentication Context
 * Provides user state and authentication methods across the app
 */
import React, { createContext, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { SOCIAL_API_URL } from '../config/api';
import type { User, AuthResponse } from '../types';

// Update AuthContextType as per instruction
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void; // Changed parameter name to userData
}

export const AuthContext = createContext<AuthContextType | null>(null);

// Remove const API_BASE = 'http://localhost:3003';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state from localStorage
  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem('authUser');
      if (!storedUser) return null;

      const parsedUser = JSON.parse(storedUser);
      // Validate that the user object has required properties
      if (parsedUser && parsedUser.id && parsedUser.email) {
        return parsedUser;
      }
      // Clear invalid user data
      localStorage.removeItem('authUser');
      localStorage.removeItem('authToken');
      return null;
    } catch (error) {
      console.error('Error parsing stored user:', error);
      localStorage.removeItem('authUser');
      localStorage.removeItem('authToken');
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    // Only set token if both token and user exist
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.id && parsedUser.email) {
          // Set default axios header on initial load
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          return storedToken;
        }
      } catch (error) {
        console.error('Error validating stored auth:', error);
      }
    }

    // Clear invalid data
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    return null;
  });

  const login = async (email: string, password: string) => {
    const response = await axios.post<AuthResponse>(`${SOCIAL_API_URL}/api/auth/login`, {
      email,
      password
    });

    if (response.data.success) {
      const { user, token } = response.data;
      setUser(user);
      setToken(token);
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  };

  const register = async (email: string, username: string, password: string, name?: string) => {
    const response = await axios.post<AuthResponse>(`${SOCIAL_API_URL}/api/auth/register`, {
      email,
      username,
      password,
      name
    });

    if (response.data.success) {
      const { user, token } = response.data;
      setUser(user);
      setToken(token);
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('authUser', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
