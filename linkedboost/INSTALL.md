# LinkedBoost - Installation Guide

## Quick Start

### 1. Build the Extension

The extension has already been built! The production files are in the `dist` folder.

If you need to rebuild:

```bash
npm install
npm run build
```

### 2. Load the Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right corner)
4. Click **"Load unpacked"**
5. Select the `dist` folder from this project
6. The LinkedBoost extension should now appear in your extensions list!

### 3. Verify Installation

1. You should see the LinkedBoost icon (blue "LB") in your Chrome toolbar
2. Click the icon to open the popup
3. You should see the dashboard with analytics cards

### 4. Configure Settings

1. Click the LinkedBoost icon
2. Go to the "Quick Settings" tab OR click the settings gear icon
3. Configure your preferences:
   - **Daily Limit**: Default is 50 (recommended: 30-50)
   - **Delay Between Requests**: Default is 5 seconds (recommended: 5-10s)
   - **Personalized Note**: Customize your connection message
   - **Auto-Connect**: Toggle to enable/disable automation

### 5. Test the Extension

#### Test Profile Tracking

1. Navigate to LinkedIn: https://www.linkedin.com
2. Visit any profile page
3. Open the LinkedBoost popup
4. Check the "Recent Profile Views" section - you should see the profile you just visited

#### Test Auto-Connect (Use with Caution!)

⚠️ **IMPORTANT**: Only enable this on test accounts or with careful consideration

1. Navigate to LinkedIn search results or "My Network" page
2. Open the LinkedBoost popup
3. Enable "Auto-Connect" toggle
4. The extension will automatically start sending connection requests based on your settings
5. Check the "Recent Connections" section in the popup to see sent requests

### 6. View Detailed Settings

1. Click the LinkedBoost icon
2. Click the settings gear icon OR click "Open Full Settings"
3. This opens the full settings page where you can:
   - See detailed analytics
   - Adjust all parameters with sliders
   - Customize your connection message template
   - Clear all stored data

## Features Overview

### Free Features (Implemented)

✅ **Auto-Connect**: Automatically send connection requests on search results pages
✅ **Profile Tracker**: Log all LinkedIn profiles you visit
✅ **Analytics Dashboard**: View connection and profile view statistics
✅ **Customizable Settings**:
- Daily connection limit (10-100)
- Delay between requests (3-30 seconds)
- Personalized message templates
- Enable/disable features

### Premium Features (Planned)

🚀 Coming soon:
- Bulk messaging tool
- Advanced analytics + CSV export
- Auto-endorsement tool
- Connection organizer with tags

## Safety & Best Practices

### Recommended Settings

- **Daily Limit**: 30-50 connections per day
- **Delay**: 5-10 seconds between requests
- **Auto-Connect**: Only enable when actively monitoring
- **Personalization**: Always use personalized connection notes

### LinkedIn Safety

⚠️ LinkedIn has limits and detection systems:

1. **Stay Under Limits**: Don't exceed 50 connections per day
2. **Use Natural Delays**: Longer delays = more natural behavior
3. **Don't Run 24/7**: Use the extension during normal working hours only
4. **Personalize Messages**: Generic messages are more likely to be flagged
5. **Monitor Your Account**: Check for any warnings from LinkedIn

### What to Avoid

❌ Don't send 100+ connection requests per day
❌ Don't use delays less than 3 seconds
❌ Don't run automation overnight
❌ Don't use the same message for everyone
❌ Don't ignore LinkedIn's warning messages

## Troubleshooting

### Extension Not Loading

1. Make sure you selected the `dist` folder, not the root folder
2. Check if Developer mode is enabled in `chrome://extensions/`
3. Try removing and re-adding the extension

### Auto-Connect Not Working

1. Verify that Auto-Connect is enabled in settings
2. Check if you've reached your daily limit
3. Make sure you're on a LinkedIn search results or "My Network" page
4. Open the browser console (F12) and check for any error messages

### Profile Tracking Not Working

1. Verify that "Track Profile Views" is enabled in settings
2. Make sure you're on an actual LinkedIn profile page (URL contains `/in/`)
3. Refresh the page and try again

### Settings Not Saving

1. Make sure to click "Save Settings" after making changes
2. Check Chrome's storage permissions
3. Try clearing the extension data and reconfiguring

## Development

### Watch Mode

For active development with auto-rebuild:

```bash
npm run dev
```

Then:
1. Go to `chrome://extensions/`
2. Click the reload icon on the LinkedBoost extension card
3. Test your changes

### Project Structure

```
linkedboost/
├── src/
│   ├── popup/           # Extension popup UI
│   │   ├── App.tsx
│   │   ├── Popup.tsx
│   │   └── index.html
│   ├── options/         # Full settings page
│   │   ├── App.tsx
│   │   ├── Options.tsx
│   │   └── index.html
│   ├── content/         # Runs on LinkedIn pages
│   │   └── index.ts
│   ├── background/      # Background service worker
│   │   └── index.ts
│   ├── utils/           # Shared utilities
│   │   └── storage.ts
│   └── types/           # TypeScript definitions
│       └── index.ts
├── public/
│   ├── manifest.json    # Extension manifest
│   └── icons/           # Extension icons
└── dist/                # Built extension (load this in Chrome)
```

## Next Steps

### For Testing

1. Create a test LinkedIn account (recommended)
2. Test all features with the test account first
3. Monitor behavior and adjust settings as needed

### For Production Use

1. Use conservative settings (30-50 daily limit, 5-10s delay)
2. Personalize your connection messages
3. Monitor your LinkedIn account for any warnings
4. Adjust settings based on your results

### For Chrome Web Store Submission

1. Create proper PNG icons (16x16, 48x48, 128x128)
2. Add promotional images and screenshots
3. Write detailed description and privacy policy
4. Test thoroughly before submission
5. Pay the $5 one-time Chrome Web Store developer fee

## Support

### Issues or Questions?

- Check this guide first
- Review the main README.md
- Check Chrome's developer console for errors
- Review LinkedIn's Terms of Service

## Disclaimer

This extension is for educational purposes. Users are responsible for:
- Compliance with LinkedIn's Terms of Service
- Respecting connection limits and guidelines
- Any consequences from automated actions

Use responsibly and at your own risk.
