# Claude Visual Studio - Webview UI Architecture

## Overview

The webview UI is a React 18+ application that provides a visual browser preview with element selection and inspection capabilities. It runs inside a VSCode webview panel and communicates with the extension host via the VSCode API.

## File Structure

```
src/webview-ui/
├── main.tsx                          # Entry point - renders React app
├── App.tsx                           # Main component - orchestrates layout
├── index.html                        # HTML template with CSP
│
├── components/
│   ├── browser/
│   │   ├── BrowserFrame.tsx         # iframe container with script injection
│   │   ├── NavigationBar.tsx        # URL bar + nav controls + selection toggle
│   │   ├── SelectionOverlay.tsx     # Canvas overlay for visual feedback
│   │   └── index.ts                 # Barrel export
│   ├── ElementInspector.tsx         # Right panel showing element details
│   └── index.ts                     # Barrel export
│
├── state/
│   └── stores.ts                    # Zustand stores (navigation, selection, editor)
│
├── hooks/
│   └── useVSCodeApi.ts              # VSCode API communication hook
│
├── types/
│   └── index.ts                     # TypeScript type definitions
│
└── README.md                        # Detailed documentation
```

## Component Hierarchy

```
App
├── NavigationBar
│   ├── Back/Forward/Refresh buttons
│   ├── URL input
│   └── Selection mode toggle
│
├── BrowserFrame (preview area)
│   └── iframe (with injected selection script)
│
├── SelectionOverlay (canvas layer)
│   ├── Hover highlight
│   ├── Selection rectangle
│   ├── Resize handles
│   └── Tooltip
│
└── ElementInspector (conditional, right panel)
    ├── Element tag
    ├── General properties (selector, id, class)
    ├── Dimensions (width, height, x, y)
    ├── Attributes list
    └── Computed styles grid
```

## Data Flow

### 1. User Interactions

```
User Action → Component → Store Update → UI Re-render
                   ↓
            VSCode API Message
                   ↓
           Extension Host
```

### 2. Element Selection Flow

```
User hovers/clicks in iframe
         ↓
Injected script detects event
         ↓
postMessage to parent window
         ↓
BrowserFrame receives message
         ↓
Updates selection store
         ↓
SelectionOverlay redraws canvas
         ↓
ElementInspector shows details
```

### 3. Navigation Flow

```
User enters URL → NavigationBar
         ↓
useNavigationStore.navigateTo()
         ↓
Updates URL, history, canGoBack/Forward
         ↓
BrowserFrame receives new URL
         ↓
iframe loads new page
         ↓
Injects selection script (if enabled)
```

## State Management (Zustand)

### Navigation Store
```typescript
{
  url: string
  history: string[]
  historyIndex: number
  canGoBack: boolean
  canGoForward: boolean

  // Actions
  setUrl(url)
  navigateTo(url)
  goBack()
  goForward()
  refresh()
}
```

### Selection Store
```typescript
{
  selectionMode: boolean
  selectedElement: ElementInfo | null
  hoveredElement: ElementInfo | null

  // Actions
  setSelectionMode(mode)
  setSelectedElement(element)
  setHoveredElement(element)
  clearSelection()
}
```

### Editor Store
```typescript
{
  isLoading: boolean
  error: string | null
  inspectorWidth: number

  // Actions
  setLoading(loading)
  setError(error)
  setInspectorWidth(width)
}
```

## Key Features

### 1. BrowserFrame Component

**Responsibilities:**
- Render iframe with proper sandbox attributes
- Inject selection script into iframe's document
- Listen for element events from iframe
- Handle load/error states
- Re-inject script on URL changes

**Script Injection:**
```javascript
// Injected into iframe for element tracking
- Mouse move handler → detect hovered element
- Click handler → select element
- generateSelector() → create CSS selector
- getElementInfo() → extract element data
- postMessage() → send to parent
```

### 2. SelectionOverlay Component

**Responsibilities:**
- Draw canvas overlay on top of iframe
- Render hover highlight (semi-transparent blue)
- Render selection rectangle (solid blue border)
- Draw 8 resize handles around selection
- Display element dimensions label
- Show tooltip with element info

**Canvas Drawing:**
- Uses `CanvasRenderingContext2D` for rendering
- Redraws only when selection state changes
- Handles window resize events
- Efficient rect calculations

