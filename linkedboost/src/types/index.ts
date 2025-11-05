export interface ProfileVisit {
  profileUrl: string;
  profileName: string;
  profileHeadline?: string;
  timestamp: number;
}

export interface ConnectionRequest {
  profileUrl: string;
  profileName: string;
  note?: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: number;
}

export interface Settings {
  dailyLimit: number;
  delayBetweenRequests: number; // milliseconds
  personalizedNote: string;
  autoConnect: boolean;
  trackViews: boolean;
}

export interface Analytics {
  totalConnectionsSent: number;
  totalProfilesViewed: number;
  successRate: number;
  lastActivity: number;
}

export interface StorageData {
  settings: Settings;
  profileVisits: ProfileVisit[];
  connectionRequests: ConnectionRequest[];
  analytics: Analytics;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyLimit: 50,
  delayBetweenRequests: 5000, // 5 seconds
  personalizedNote: "Hi {{name}}, I'd love to connect with you!",
  autoConnect: false,
  trackViews: true,
};

export const DEFAULT_ANALYTICS: Analytics = {
  totalConnectionsSent: 0,
  totalProfilesViewed: 0,
  successRate: 0,
  lastActivity: Date.now(),
};
