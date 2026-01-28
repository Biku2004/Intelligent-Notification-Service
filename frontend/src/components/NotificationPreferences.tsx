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
    <div className="max-w-3xl mx-auto">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Notification Preferences
            </h2>
            <p className="text-gray-500 mt-1">Manage how and when you receive notifications</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full text-purple-600">
            <Bell size={24} />
          </div>
        </div>

        {/* SECTION 1: Delivery Channels */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-purple-500" />
            Delivery Channels
          </h3>

          <div className="grid gap-4">
            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 p-4 rounded-xl hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                    <Bell size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Push Notifications</p>
                    <p className="text-sm text-gray-500">Real-time browser alerts</p>
                  </div>
                </div>
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
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 p-4 rounded-xl hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Email Notifications</p>
                    <p className="text-sm text-gray-500">Daily digests and important updates</p>
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
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 p-4 rounded-xl hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-lg text-green-600">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">SMS Alerts</p>
                    <p className="text-sm text-gray-500">Critical security alerts only</p>
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
        </div>

        {/* SECTION 2: Notification Categories */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Notification Categories</h3>

          <div className="grid gap-3">
            {[
              { key: 'activity', label: 'Activity', desc: 'Likes, comments, and mentions on your posts' },
              { key: 'social', label: 'Social', desc: 'New followers and friend suggestions' },
              { key: 'marketing', label: 'Marketing', desc: 'Product updates and newsletters' }
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 hover:ring-1 hover:ring-purple-300 transition-all duration-200 group">
                <div>
                  <span className="font-medium text-gray-900 block">{item.label}</span>
                  <span className="text-sm text-gray-500">{item.desc}</span>
                </div>
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${preferences[item.key as keyof UserPreferences]
                    ? 'bg-purple-600 border-purple-600'
                    : 'border-gray-300 group-hover:border-purple-400'
                  }`}>
                  {preferences[item.key as keyof UserPreferences] && (
                    <Save size={14} className="text-white" /> // Checkmark icon replacement
                  )}
                  <input
                    type="checkbox"
                    checked={!!preferences[item.key as keyof UserPreferences]}
                    onChange={() => handleToggle(item.key as keyof UserPreferences)}
                    className="hidden"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* SECTION 3: Do Not Disturb */}
        <div className="mb-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <Clock size={20} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Do Not Disturb</p>
                <p className="text-sm text-gray-500">Silence notifications during specific hours</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.dndEnabled}
                onChange={() => handleToggle('dndEnabled')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className={`grid grid-cols-2 gap-6 transition-all duration-300 ${preferences.dndEnabled ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={preferences.dndStartTime}
                onChange={(e) => handleTimeChange('dndStartTime', e.target.value)}
                disabled={!preferences.dndEnabled}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={preferences.dndEndTime}
                onChange={(e) => handleTimeChange('dndEndTime', e.target.value)}
                disabled={!preferences.dndEnabled}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={`w-full group relative flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg ${saved
              ? 'bg-green-500 text-white shadow-green-200'
              : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-xl hover:-translate-y-0.5'
            }`}
        >
          {saved ? (
            <>
              <span className="animate-bounce">✓</span> Preferences Saved
            </>
          ) : (
            <>
              <Save size={20} className="group-hover:scale-110 transition-transform" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
};
