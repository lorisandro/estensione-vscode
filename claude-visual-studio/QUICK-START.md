# Claude Visual Studio - Quick Start Guide

## Installation

```bash
cd claude-visual-studio
npm install
```

## Test the Development Server (Standalone)

### Quick Test in 3 Steps

```bash
# 1. Install dependencies
npm install

# 2. Build the extension
npm run build

# 3. Start test server
npm run test:server
```

Then open: **http://localhost:3333/test-page.html**

This starts a standalone development server that:
- Serves static files from the current directory
- Provides Hot Module Replacement via WebSocket
- Injects element inspector script into HTML pages
- Runs independently from VS Code

See **DEV-SERVER-SETUP.md** for complete server documentation.

---

## Development

### 1. Start the Development Servers

**Option A: Watch Both Extension and Webview**
```bash
npm run watch
```

This runs:
- Extension build in watch mode
- Webview build in watch mode

**Option B: Separate Windows**

Terminal 1 - Extension:
```bash
npm run watch:extension
```

Terminal 2 - Webview:
```bash
npm run watch:webview
```

### 2. Test in VSCode

1. Press `F5` in VSCode to launch Extension Development Host
2. In the new window, open a web project folder
3. Open an HTML file
4. Click the "Open Visual Preview" button in the editor title bar
   - Or use keyboard: `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac)

### 3. Using the Extension

#### Navigate to Your Preview
1. The preview opens with `http://localhost:3333` by default
2. Change the URL in the navigation bar if needed
3. Use Back/Forward/Refresh buttons to navigate

#### Select Elements
1. Click the grid icon (last button) to enable selection mode
   - Or use keyboard: `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)
2. Hover over elements in the preview - they'll highlight in blue
3. Click an element to select it
4. The inspector panel appears on the right showing:
   - Element tag, selector, ID, classes
   - Dimensions and position
   - All attributes
   - Computed styles

#### Inspect Elements
- View all properties of the selected element
- Resize the inspector panel by dragging the divider
- Click outside or press Escape to deselect

## Project Structure

### Webview UI (React)
```
src/webview-ui/
├── main.tsx                 # Entry point
├── App.tsx                  # Main layout
├── components/
│   ├── browser/            # Browser-related components
│   │   ├── BrowserFrame.tsx
│   │   ├── NavigationBar.tsx
│   │   └── SelectionOverlay.tsx
│   └── ElementInspector.tsx
├── state/stores.ts         # Zustand state management
├── hooks/useVSCodeApi.ts   # VSCode API communication
└── types/index.ts          # TypeScript types
```

### Extension (Node.js)
```
src/extension/
├── index.ts                # Extension entry point
├── PreviewPanel.ts         # Webview panel manager
└── ServerManager.ts        # Local dev server
```

## Key Concepts

### 1. Webview Communication

**Webview → Extension:**
```typescript
// In webview
postMessage({
  type: 'element-selected',
  payload: elementInfo
});
```

**Extension → Webview:**
```typescript
// In extension
panel.webview.postMessage({
  type: 'set-url',
  payload: { url: 'http://localhost:3000' }
});
```

### 2. State Management (Zustand)

```typescript
// Import store
import { useSelectionStore } from './state/stores';

// Use in component
const { selectedElement, setSelectedElement } = useSelectionStore();
```

### 3. Element Selection

The webview injects a script into the iframe that:
1. Listens for mouse events
2. Extracts element information
3. Sends it back via `postMessage`
4. The overlay canvas draws visual feedback

## Building for Production

```bash
# Build everything
npm run build

# Build only extension
npm run build:extension

# Build only webview
npm run build:webview
```

Output goes to `dist/`:
```
dist/
├── extension/
│   └── index.js
└── webview/
    ├── index.html
    └── assets/
        └── main.js
```

## Configuration

### Change Preview Server Port

Edit `.vscode/settings.json`:
```json
{
  "claudeVisualStudio.serverPort": 3333,
  "claudeVisualStudio.autoRefresh": true
}
```

## Troubleshooting

### Preview Not Loading

1. **Check server is running:**
   - Make sure you have a dev server at the configured port
   - Default is `http://localhost:3333`

2. **Check CSP in index.html:**
   ```html
   frame-src http://localhost:*;
   ```
   Should allow your server URL

3. **Check browser console:**
   - Right-click webview → "Open Webview Developer Tools"
   - Look for errors

### Selection Not Working

1. **Check selection mode is enabled:**
   - Grid icon should be highlighted
   - Blue highlight should appear on hover

2. **Check iframe loaded:**
   - Look for "Loading preview..." overlay
   - Check for error messages

3. **Check script injection:**
   - Open Webview DevTools
   - Check iframe's document for `#selection-script`

### Type Errors

```bash
# Run type checking
npm run typecheck
```

Common fixes:
- Make sure all imports use correct paths
- Check `tsconfig.json` is valid
- Ensure all dependencies are installed

### Build Errors

```bash
# Clean and reinstall
rm -rf node_modules dist
npm install
npm run build
```

## Development Tips

### 1. Hot Reload

When using `npm run watch:webview`, Vite provides HMR:
- Changes to React components reload instantly
- State is preserved when possible
- No need to reload the extension

### 2. Debugging

**Debug Extension:**
- Set breakpoints in `src/extension/*`
- Press `F5` to start debugging
- Extension runs in debug mode

**Debug Webview:**
- Right-click webview → "Open Webview Developer Tools"
- Use Chrome DevTools
- Console, Elements, Network tabs available

**Debug iframe:**
- In Webview DevTools, switch to iframe context
- Use Console to inspect injected script
- Check for `window.parent.postMessage` calls

### 3. Styling

All styles use VSCode CSS variables:
```typescript
const styles = {
  container: {
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-foreground)',
  } as React.CSSProperties,
};
```

See available variables:
https://code.visualstudio.com/api/references/theme-color

### 4. State Management

Three Zustand stores:
- `useNavigationStore` - URL, history, navigation
- `useSelectionStore` - Element selection state
- `useEditorStore` - Loading, errors, UI state

Access anywhere without prop drilling:
```typescript
const { url } = useNavigationStore();
```

### 5. Adding New Features

**New component:**
1. Create in `src/webview-ui/components/`
2. Import in parent component
3. Add to `components/index.ts` for easy importing

**New message type:**
1. Add to `types/index.ts`
2. Handle in `useVSCodeApi` hook
3. Send from extension or webview

**New state:**
1. Add to appropriate Zustand store in `state/stores.ts`
2. Or create new store if needed
3. Use in components via hooks

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Open Preview | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Toggle Selection | `Ctrl+Shift+S` | `Cmd+Shift+S` |

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [React Docs](https://react.dev/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [Vite Docs](https://vitejs.dev/)

## Next Steps

1. **Run the extension** - Press `F5`
2. **Open a web project** - Any folder with HTML files
3. **Try selection mode** - Click elements to inspect
4. **Explore the code** - Read component documentation
5. **Make changes** - Add features and see them live

Happy coding!
