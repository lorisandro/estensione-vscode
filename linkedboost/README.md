# LinkedBoost - LinkedIn Automation Extension

Chrome Extension (Manifest V3) for automating LinkedIn connection requests and tracking profile interactions.

## Features

### Free Features
- ✅ Auto-connect request sender with personalized notes
- ✅ Profile view tracker
- ✅ Basic analytics dashboard
- ✅ Customizable daily limits and delays

### Premium Features (Coming Soon)
- 🚀 Bulk messaging tool
- 📊 Advanced analytics + CSV export
- ⭐ Auto-endorsement tool
- 🏷️ Connection organizer/tagger

## Tech Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Storage**: Chrome Storage API
- **Manifest**: V3

## Project Structure

```
linkedboost/
├── src/
│   ├── popup/          # Extension popup UI
│   ├── options/        # Settings page
│   ├── content/        # Content script (LinkedIn interaction)
│   ├── background/     # Background service worker
│   ├── components/     # Shared React components
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript definitions
├── public/
│   ├── manifest.json   # Extension manifest
│   └── icons/          # Extension icons
└── dist/               # Build output
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode for development
npm run dev
```

### Loading the Extension in Chrome

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist` folder from the project

### Icons

Before building, you need to create icon files:
- `public/icons/icon16.png` (16x16)
- `public/icons/icon48.png` (48x48)
- `public/icons/icon128.png` (128x128)

You can use any design tool to create these, or use placeholder icons for development.

## Usage

1. Install and load the extension in Chrome
2. Navigate to LinkedIn
3. Click the LinkedBoost icon in your toolbar
4. Configure your settings:
   - Set daily connection limit (default: 50)
   - Set delay between requests (default: 5 seconds)
   - Customize your connection message
   - Toggle auto-connect on/off
5. Go to LinkedIn search results or "My Network"
6. The extension will automatically send connection requests based on your settings

## Safety & Best Practices

⚠️ **Important**: Use this extension responsibly

- Keep daily limits reasonable (30-50 per day recommended)
- Use delays of 5+ seconds between requests
- Personalize your connection messages
- Don't run automation continuously
- Review LinkedIn's terms of service regularly

## License

MIT License

## Disclaimer

This extension is for educational purposes. Users are responsible for compliance with LinkedIn's Terms of Service and User Agreement. Automated actions may result in account restrictions.
