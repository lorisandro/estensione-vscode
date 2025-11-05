// Blocked Page Script

// Get blocked site from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const blockedSite = urlParams.get('site') || 'this site';

document.getElementById('blockedSite').textContent = blockedSite;

// Random motivational quotes
const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" },
  { text: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { text: "Clarity of mind means clarity of passion, too.", author: "Blaise Pascal" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "You can always find a distraction if you're looking for one.", author: "Tom Kite" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" }
];

// Display random quote
const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
document.getElementById('quote').textContent = `"${randomQuote.text}"`;

// Go back button
document.getElementById('goBackBtn').addEventListener('click', () => {
  window.history.back();
});

// Disable focus mode button
document.getElementById('disableFocusBtn').addEventListener('click', async () => {
  // Send message to background to disable focus mode
  chrome.runtime.sendMessage({
    action: 'toggleFocusMode',
    enabled: false
  });

  await chrome.storage.local.set({ focusModeEnabled: false });

  // Go back to previous page
  window.history.back();
});
