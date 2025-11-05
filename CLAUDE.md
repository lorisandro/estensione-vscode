# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a multi-project repository focused on building profitable digital products and services. It contains:

1. **Strategy Documentation** - 8 comprehensive markdown guides for building a freelancing/product business
2. **FocusFlow** - Chrome extension for productivity (website blocker + Pomodoro timer)
3. **linkedboost** - Planned LinkedIn automation tool (early stage, dependencies installed only)

## Repository Structure

```
Test/
├── Strategy Documents (00-08-*.md)    # Business strategy guides
├── FocusFlow/                          # Chrome Extension (active development)
│   ├── manifest.json
│   ├── claude.md                       # Project-specific documentation
│   ├── popup/                          # Extension popup UI
│   ├── background/                     # Service worker
│   ├── content/                        # Content scripts
│   └── options/                        # Settings page
└── linkedboost/                        # LinkedIn tool (early stage)
    └── package.json                    # React + TypeScript + Vite
```

## Key Projects

### FocusFlow (Chrome Extension)

**Purpose:** Productivity chrome extension with website blocking, Pomodoro timer, and gamification features.

**Tech Stack:**
- Manifest V3 (Chrome Extension)
- Vanilla JavaScript (ES6+)
- Tailwind CSS (via CDN)
- Chrome APIs (Storage, Alarms, Tabs, Notifications)

**Business Model:** Freemium (free tier + $4.99/month or $29.99 lifetime premium)

**Important Files:**
- `FocusFlow/claude.md` - Comprehensive project documentation (THIS IS THE SINGLE SOURCE OF TRUTH for FocusFlow)
- `FocusFlow/manifest.json` - Extension configuration
- `FocusFlow/README.md` - Public-facing documentation

**File Structure:**
- `popup/` - Main UI shown when clicking extension icon (popup.html, popup.js, popup.css)
- `background/` - Service worker handling blocking logic, timers, alarms
- `content/` - Pages shown to users (blocked.html when site is blocked)
- `options/` - Settings/configuration page
- `icons/` - Extension icons (16px, 48px, 128px)

**Development:**
- No build step required (vanilla JS)
- Load unpacked in Chrome for testing: `chrome://extensions/` → Enable Developer mode → Load unpacked
- All data stored locally using Chrome Storage API
- Uses Chrome Alarms API for Pomodoro timer
- Blocking implemented via `chrome.tabs.onUpdated` listener

**Key Features:**
1. Website blocker with customizable blocklist
2. Focus mode toggle (enables/disables blocking)
3. Pomodoro timer (25 min work, 5 min break)
4. Stats dashboard (focus time, blocked sites, streaks)
5. Smart scheduling (auto-enable during work hours)
6. Gamification (achievements, badges, streaks)

**Free vs Premium:**
- Free: 10 sites max, basic Pomodoro (25/5 fixed), today's stats only
- Premium: Unlimited sites, custom Pomodoro durations, full analytics, all achievements

### linkedboost (LinkedIn Tool)

**Status:** Early stage - only package.json exists, no source code yet

**Tech Stack:**
- React 19.2.0
- TypeScript 5.9.3
- Vite 7.2.0 (build tool)
- Tailwind CSS 4.1.16
- Chrome Extension types (@types/chrome)

**Planned Purpose:** LinkedIn automation/enhancement tool (likely a Chrome extension based on dependencies)

**Commands:**
- Currently no scripts defined in package.json
- Will need build/dev scripts once source code is added

## Strategy Documentation

The repository contains 8 comprehensive business strategy guides in Italian:

1. **00-START-HERE-INDICE.md** - Master index and roadmap (READ THIS FIRST)
2. **01-ANALISI-MERCATO-2025.md** - Market analysis, pricing, niches
3. **02-STRATEGIE-CONCRETE-START.md** - Concrete strategies to get started
4. **03-CLAUDE-CODE-LEVERAGING.md** - How to leverage Claude Code for productivity
5. **04-ESEMPI-CONCRETI-PROGETTI.md** - Concrete project examples
6. **05-ACTION-PLAN-30-GIORNI.md** - 30-day action plan
7. **06-QUICK-WINS-IMMEDIATI.md** - Quick wins for immediate cash flow
8. **07-TATTICHE-STRATEGIE-OBIETTIVI.md** - Tactics and strategies for scaling ($2k → $10k/month)
9. **08-VALIDAZIONE-REALITY-CHECK.md** - Reality check and validation

**Purpose:** These documents form a complete guide for building a freelancing/product business from $0 to $10k+/month using AI tools (especially Claude Code) for competitive advantage.

