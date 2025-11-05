// FocusFlow Popup Script

// DOM Elements
const focusModeToggle = document.getElementById('focusModeToggle');
const focusStatus = document.getElementById('focusStatus');
const focusSubtext = document.getElementById('focusSubtext');

const timerDisplay = document.getElementById('timerDisplay');
const timerMode = document.getElementById('timerMode');
const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');

const todayFocusTime = document.getElementById('todayFocusTime');
const todayBlockedCount = document.getElementById('todayBlockedCount');
const currentStreak = document.getElementById('currentStreak');

const settingsBtn = document.getElementById('settingsBtn');
const addSiteBtn = document.getElementById('addSiteBtn');
const viewStatsBtn = document.getElementById('viewStatsBtn');
const upgradeBtn = document.getElementById('upgradeBtn');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadFocusMode();
  await loadTimerState();
  await loadStats();
  await checkPremiumStatus();
});

// Focus Mode Toggle
focusModeToggle.addEventListener('change', async (e) => {
  const isEnabled = e.target.checked;

  await chrome.storage.local.set({ focusModeEnabled: isEnabled });

  // Notify background script
  chrome.runtime.sendMessage({
    action: 'toggleFocusMode',
    enabled: isEnabled
  });

  updateFocusUI(isEnabled);
});

async function loadFocusMode() {
  const { focusModeEnabled } = await chrome.storage.local.get('focusModeEnabled');
  const isEnabled = focusModeEnabled || false;

  focusModeToggle.checked = isEnabled;
  updateFocusUI(isEnabled);
}

function updateFocusUI(isEnabled) {
  if (isEnabled) {
    focusStatus.textContent = 'Focus Mode ON';
    focusStatus.classList.add('text-indigo-600');
    focusStatus.classList.remove('text-gray-700');
    focusSubtext.textContent = 'Distractions are blocked';
    focusSubtext.classList.add('text-indigo-400');
  } else {
    focusStatus.textContent = 'Currently Off';
    focusStatus.classList.remove('text-indigo-600');
    focusStatus.classList.add('text-gray-700');
    focusSubtext.textContent = 'Enable to block distractions';
    focusSubtext.classList.remove('text-indigo-400');
  }
}

// Pomodoro Timer
let timerInterval = null;

startTimerBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'startTimer' });
  startTimerBtn.disabled = true;
  pauseTimerBtn.disabled = false;
});

pauseTimerBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'pauseTimer' });
  startTimerBtn.disabled = false;
  pauseTimerBtn.disabled = true;
});

resetTimerBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'resetTimer' });
  startTimerBtn.disabled = false;
  pauseTimerBtn.disabled = true;
});

async function loadTimerState() {
  const { timerState } = await chrome.storage.local.get('timerState');

  if (timerState) {
    updateTimerDisplay(timerState.timeRemaining, timerState.mode);

    if (timerState.isRunning) {
      startTimerBtn.disabled = true;
      pauseTimerBtn.disabled = false;
    }
  }

  // Listen for timer updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'timerUpdate') {
      updateTimerDisplay(message.timeRemaining, message.mode);
    }
  });
}

function updateTimerDisplay(seconds, mode) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  if (mode === 'work') {
    timerMode.textContent = 'Work';
    timerMode.className = 'text-xs px-2 py-1 bg-indigo-100 text-indigo-600 rounded-full';
  } else {
    timerMode.textContent = 'Break';
    timerMode.className = 'text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full';
  }
}

// Load Stats
async function loadStats() {
  const { stats } = await chrome.storage.local.get('stats');

  if (stats) {
    // Today's focus time
    const today = new Date().toDateString();
    const todayStats = stats[today] || { focusTime: 0, blockedCount: 0 };

    const hours = Math.floor(todayStats.focusTime / 3600);
    const minutes = Math.floor((todayStats.focusTime % 3600) / 60);

    todayFocusTime.textContent = `${hours}h ${minutes}m`;
    todayBlockedCount.textContent = todayStats.blockedCount;

    // Streak
    const streak = calculateStreak(stats);
    currentStreak.textContent = `🔥 ${streak} days`;
  }
}

function calculateStreak(stats) {
  if (!stats) return 0;

  let streak = 0;
  let currentDate = new Date();

  while (true) {
    const dateString = currentDate.toDateString();
    if (stats[dateString] && stats[dateString].focusTime > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Premium Status
async function checkPremiumStatus() {
  const { isPremium } = await chrome.storage.local.get('isPremium');

  if (isPremium) {
    // Hide upsell for premium users
    document.getElementById('premiumUpsell').style.display = 'none';
  }
}

// Button Actions
settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

addSiteBtn.addEventListener('click', async () => {
  const site = prompt('Enter website URL to block (e.g., facebook.com):');

  if (site && site.trim()) {
    const { blocklist } = await chrome.storage.sync.get('blocklist');
    const currentList = blocklist || [];

    // Check free tier limit (10 sites)
    const { isPremium } = await chrome.storage.local.get('isPremium');

    if (!isPremium && currentList.length >= 10) {
      alert('Free tier allows up to 10 sites. Upgrade to Premium for unlimited sites!');
      return;
    }

    const normalizedSite = site.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');

    if (!currentList.includes(normalizedSite)) {
      currentList.push(normalizedSite);
      await chrome.storage.sync.set({ blocklist: currentList });
      alert(`Added ${normalizedSite} to blocklist!`);
    } else {
      alert('Site already in blocklist!');
    }
  }
});

viewStatsBtn.addEventListener('click', () => {
  // Open stats page (to be implemented)
  chrome.runtime.openOptionsPage();
});

upgradeBtn.addEventListener('click', () => {
  // Open upgrade page (ExtensionPay integration to be added)
  alert('Upgrade feature coming soon! For now, this is the demo.');
  // TODO: Integrate ExtensionPay
  // ExtensionPay.openPaymentPage();
});
