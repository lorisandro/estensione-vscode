import { useState, useEffect } from 'react';
import { Settings, DEFAULT_SETTINGS, Analytics, DEFAULT_ANALYTICS } from '../types';
import { StorageManager } from '../utils/storage';

const Options = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [analytics, setAnalytics] = useState<Analytics>(DEFAULT_ANALYTICS);
  const [saved, setSaved] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const loadedSettings = await StorageManager.getSettings();
    const loadedAnalytics = await StorageManager.getAnalytics();
    const count = await StorageManager.getTodayConnectionCount();

    setSettings(loadedSettings);
    setAnalytics(loadedAnalytics);
    setTodayCount(count);
  };

  const handleSave = async () => {
    await StorageManager.setSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      await StorageManager.setSettings(DEFAULT_SETTINGS);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleClearData = async () => {
    if (confirm('This will clear all tracked profile visits and connection requests. Continue?')) {
      await chrome.storage.local.remove(['profileVisits', 'connectionRequests']);
      const newAnalytics = { ...DEFAULT_ANALYTICS, lastActivity: Date.now() };
      await StorageManager.setAnalytics(newAnalytics);
      setAnalytics(newAnalytics);
      alert('Data cleared successfully!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-linkedin text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold">LinkedBoost Settings</h1>
          <p className="text-blue-100 mt-2">Configure your LinkedIn automation preferences</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Save notification */}
        {saved && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Settings saved successfully!
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-3xl font-bold text-linkedin">{analytics.totalConnectionsSent}</div>
            <div className="text-sm text-gray-600 mt-1">Total Connections</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-3xl font-bold text-linkedin">{todayCount}</div>
            <div className="text-sm text-gray-600 mt-1">Today's Connections</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-3xl font-bold text-linkedin">{analytics.totalProfilesViewed}</div>
            <div className="text-sm text-gray-600 mt-1">Profiles Viewed</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-3xl font-bold text-linkedin">{settings.dailyLimit - todayCount}</div>
            <div className="text-sm text-gray-600 mt-1">Remaining Today</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Automation Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Automation Settings</h2>

              <div className="space-y-6">
                {/* Auto Connect Toggle */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Enable Auto-Connect</label>
                    <p className="text-sm text-gray-600">Automatically send connection requests on search results</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, autoConnect: !settings.autoConnect })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.autoConnect ? 'bg-linkedin' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.autoConnect ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Daily Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Daily Connection Limit: {settings.dailyLimit}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.dailyLimit}
                    onChange={(e) => setSettings({ ...settings, dailyLimit: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-linkedin"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Recommended: 30-50 per day to avoid LinkedIn limits
                  </p>
                </div>

                {/* Delay Between Requests */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Delay Between Requests: {settings.delayBetweenRequests / 1000} seconds
                  </label>
                  <input
                    type="range"
                    min="3000"
                    max="30000"
                    step="1000"
                    value={settings.delayBetweenRequests}
                    onChange={(e) => setSettings({ ...settings, delayBetweenRequests: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-linkedin"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Longer delays = more natural behavior = less likely to be flagged
                  </p>
                </div>

                {/* Track Views */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Track Profile Views</label>
                    <p className="text-sm text-gray-600">Log profiles you visit for analytics</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, trackViews: !settings.trackViews })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.trackViews ? 'bg-linkedin' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.trackViews ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Message Template */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Message Template</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Personalized Note
                  </label>
                  <textarea
                    value={settings.personalizedNote}
                    onChange={(e) => setSettings({ ...settings, personalizedNote: e.target.value })}
                    rows={4}
                    maxLength={300}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none"
                    placeholder="Hi {{name}}, I'd love to connect!"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Use {'{'}{'{'} name {'}'}{'}'} to insert the first name. Max 300 characters.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {settings.personalizedNote.length}/300 characters
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Preview:</h3>
                  <p className="text-sm text-blue-800">
                    {settings.personalizedNote.replace('{{name}}', 'John')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

              <div className="space-y-3">
                <button
                  onClick={handleSave}
                  className="w-full py-2 px-4 bg-linkedin text-white rounded-lg hover:bg-linkedin-dark transition-colors font-medium"
                >
                  Save Settings
                </button>

                <button
                  onClick={handleReset}
                  className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Reset to Defaults
                </button>

                <button
                  onClick={handleClearData}
                  className="w-full py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                >
                  Clear All Data
                </button>
              </div>
            </div>

            {/* Safety Tips */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-yellow-900 mb-3">⚠️ Safety Tips</h3>
              <ul className="text-xs text-yellow-800 space-y-2">
                <li>• Keep daily limit under 50</li>
                <li>• Use delays of 5+ seconds</li>
                <li>• Personalize your connection notes</li>
                <li>• Don't run automation 24/7</li>
                <li>• Review LinkedIn's terms regularly</li>
              </ul>
            </div>

            {/* Support */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Need Help?</h3>
              <p className="text-xs text-gray-600 mb-4">
                Having issues or want to upgrade to premium features?
              </p>
              <button className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Options;
