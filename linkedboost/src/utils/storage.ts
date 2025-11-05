import { StorageData, Settings, Analytics, ProfileVisit, ConnectionRequest, DEFAULT_SETTINGS, DEFAULT_ANALYTICS } from '../types';

export class StorageManager {
  static async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  }

  static async setSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ settings });
  }

  static async getAnalytics(): Promise<Analytics> {
    const result = await chrome.storage.local.get('analytics');
    return result.analytics || DEFAULT_ANALYTICS;
  }

  static async setAnalytics(analytics: Analytics): Promise<void> {
    await chrome.storage.local.set({ analytics });
  }

  static async getProfileVisits(): Promise<ProfileVisit[]> {
    const result = await chrome.storage.local.get('profileVisits');
    return result.profileVisits || [];
  }

  static async addProfileVisit(visit: ProfileVisit): Promise<void> {
    const visits = await this.getProfileVisits();
    visits.push(visit);
    // Keep only last 100 visits
    const recentVisits = visits.slice(-100);
    await chrome.storage.local.set({ profileVisits: recentVisits });

    // Update analytics
    const analytics = await this.getAnalytics();
    analytics.totalProfilesViewed++;
    analytics.lastActivity = Date.now();
    await this.setAnalytics(analytics);
  }

  static async getConnectionRequests(): Promise<ConnectionRequest[]> {
    const result = await chrome.storage.local.get('connectionRequests');
    return result.connectionRequests || [];
  }

  static async addConnectionRequest(request: ConnectionRequest): Promise<void> {
    const requests = await this.getConnectionRequests();
    requests.push(request);
    // Keep only last 100 requests
    const recentRequests = requests.slice(-100);
    await chrome.storage.local.set({ connectionRequests: recentRequests });

    // Update analytics
    const analytics = await this.getAnalytics();
    if (request.status === 'sent') {
      analytics.totalConnectionsSent++;
    }
    analytics.lastActivity = Date.now();
    await this.setAnalytics(analytics);
  }

  static async getTodayConnectionCount(): Promise<number> {
    const requests = await this.getConnectionRequests();
    const today = new Date().setHours(0, 0, 0, 0);
    return requests.filter(req => req.timestamp >= today && req.status === 'sent').length;
  }

  static async canSendConnection(): Promise<{ can: boolean; reason?: string }> {
    const settings = await this.getSettings();
    const todayCount = await this.getTodayConnectionCount();

    if (!settings.autoConnect) {
      return { can: false, reason: 'Auto-connect is disabled' };
    }

    if (todayCount >= settings.dailyLimit) {
      return { can: false, reason: 'Daily limit reached' };
    }

    return { can: true };
  }
}