**Key Themes:**
- Leveraging AI (Claude Code) for 3-5x development speed
- Freelancing strategies (Fiverr, Upwork, LinkedIn outreach)
- Building passive income products (Chrome extensions, SaaS, automation tools)
- Scaling from $2k → $5k → $10k/month
- Quick wins for immediate revenue

## Development Workflow

### Git Workflow - IMPORTANT:

**After EVERY prompt/task completion:**
1. Create a commit with a descriptive message
2. Automatically push to GitHub
3. Use the format:
   ```bash
   git add . && git commit -m "descriptive message" && git push
   ```

**Commit message format:**
- Use clear, descriptive messages that explain WHAT was done
- Include context if needed
- Examples:
  - "Add Pomodoro timer feature to FocusFlow"
  - "Fix blocking logic for wildcard domains"
  - "Update strategy document with new pricing"

**Why:** This ensures:
- All work is backed up immediately
- Clear history of changes
- Easy rollback if needed
- Continuous deployment mindset

### For FocusFlow:

1. **Making changes:**
   - Edit files directly (no build step)
   - Refresh extension in `chrome://extensions/` to test changes
   - For background script changes, may need to reload extension completely

2. **Testing:**
   - Load unpacked extension in Chrome
   - Test blocking on various websites
   - Test Pomodoro timer with Chrome Alarms
   - Verify data persistence using Chrome Storage

3. **Debugging:**
   - Popup: Right-click extension icon → Inspect popup
   - Background: Go to `chrome://extensions/` → Service worker → Inspect
   - Content scripts: Open DevTools on blocked page

### For linkedboost:

1. **Setup (when code exists):**
   ```bash
   cd linkedboost
   npm install  # Dependencies already installed
   ```

2. **Will need to add scripts to package.json:**
   - `npm run dev` - Development server (Vite)
   - `npm run build` - Production build
   - `npm run preview` - Preview production build

## Project Management Philosophy

Based on the strategy documents, the approach is:

1. **Speed over perfection** - Ship quickly, iterate based on feedback
2. **Leverage AI** - Use Claude Code for 3-5x faster development
3. **Validate quickly** - Build MVPs, get real users/customers fast
4. **Focus on revenue** - Every project targets specific revenue goals
5. **Time-boxing** - FocusFlow target: 42 hours over 10 days to launch

## Important Notes

### FocusFlow Development:
- Keep code simple (vanilla JS is sufficient)
- No complex frameworks needed - speed and small size are priorities
- Privacy-first: all data stays local in browser
- Follow Chrome Extension Manifest V3 requirements
- Clear comments for complex logic
- Test on multiple devices

### General Approach:
- These are revenue-generating projects, not learning exercises
- Focus on features that drive conversions (free → premium)
- Launch fast, iterate based on user feedback
- Build in public when possible for marketing

### Key Resources:
- Chrome Extension docs: https://developer.chrome.com/docs/extensions/
- Manifest V3 guide: https://developer.chrome.com/docs/extensions/mv3/
- ExtensionPay (monetization): https://extensionpay.com/docs

## Working with This Repository

1. **For FocusFlow work:**
   - Always consult `FocusFlow/claude.md` first (comprehensive project documentation)
   - Make changes directly in JavaScript/HTML/CSS files
   - Test immediately in Chrome after changes
   - Focus on MVP features first (see timeline in claude.md)

2. **For linkedboost work:**
   - Currently blank slate with dependencies
   - Will need React + TypeScript setup
   - Likely Chrome extension based on @types/chrome dependency
   - Consider similar architecture to FocusFlow if building extension

3. **For strategy consultation:**
   - Start with `00-START-HERE-INDICE.md` for roadmap
   - Documents are in Italian
   - They provide context for why these projects exist and business goals

## Goals and Success Metrics

### FocusFlow:
- **Launch:** Within 10 days of development start (2025-01-15 target)
- **Month 1:** 1,000+ installs, $300+ revenue
- **Month 3:** 3,000+ installs, $1,000+ MRR
- **Month 12:** 10,000+ installs, $3,000+ MRR, mostly passive (5-10h/month maintenance)

### Overall Business:
- Build multiple income streams (freelancing + products)
- Target: $2k/month → $5k/month → $10k/month
- Leverage Claude Code for competitive advantage in development speed
- Focus on sustainable, passive income sources

## Language Notes

- Strategy documents: Italian
- FocusFlow documentation: English + Italian (claude.md has some Italian, README is English)
- Code: English (comments, variable names, etc.)
- User-facing content: Will be English for broader market reach
