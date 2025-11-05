// FocusFlow Background Service Worker

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('FocusFlow installed!');

  // Set default values
  await chrome.storage.local.set({
    focusModeEnabled: false,
    isPremium: false,
    timerState: {
      isRunning: false,
      timeRemaining: 25 * 60, // 25 minutes in seconds
      mode: 'work',
      workDuration: 25 * 60,
      breakDuration: 5 * 60
    }
  });

  await chrome.storage.sync.set({
    blocklist: [],
    settings: {
      workDuration: 25,
      breakDuration: 5,
      autoStartBreak: true,
      autoStartWork: false,
      notifications: true
    }
  });

  // Initialize stats
  const today = new Date().toDateString();
  await chrome.storage.local.set({
    stats: {
      [today]: {
        focusTime: 0,
        blockedCount: 0
      }
    }
  });
});

// Listen for tab updates to block sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await checkAndBlockSite(tabId, tab.url);
  }
});

// Also check when tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await checkAndBlockSite(activeInfo.tabId, tab.url);
  }
});

// Check if site should be blocked
async function checkAndBlockSite(tabId, url) {
  try {
    const { focusModeEnabled } = await chrome.storage.local.get('focusModeEnabled');

    if (!focusModeEnabled) return;

    const { blocklist } = await chrome.storage.sync.get('blocklist');

    if (!blocklist || blocklist.length === 0) return;

    // Parse URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    // Check if site is in blocklist
    const isBlocked = blocklist.some(site => {
      return hostname.includes(site) || site.includes(hostname);
    });

    if (isBlocked) {
      // Block the site by redirecting to blocked page
      const blockedPageUrl = chrome.runtime.getURL('content/blocked.html') +
        `?site=${encodeURIComponent(hostname)}`;

      chrome.tabs.update(tabId, { url: blockedPageUrl });

      // Increment blocked count
      await incrementBlockedCount();
    }
  } catch (error) {
    // Ignore errors for non-http(s) URLs
    if (!error.message.includes('Invalid URL')) {
      console.error('Error checking site:', error);
    }
  }
}

// Increment today's blocked count
async function incrementBlockedCount() {
  const today = new Date().toDateString();
  const { stats } = await chrome.storage.local.get('stats');

  if (!stats[today]) {
    stats[today] = { focusTime: 0, blockedCount: 0 };
  }

  stats[today].blockedCount++;

  await chrome.storage.local.set({ stats });
}

// Message listener for popup actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleFocusMode') {
    handleFocusModeToggle(message.enabled);
  } else if (message.action === 'startTimer') {
    startTimer();
  } else if (message.action === 'pauseTimer') {
    pauseTimer();
  } else if (message.action === 'resetTimer') {
    resetTimer();
  }

  return true;
});

// Handle focus mode toggle
async function handleFocusModeToggle(enabled) {
  // Update icon based on focus mode state
  const iconPath = enabled ? 'icons/icon-16.png' : 'icons/icon-disabled-16.png';

  chrome.action.setIcon({
    path: {
      16: iconPath,
      48: enabled ? 'icons/icon-48.png' : 'icons/icon-disabled-16.png',
      128: enabled ? 'icons/icon-128.png' : 'icons/icon-disabled-16.png'
    }
  });
}

// Pomodoro Timer Functions
let timerAlarm = 'pomodoroTimer';

async function startTimer() {
  const { timerState } = await chrome.storage.local.get('timerState');

  timerState.isRunning = true;
  timerState.startTime = Date.now();

  await chrome.storage.local.set({ timerState });

  // Create alarm that fires every second
  chrome.alarms.create(timerAlarm, { periodInMinutes: 1/60 });

  // Enable focus mode when work timer starts
  if (timerState.mode === 'work') {
    await chrome.storage.local.set({ focusModeEnabled: true });
    handleFocusModeToggle(true);
  }
}

async function pauseTimer() {
  const { timerState } = await chrome.storage.local.get('timerState');

  timerState.isRunning = false;

  await chrome.storage.local.set({ timerState });

  chrome.alarms.clear(timerAlarm);
}

async function resetTimer() {
  const { timerState } = await chrome.storage.local.get('timerState');

  timerState.isRunning = false;
  timerState.timeRemaining = timerState.mode === 'work'
    ? timerState.workDuration
    : timerState.breakDuration;

  await chrome.storage.local.set({ timerState });

  chrome.alarms.clear(timerAlarm);

  // Notify popup of reset
  chrome.runtime.sendMessage({
    action: 'timerUpdate',
    timeRemaining: timerState.timeRemaining,
    mode: timerState.mode
  });
}

// Listen for timer alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === timerAlarm) {
    await updateTimer();
  }
});

async function updateTimer() {
  const { timerState } = await chrome.storage.local.get('timerState');

  if (!timerState.isRunning) return;

  timerState.timeRemaining--;

  // Notify popup of update
  chrome.runtime.sendMessage({
    action: 'timerUpdate',
    timeRemaining: timerState.timeRemaining,
    mode: timerState.mode
  });

  // Check if timer completed
  if (timerState.timeRemaining <= 0) {
    await onTimerComplete(timerState);
  } else {
    await chrome.storage.local.set({ timerState });
  }
}

async function onTimerComplete(timerState) {
  const { settings } = await chrome.storage.sync.get('settings');

  // Send notification
  if (settings.notifications) {
    const title = timerState.mode === 'work'
      ? 'Work session complete!'
      : 'Break time over!';

    const message = timerState.mode === 'work'
      ? 'Great job! Time for a break.'
      : 'Back to work!';

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: title,
      message: message
    });
  }

  // Track focus time if work session
  if (timerState.mode === 'work') {
    await trackFocusTime(timerState.workDuration);
  }

  // Switch mode
  if (timerState.mode === 'work') {
    timerState.mode = 'break';
    timerState.timeRemaining = timerState.breakDuration;

    // Disable focus mode during break
    await chrome.storage.local.set({ focusModeEnabled: false });
    handleFocusModeToggle(false);

    // Auto-start break if enabled
    if (settings.autoStartBreak) {
      timerState.isRunning = true;
      timerState.startTime = Date.now();
    } else {
      timerState.isRunning = false;
    }
  } else {
    timerState.mode = 'work';
    timerState.timeRemaining = timerState.workDuration;

    // Auto-start work if enabled
    if (settings.autoStartWork) {
      timerState.isRunning = true;
      timerState.startTime = Date.now();

      // Enable focus mode
      await chrome.storage.local.set({ focusModeEnabled: true });
      handleFocusModeToggle(true);
    } else {
      timerState.isRunning = false;
    }
  }

  await chrome.storage.local.set({ timerState });

  // Notify popup
  chrome.runtime.sendMessage({
    action: 'timerUpdate',
    timeRemaining: timerState.timeRemaining,
    mode: timerState.mode
  });
}

// Track focus time
async function trackFocusTime(duration) {
  const today = new Date().toDateString();
  const { stats } = await chrome.storage.local.get('stats');

  if (!stats[today]) {
    stats[today] = { focusTime: 0, blockedCount: 0 };
  }

  stats[today].focusTime += duration;

  await chrome.storage.local.set({ stats });
}
