import { StorageManager } from '../utils/storage';
import { ProfileVisit } from '../types';

console.log('LinkedBoost content script loaded');

// Track profile views
async function trackProfileView() {
  try {
    // Check if we're on a profile page
    const isProfilePage = window.location.pathname.includes('/in/');

    if (!isProfilePage) return;

    const settings = await StorageManager.getSettings();
    if (!settings.trackViews) return;

    // Extract profile information
    const profileName = document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() || 'Unknown';
    const profileHeadline = document.querySelector('.text-body-medium.break-words')?.textContent?.trim();

    const visit: ProfileVisit = {
      profileUrl: window.location.href,
      profileName,
      profileHeadline,
      timestamp: Date.now(),
    };

    await StorageManager.addProfileVisit(visit);
    console.log('Profile visit tracked:', profileName);
  } catch (error) {
    console.error('Error tracking profile view:', error);
  }
}

// Find and click connect buttons on search results
async function autoConnectOnSearchResults() {
  try {
    const { can, reason } = await StorageManager.canSendConnection();
    if (!can) {
      console.log('Cannot send connection:', reason);
      return;
    }

    // Check if we're on a search results or people page
    const isSearchPage = window.location.pathname.includes('/search/results/people') ||
                         window.location.pathname.includes('/mynetwork');

    if (!isSearchPage) return;

    const settings = await StorageManager.getSettings();

    // Find all "Connect" buttons that haven't been processed
    const connectButtons = Array.from(document.querySelectorAll('button[aria-label*="Invite"]'))
      .filter(button => {
        const btn = button as HTMLElement;
        return !btn.dataset.linkedboostProcessed && btn.textContent?.includes('Connect');
      }) as HTMLElement[];

    console.log(`Found ${connectButtons.length} unprocessed connect buttons`);

    for (const button of connectButtons) {
      // Mark as processed
      button.dataset.linkedboostProcessed = 'true';

      // Check if we can still send connections
      const check = await StorageManager.canSendConnection();
      if (!check.can) {
        console.log('Reached limit or auto-connect disabled');
        break;
      }

      // Extract profile info from the card
      const card = button.closest('.reusable-search__result-container') ||
                   button.closest('.mn-connection-card');

      if (!card) continue;

      const profileNameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]') ||
                           card.querySelector('.mn-connection-card__name');

      const profileName = profileNameEl?.textContent?.trim() || 'Unknown';
      const profileLink = card.querySelector('a[href*="/in/"]');
      const profileUrl = profileLink?.getAttribute('href') || '';

      // Prepare connection request data
      const connectionRequest = {
        profileUrl: profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com${profileUrl}`,
        profileName,
        note: settings.personalizedNote.replace('{{name}}', profileName.split(' ')[0]),
        status: 'pending' as const,
        timestamp: Date.now(),
      };

      // Click the connect button
      try {
        button.click();
        console.log('Clicked connect button for:', profileName);

        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Look for "Add a note" button
        const addNoteButton = document.querySelector('button[aria-label="Add a note"]') as HTMLElement;

        if (addNoteButton) {
          addNoteButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Find the textarea and add the note
          const noteTextarea = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
          if (noteTextarea && connectionRequest.note) {
            noteTextarea.value = connectionRequest.note;
            noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Click the "Send" button
        const sendButton = document.querySelector('button[aria-label="Send now"]') ||
                          document.querySelector('button[aria-label="Send invitation"]') as HTMLElement;

        if (sendButton) {
          sendButton.click();
          connectionRequest.status = 'sent';
          console.log('Connection request sent to:', profileName);
        } else {
          // If no send button, close the modal
          const closeButton = document.querySelector('button[aria-label="Dismiss"]') as HTMLElement;
          if (closeButton) closeButton.click();
        }

        // Save the connection request
        await StorageManager.addConnectionRequest(connectionRequest);

        // Wait for the delay before next request
        await new Promise(resolve => setTimeout(resolve, settings.delayBetweenRequests));
      } catch (error) {
        console.error('Error sending connection request:', error);
        connectionRequest.status = 'failed';
        await StorageManager.addConnectionRequest(connectionRequest);
      }
    }
  } catch (error) {
    console.error('Error in auto-connect:', error);
  }
}

// Initialize
(async () => {
  // Track profile view on load
  await trackProfileView();

  // Auto-connect on search results
  await autoConnectOnSearchResults();

  // Observer for dynamic content
  const observer = new MutationObserver(async (mutations) => {
    // Debounce to avoid too many calls
    clearTimeout((window as any).linkedboostDebounce);
    (window as any).linkedboostDebounce = setTimeout(async () => {
      await trackProfileView();
      await autoConnectOnSearchResults();
    }, 2000);
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Listen for URL changes (LinkedIn is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(async () => {
        await trackProfileView();
        await autoConnectOnSearchResults();
      }, 2000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
