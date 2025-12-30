import React, { useState } from 'react';
import { Bell, Mail, MessageSquare, Clock, Save } from 'lucide-react';
import type { UserPreferences } from '../types';

/**
 * NotificationPreferences Component
 * 
 * Allows users to customize their notification settings including:
 * - Delivery channels (Push, Email, SMS)
 * - Notification categories (Activity, Social, Marketing)
 * - Do Not Disturb schedule
 * 
 * This component manages all user preference states locally and
 * persists them via API call on save.
 */
export const NotificationPreferences: React.FC = () => {
  // Initialize preferences with default values
  // These would typically be fetched from the backend API on mount
  const [preferences, setPreferences] = useState<UserPreferences>({
    emailEnabled: true,      // Email notifications enabled by default
    smsEnabled: false,       // SMS disabled (cost consideration)
    pushEnabled: true,       // Browser push notifications enabled
    marketing: false,        // Marketing emails disabled by default
    activity: true,          // Activity notifications (likes, comments) enabled
    social: true,            // Social notifications (follows, shares) enabled
    dndEnabled: false,       // Do Not Disturb disabled by default
    dndStartTime: '22:00',   // DND start time (10 PM)
    dndEndTime: '08:00',     // DND end time (8 AM)
  });

  // Track save confirmation message visibility
  const [saved, setSaved] = useState(false);

  /**
   * Toggle boolean preference values
   * @param key - The preference key to toggle
   */
  const handleToggle = (key: keyof UserPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  /**
   * Update DND time values
   * @param key - Either 'dndStartTime' or 'dndEndTime'
   * @param value - Time string in HH:mm format (e.g., "22:00")
   */
  const handleTimeChange = (key: 'dndStartTime' | 'dndEndTime', value: string) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /**
   * Save preferences to backend
   * TODO: Replace with actual API call to /api/preferences/:userId
   * Should send PUT request with preferences object
   */
  const handleSave = async () => {
    // Example API call structure:
    // await axios.put(`/api/preferences/${userId}`, preferences);
    
    console.log('Saving preferences:', preferences);
    
    // Show success message
    setSaved(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Preferences</h2>

      {/* ============================================ */}
      {/* SECTION 1: Delivery Channels                */}
      {/* Controls how notifications are delivered    */}
      {/* ============================================ */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <MessageSquare size={20} />
          Delivery Channels
        </h3>
        
        <div className="space-y-4">
          {/* Push Notifications Toggle */}
          {/* Real-time browser notifications via WebSocket */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="text-purple-600" size={20} />
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-500">Receive real-time notifications in your browser</p>
              </div>
            </div>
            {/* Custom toggle switch (styled checkbox) */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.pushEnabled}
                onChange={() => handleToggle('pushEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Email Notifications Toggle */}
          {/* Background email delivery via SendGrid */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="text-blue-600" size={20} />
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Get notified via email</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.emailEnabled}
                onChange={() => handleToggle('emailEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* SMS Notifications Toggle */}
          {/* Critical alerts only (OTP, Security) via Twilio */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-green-600" size={20} />
              <div>
                <p className="font-medium text-gray-900">SMS Notifications</p>
                <p className="text-sm text-gray-500">Critical alerts only (OTP, Security)</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.smsEnabled}
                onChange={() => handleToggle('smsEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 2: Notification Categories          */}
      {/* Filter which types of notifications to show */}
      {/* ============================================ */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Notification Categories</h3>
        
        <div className="space-y-3">
          {/* Activity Category: Likes, Comments, Mentions */}
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
            <span className="text-gray-900">Activity (Likes, Comments, Mentions)</span>
            <input
              type="checkbox"
              checked={preferences.activity}
              onChange={() => handleToggle('activity')}
              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
            />
          </label>

          {/* Social Category: Follows, Shares */}
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
            <span className="text-gray-900">Social (Follows, Shares)</span>
            <input
              type="checkbox"
              checked={preferences.social}
              onChange={() => handleToggle('social')}
              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
            />
          </label>

          {/* Marketing Category: Promotional content */}
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
            <span className="text-gray-900">Marketing (Promotional content)</span>
            <input
              type="checkbox"
              checked={preferences.marketing}
              onChange={() => handleToggle('marketing')}
              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
            />
          </label>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 3: Do Not Disturb                   */}
      {/* Silence notifications during sleep hours    */}
      {/* ============================================ */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock size={20} />
          Do Not Disturb
        </h3>
        
        <div className="space-y-4">
          {/* DND Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Enable DND</p>
              <p className="text-sm text-gray-500">Silence notifications during specified hours</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.dndEnabled}
                onChange={() => handleToggle('dndEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* DND Time Range Picker (shown only when DND is enabled) */}
          {preferences.dndEnabled && (
            <div className="grid grid-cols-2 gap-4 pl-4">
              {/* DND Start Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={preferences.dndStartTime}
                  onChange={(e) => handleTimeChange('dndStartTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {/* DND End Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={preferences.dndEndTime}
                  onChange={(e) => handleTimeChange('dndEndTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* Save Button & Success Message               */}
      {/* ============================================ */}
      <button
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
      >
        <Save size={20} />
        {saved ? 'Preferences Saved!' : 'Save Preferences'}
      </button>

      {/* Success confirmation message */}
      {saved && (
        <p className="text-center text-green-600 mt-3 text-sm font-medium">
          ✓ Your preferences have been updated successfully
        </p>
      )}
    </div>
  );
};
