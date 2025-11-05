import { StorageManager } from '../utils/storage';
import { DEFAULT_SETTINGS, DEFAULT_ANALYTICS } from '../types';

console.log('LinkedBoost background service worker loaded');

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');

  // Initialize default settings if not exists
  const settings = await StorageManager.getSettings();
  if (!settings) {
    await StorageManager.setSettings(DEFAULT_SETTINGS);
  }

  const analytics = await StorageManager.getAnalytics();
  if (!analytics) {
    await StorageManager.setAnalytics(DEFAULT_ANALYTICS);
  }

  // Create alarm for daily reset
  chrome.alarms.create('dailyReset', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60, // Once per day
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    console.log('Daily reset triggered');
    // Reset daily counters if needed
    // The daily limit is checked by comparing timestamps, so no manual reset needed
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    StorageManager.getSettings().then(sendResponse);
    return true; // Indicates async response
  }

  if (message.type === 'UPDATE_SETTINGS') {
    StorageManager.setSettings(message.settings).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_ANALYTICS') {
    StorageManager.getAnalytics().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_TODAY_COUNT') {
    StorageManager.getTodayConnectionCount().then(sendResponse);
    return true;
  }
});

// Utility function to get next midnight timestamp
function getNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com')) {
    console.log('LinkedIn page loaded:', tab.url);
  }
});

// Keep service worker alive
let keepAliveInterval: NodeJS.Timeout | null = null;

function keepAlive() {
  if (keepAliveInterval === null) {
    keepAliveInterval = setInterval(() => {
      chrome.runtime.getPlatformInfo(() => {
        // Just a dummy call to keep the service worker alive
      });
    }, 20000); // Every 20 seconds
  }
}

keepAlive();
