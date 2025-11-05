// FocusFlow Options Page Script

const newSiteInput = document.getElementById('newSiteInput');
const addSiteBtn = document.getElementById('addSiteBtn');
const sitesList = document.getElementById('sitesList');
const siteCount = document.getElementById('siteCount');
const limitText = document.getElementById('limitText');

const workDurationInput = document.getElementById('workDuration');
const breakDurationInput = document.getElementById('breakDuration');
const autoStartBreakCheckbox = document.getElementById('autoStartBreak');
const notificationsCheckbox = document.getElementById('notifications');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const premiumSection = document.getElementById('premiumSection');

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadBlocklist();
  await loadSettings();
  await checkPremiumStatus();
});

// Blocklist Management
async function loadBlocklist() {
  const { blocklist } = await chrome.storage.sync.get('blocklist');
  const sites = blocklist || [];

  siteCount.textContent = sites.length;

  sitesList.innerHTML = '';

  if (sites.length === 0) {
    sitesList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No sites blocked yet. Add your first distraction!</p>';
    return;
  }

  sites.forEach(site => {
    const siteDiv = document.createElement('div');
    siteDiv.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition';

    siteDiv.innerHTML = `
      <span class="text-gray-700">${site}</span>
      <button class="text-red-500 hover:text-red-700 transition" data-site="${site}">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    `;

    const deleteBtn = siteDiv.querySelector('button');
    deleteBtn.addEventListener('click', () => removeSite(site));

    sitesList.appendChild(siteDiv);
  });
}

addSiteBtn.addEventListener('click', async () => {
  const site = newSiteInput.value.trim();

  if (!site) {
    alert('Please enter a website URL');
    return;
  }

  const { blocklist } = await chrome.storage.sync.get('blocklist');
  const currentList = blocklist || [];

  // Check premium status
  const { isPremium } = await chrome.storage.local.get('isPremium');

  if (!isPremium && currentList.length >= 10) {
    alert('Free tier allows up to 10 sites. Upgrade to Premium for unlimited sites!');
    return;
  }

  // Normalize URL
  const normalizedSite = site.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');

  if (currentList.includes(normalizedSite)) {
    alert('Site already in blocklist!');
    return;
  }

  currentList.push(normalizedSite);
  await chrome.storage.sync.set({ blocklist: currentList });

  newSiteInput.value = '';
  await loadBlocklist();
});

async function removeSite(site) {
  const { blocklist } = await chrome.storage.sync.get('blocklist');
  const updatedList = blocklist.filter(s => s !== site);

  await chrome.storage.sync.set({ blocklist: updatedList });
  await loadBlocklist();
}

// Settings Management
async function loadSettings() {
  const { settings } = await chrome.storage.sync.get('settings');

  if (settings) {
    workDurationInput.value = settings.workDuration || 25;
    breakDurationInput.value = settings.breakDuration || 5;
    autoStartBreakCheckbox.checked = settings.autoStartBreak !== false;
    notificationsCheckbox.checked = settings.notifications !== false;
  }

  // Disable inputs for free users
  const { isPremium } = await chrome.storage.local.get('isPremium');

  if (!isPremium) {
    workDurationInput.disabled = true;
    breakDurationInput.disabled = true;
  }
}

saveSettingsBtn.addEventListener('click', async () => {
  const { isPremium } = await chrome.storage.local.get('isPremium');

  const settings = {
    workDuration: isPremium ? parseInt(workDurationInput.value) : 25,
    breakDuration: isPremium ? parseInt(breakDurationInput.value) : 5,
    autoStartBreak: autoStartBreakCheckbox.checked,
    notifications: notificationsCheckbox.checked
  };

  await chrome.storage.sync.set({ settings });

  // Update timer state if needed
  const { timerState } = await chrome.storage.local.get('timerState');
  timerState.workDuration = settings.workDuration * 60;
  timerState.breakDuration = settings.breakDuration * 60;

  await chrome.storage.local.set({ timerState });

  alert('Settings saved!');
});

// Premium Status
async function checkPremiumStatus() {
  const { isPremium } = await chrome.storage.local.get('isPremium');

  if (isPremium) {
    premiumSection.innerHTML = `
      <div class="text-center py-8">
        <div class="w-16 h-16 bg-yellow-400 rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Premium Active</h2>
        <p class="text-gray-600">Thank you for supporting FocusFlow! 🎉</p>
      </div>
    `;

    limitText.innerHTML = 'Premium: Unlimited sites';
  }
}

// Enter key support for adding sites
newSiteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSiteBtn.click();
  }
});
