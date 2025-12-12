# Claude Visual Studio - Webview UI

React-based webview interface for the Claude Visual Studio extension.

## Project Structure

```
src/webview-ui/
├── main.tsx                          # React entry point
├── App.tsx                           # Main app component with layout
├── index.html                        # HTML template
│
├── components/
│   ├── browser/
│   │   ├── BrowserFrame.tsx         # iframe wrapper with message handling
│   │   ├── NavigationBar.tsx        # URL bar with navigation controls
│   │   └── SelectionOverlay.tsx     # Canvas overlay for element selection
│   └── ElementInspector.tsx         # Side panel for inspecting elements
│
├── state/
│   └── stores.ts                    # Zustand stores for app state
│
└── hooks/
    └── useVSCodeApi.ts              # Hook for VSCode API communication
```

## Features

### 1. Browser Preview
- Full iframe-based browser preview
- Proper sandboxing with `allow-same-origin`, `allow-scripts`, etc.
- Real-time URL navigation
- Back/Forward/Refresh controls

### 2. Element Selection
- Toggle selection mode to interact with page elements
- Hover highlighting with blue overlay
- Click to select elements
- Visual feedback with selection rectangles
- Dimension labels showing width x height

### 3. Selection Overlay
- Canvas-based overlay rendering
- Highlights hovered elements in semi-transparent blue
- Shows selected element with solid blue border
- Displays resize handles (8 handles around selection)
- Tooltip showing element tag, ID, and classes

### 4. Element Inspector
- Shows detailed information about selected element:
  - Tag name
  - CSS selector
  - ID and class names
  - Dimensions (width, height, x, y)
  - All HTML attributes
  - Computed styles (display, position, colors, fonts, etc.)
- Resizable panel (200px - 600px width)
- Clean VSCode-themed interface

### 5. State Management (Zustand)

#### Navigation Store
- `url`: Current URL
- `history`: Navigation history array
- `historyIndex`: Current position in history
- `canGoBack/canGoForward`: Navigation state
- Methods: `setUrl`, `navigateTo`, `goBack`, `goForward`, `refresh`

#### Selection Store
- `selectionMode`: Boolean for selection mode state
- `selectedElement`: Currently selected element info
- `hoveredElement`: Currently hovered element info
- Methods: `setSelectionMode`, `setSelectedElement`, `setHoveredElement`, `clearSelection`

#### Editor Store
- `isLoading`: Loading state for iframe
- `error`: Error message if any
- `inspectorWidth`: Width of inspector panel
- Methods: `setLoading`, `setError`, `setInspectorWidth`

### 6. VSCode API Communication

The `useVSCodeApi` hook provides:
- `postMessage(message)`: Send messages to extension
- `onMessage(handler)`: Listen for messages from extension
- `getState()`: Get persisted state
- `setState(state)`: Save state

#### Message Types

**From Webview to Extension:**
- `webview-ready`: Sent on mount
- `navigate`: URL navigation event
- `refresh`: Refresh preview
- `toggle-selection`: Selection mode toggled
- `element-selected`: Element was selected

**From Extension to Webview:**
- `set-url`: Set the preview URL
- `clear-selection`: Clear current selection

## Styling

All components use inline styles with VSCode CSS variables:
- `--vscode-editor-background`
- `--vscode-foreground`
- `--vscode-panel-border`
- `--vscode-button-background`
- `--vscode-input-background`
- `--vscode-sideBar-background`
- etc.

This ensures the UI seamlessly matches VSCode's theme (dark/light).

## Element Selection Implementation

The `BrowserFrame` component injects a script into the iframe that:

1. **Tracks mouse movement** to detect hovered elements
2. **Generates element info** including:
   - Tag name, ID, classes
   - Bounding rectangle
   - CSS selector
   - All attributes
   - Computed styles
3. **Posts messages** to parent window via `postMessage`
4. **Prevents default clicks** when in selection mode
5. **Handles mouse leave** to clear hover state

The script is re-injected whenever:
- Selection mode is enabled
- URL changes
- Iframe reloads

## Build Commands

```bash
# Development
npm run dev:webview          # Start Vite dev server
npm run watch:webview        # Watch mode with auto-rebuild

# Production
npm run build:webview        # Build for production
npm run build               # Build both extension and webview

# Type Checking
npm run typecheck           # Run TypeScript compiler without emitting
```

## Development Notes

1. **CSP (Content Security Policy)**: The `index.html` includes a CSP that allows:
   - Inline styles (`style-src 'unsafe-inline'`)
   - Inline scripts (`script-src 'unsafe-inline'`)
   - iframes from localhost (`frame-src http://localhost:*`)

2. **Hot Reload**: When running `npm run dev:webview`, Vite provides hot module replacement for fast development.

3. **Type Safety**: All components are fully typed with TypeScript, including store types and message types.

4. **Performance**:
   - Canvas overlay only redraws when selection state changes
   - Resize handles use efficient rect calculations
   - Message handlers are properly cleaned up

5. **Accessibility**:
   - All buttons have title attributes for tooltips
   - Keyboard navigation supported
   - Color contrast follows VSCode guidelines

## Future Enhancements

Potential improvements:
- [ ] Add element editing capabilities
- [ ] Support for modifying styles in real-time
- [ ] Breadcrumb navigation showing DOM path
- [ ] Copy selector/CSS to clipboard
- [ ] Screenshot/export functionality
- [ ] Multiple element selection
- [ ] Responsive preview modes (mobile/tablet/desktop)
