# Testing Guide - LinkedBoost

## Quick Start Test

### 1. Load Extension
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist` folder
6. Extension should appear with "LB" icon

### 2. Basic Tests

#### Test Popup
- Click LinkedBoost icon in toolbar
- Verify dashboard opens
- Check stats cards (should show 0)
- Toggle between Dashboard and Quick Settings tabs

#### Test Settings Page
- Click gear icon in popup OR
- Go to chrome://extensions → LinkedBoost → Options
- Verify sliders work
- Change message template
- Click Save Settings
- Reopen to verify settings persisted

#### Test Profile Tracking
1. Go to linkedin.com
2. Visit any profile page
3. Open LinkedBoost popup
4. Check "Recent Profile Views" section
5. Profile should be logged with timestamp

### 3. Developer Console

#### Background Service Worker
```
chrome://extensions/ → LinkedBoost → "Inspect views: service worker"
```
Should show: "LinkedBoost background service worker loaded"

#### Content Script on LinkedIn
```
LinkedIn page → F12 → Console
```
Should show: "LinkedBoost content script loaded"

### 4. Storage Inspection

```
LinkedIn page → F12 → Application → Storage → Extension Storage
```

Verify:
- settings object exists
- analytics object exists
- profileVisits array exists
- connectionRequests array exists

## Testing Auto-Connect (CAUTION!)

⚠️ **Use test LinkedIn account only!**

1. Set conservative limits:
   - Daily Limit: 5
   - Delay: 10 seconds
2. Go to LinkedIn search results
3. Enable Auto-Connect in popup
4. Watch for connection requests being sent
5. **Disable immediately after test**

Check:
- Console logs connection attempts
- "Recent Connections" updates in popup
- No errors in console

## Common Issues

### Extension won't load
- Verify you selected `dist` folder, not root
- Check manifest.json exists in dist/
- Rebuild: `npm run build`

### Popup blank/broken
- Check console for errors
- Reload extension: chrome://extensions → Reload icon
- Verify all files in dist/assets/

### Profile tracking not working
- Verify you're on a profile page (/in/ in URL)
- Check "Track Profile Views" is enabled
- Open console (F12) for errors

### Auto-connect not working
- Verify Auto-Connect toggle is ON
- Check you're on search results page
- Verify you haven't hit daily limit
- Check console for errors

## Development Workflow

### Watch mode:
```bash
npm run dev
```

After code changes:
1. Chrome saves changes automatically OR
2. Go to chrome://extensions/
3. Click reload icon on LinkedBoost
4. Test changes

### Full rebuild:
```bash
npm run build
```

Then reload extension in Chrome.

## Test Checklist

Before considering it production-ready:

- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] Settings page works
- [ ] Settings persist after Chrome restart
- [ ] Profile tracking logs visits
- [ ] Auto-connect sends requests (test account!)
- [ ] Daily limit is enforced
- [ ] Delay between requests works
- [ ] Message personalization works ({{name}})
- [ ] No console errors
- [ ] Storage data persists
- [ ] Clear data button works
- [ ] Reset settings button works

## Performance Testing

- [ ] Popup opens quickly (<500ms)
- [ ] Settings page loads fast
- [ ] No memory leaks (check Chrome Task Manager)
- [ ] Extension doesn't slow down LinkedIn

## Security Testing

- [ ] No sensitive data logged to console
- [ ] Storage uses chrome.storage.local (not exposed)
- [ ] No external API calls (all local)
- [ ] Permissions are minimal

## Ready for Production?

Once all tests pass:
1. Convert SVG icons to PNG
2. Take screenshots
3. Write privacy policy
4. Create Chrome Web Store listing
5. Submit for review

---

**Current Status**: ✅ Built and ready for local testing
**Next Step**: Load in Chrome and run through checklist above