### 3. NavigationBar Component

**Responsibilities:**
- URL input with enter-to-navigate
- Back button (disabled when canGoBack = false)
- Forward button (disabled when canGoForward = false)
- Refresh button
- Selection mode toggle (highlighted when active)
- VSCode-themed button styles with hover states

### 4. ElementInspector Component

**Responsibilities:**
- Display selected element information
- Collapsible sections for different property groups
- Formatted display of attributes and styles
- Scrollable content area
- Empty state when no selection
- Clean, readable typography

### 5. useVSCodeApi Hook

**Responsibilities:**
- Initialize VSCode API once on mount
- Provide `postMessage()` for sending to extension
- Provide `onMessage()` for receiving from extension
- Handle cleanup of message listeners
- Type-safe message interface

## Styling Approach

**All styling is inline using VSCode CSS variables:**

```typescript
const styles = {
  container: {
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-foreground)',
    borderColor: 'var(--vscode-panel-border)',
  } as React.CSSProperties,
  // ...
}
```

**Benefits:**
- No external CSS files needed
- Automatically adapts to VSCode theme changes
- Type-safe with React.CSSProperties
- No class name conflicts
- Scoped to components

## Message Protocol

### Webview → Extension

| Type | Payload | Description |
|------|---------|-------------|
| `webview-ready` | - | Sent when webview mounts |
| `navigate` | `{ url: string }` | User navigated to new URL |
| `refresh` | - | User clicked refresh |
| `toggle-selection` | `{ enabled: boolean }` | Selection mode toggled |
| `element-selected` | `ElementInfo` | User selected an element |

### Extension → Webview

| Type | Payload | Description |
|------|---------|-------------|
| `set-url` | `{ url: string }` | Change preview URL |
| `clear-selection` | - | Clear current selection |

## Build Process

1. **Development:** Vite dev server with HMR
   ```bash
   npm run dev:webview
   ```

2. **Production:** Vite build to `dist/webview/`
   ```bash
   npm run build:webview
   ```

3. **Output:**
   ```
   dist/webview/
   ├── index.html
   └── assets/
       ├── main.js
       └── main.css (if any)
   ```

## Security Considerations

1. **Content Security Policy:**
   - Only allows localhost iframes
   - Allows inline styles (for VSCode CSS vars)
   - Allows inline scripts (for React hydration)

2. **iframe Sandbox:**
   - `allow-same-origin` - Access parent window
   - `allow-scripts` - Run JavaScript
   - `allow-forms` - Form submission
   - `allow-popups` - Open popups
   - `allow-modals` - Show modals

3. **Message Validation:**
   - Check message source before processing
   - Validate message types
   - Sanitize user input before postMessage

## Performance Optimizations

1. **Canvas Rendering:**
   - Only redraws on state changes
   - Uses `useCallback` for event handlers
   - Efficient rect calculations

2. **Script Injection:**
   - Checks if script already exists
   - Only injects when selection mode enabled
   - Properly cleans up event listeners

3. **Message Handling:**
   - Debounced hover events
   - Cleanup functions for all listeners
   - Memoized callbacks

4. **State Updates:**
   - Zustand for minimal re-renders
   - Selective subscriptions to stores
   - Batched updates where possible

## Browser Compatibility

**Target:** VSCode's Electron environment (Chromium-based)

- ES6+ features supported
- CSS Grid and Flexbox
- Canvas API
- postMessage API
- No polyfills needed

## Testing Recommendations

1. **Unit Tests:**
   - Zustand store actions
   - useVSCodeApi hook
   - Element selector generation

2. **Integration Tests:**
   - Component interactions
   - Message passing
   - State synchronization

3. **E2E Tests:**
   - Full user workflows
   - Element selection
   - Navigation

## Future Enhancements

1. **Element Editing:**
   - Inline style editor
   - Attribute modification
   - Class toggling

2. **Advanced Selection:**
   - Multi-select
   - Parent/child navigation
   - Sibling navigation

3. **Export Features:**
   - Copy HTML
   - Copy CSS
   - Screenshot element

4. **Responsive Testing:**
   - Device presets
   - Custom dimensions
   - Orientation toggle

5. **Accessibility:**
   - Keyboard shortcuts
   - Screen reader support
   - Focus management
