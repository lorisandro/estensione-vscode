import { useState, useEffect } from 'react';
import { Settings, Analytics, ProfileVisit, ConnectionRequest, DEFAULT_SETTINGS, DEFAULT_ANALYTICS } from '../types';

const Popup = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [analytics, setAnalytics] = useState<Analytics>(DEFAULT_ANALYTICS);
  const [recentVisits, setRecentVisits] = useState<ProfileVisit[]>([]);
  const [recentConnections, setRecentConnections] = useState<ConnectionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const result = await chrome.storage.local.get(['settings', 'analytics', 'profileVisits', 'connectionRequests']);

    if (result.settings) setSettings(result.settings);
    if (result.analytics) setAnalytics(result.analytics);
    if (result.profileVisits) setRecentVisits(result.profileVisits.slice(-5).reverse());
    if (result.connectionRequests) setRecentConnections(result.connectionRequests.slice(-5).reverse());
  };

  const toggleAutoConnect = async () => {
    const newSettings = { ...settings, autoConnect: !settings.autoConnect };
    setSettings(newSettings);
    await chrome.storage.local.set({ settings: newSettings });
  };

  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-[400px] h-[600px] bg-gray-50">
      {/* Header */}
      <div className="bg-linkedin text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">LinkedBoost</h1>
            <p className="text-sm text-blue-100">LinkedIn Automation</p>
          </div>
          <button
            onClick={openSettings}
            className="p-2 hover:bg-linkedin-dark rounded-lg transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'border-b-2 border-linkedin text-linkedin'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-b-2 border-linkedin text-linkedin'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Quick Settings
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto h-[calc(600px-140px)]">
        {activeTab === 'dashboard' ? (
          <div className="space-y-4">
            {/* Analytics Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-linkedin">{analytics.totalConnectionsSent}</div>
                <div className="text-xs text-gray-600 mt-1">Connections Sent</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-linkedin">{analytics.totalProfilesViewed}</div>
                <div className="text-xs text-gray-600 mt-1">Profiles Viewed</div>
              </div>
            </div>

            {/* Auto Connect Toggle */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Auto-Connect</div>
                  <div className="text-xs text-gray-600">Automatically send connection requests</div>
                </div>
                <button
                  onClick={toggleAutoConnect}
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
              <div className="mt-3 text-xs text-gray-500">
                Daily limit: {settings.dailyLimit} | Delay: {settings.delayBetweenRequests / 1000}s
              </div>
            </div>

            {/* Recent Connections */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Recent Connections</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {recentConnections.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No connections sent yet
                  </div>
                ) : (
                  recentConnections.map((conn, idx) => (
                    <div key={idx} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {conn.profileName}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatTimestamp(conn.timestamp)}
                          </div>
                        </div>
                        <span
                          className={`ml-2 px-2 py-1 text-xs rounded-full ${
                            conn.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : conn.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {conn.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Profile Views */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Recent Profile Views</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {recentVisits.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No profiles viewed yet
                  </div>
                ) : (
                  recentVisits.map((visit, idx) => (
                    <div key={idx} className="p-3">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {visit.profileName}
                      </div>
                      {visit.profileHeadline && (
                        <div className="text-xs text-gray-600 mt-1 truncate">
                          {visit.profileHeadline}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(visit.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">Quick Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-700">Daily Limit</label>
                  <div className="mt-1 text-2xl font-bold text-linkedin">{settings.dailyLimit}</div>
                </div>

                <div>
                  <label className="text-sm text-gray-700">Delay Between Requests</label>
                  <div className="mt-1 text-2xl font-bold text-linkedin">
                    {settings.delayBetweenRequests / 1000}s
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-700">Track Profile Views</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {settings.trackViews ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>

              <button
                onClick={openSettings}
                className="mt-4 w-full py-2 px-4 bg-linkedin text-white rounded-lg hover:bg-linkedin-dark transition-colors"
              >
                Open Full Settings
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-900">Usage Tips</h3>
                  <div className="mt-2 text-xs text-blue-800">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Enable auto-connect on search results pages</li>
                      <li>Customize your connection note in settings</li>
                      <li>Stay under daily limits to avoid detection</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Popup;
