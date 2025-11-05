# FocusFlow - Chrome Extension Project

**Status:** In Development
**Start Date:** 2025-01-05
**Target Launch:** 2025-01-15 (10 giorni)
**Goal:** $1,000/mese passive income entro 90 giorni

---

## 📋 PROJECT OVERVIEW

### Cosa è FocusFlow

Una Chrome Extension per produttività che aiuta users a:
- Bloccare siti distraenti durante lavoro/studio
- Usare tecnica Pomodoro integrata
- Tracciare tempo in focus mode
- Costruire abitudini con streaks e achievements

### Differenziatori vs Competizione

**Competitors:** Freedom, StayFocusd, Cold Turkey, Forest

**FocusFlow è MEGLIO perché:**
1. ✅ Setup in 30 secondi (competitor: complessi)
2. ✅ UI moderna e minimal (competitor: ugly/cluttered)
3. ✅ Smart scheduling automatico (competitor: solo manuale)
4. ✅ Gamification integrata (competitor: boring)
5. ✅ Free tier generoso (competitor: troppo limitato o expensive)

---

## 🎯 TARGET MARKET

### Primary Users
- Remote workers (25-45 anni)
- Studenti universitari (18-25 anni)
- Freelancers (25-40 anni)
- Anyone fighting procrastination

### Market Size
- Chrome users: 3+ miliardi
- Productivity extensions category: Millions of searches/month
- Competitor installs: 500k-2M each
- **Realistic target:** 5,000-15,000 users in Year 1

---

## 💰 BUSINESS MODEL

### Freemium Pricing

**FREE (Forever):**
- Block up to 10 websites
- Basic Pomodoro timer (25/5 fixed)
- Today's stats only
- Light/Dark theme
- 1 focus schedule

**PREMIUM - $4.99/month OR $29.99 lifetime:**
- ✅ Unlimited websites in blocklist
- ✅ Custom Pomodoro durations
- ✅ Multiple focus schedules
- ✅ Full analytics (weekly/monthly/all-time)
- ✅ Achievements & badges unlocked
- ✅ Priority support
- ✅ Sync across devices (Chrome Sync)
- ✅ Export data (CSV)

### Revenue Projections

**Conservative Scenario:**
```
Month 1: 1,000 installs → 50 premium (5%) → $400 revenue
Month 3: 3,000 installs → 150 premium (5%) → $1,100/mese
Month 6: 6,000 installs → 300 premium (5%) → $2,200/mese
Month 12: 10,000 installs → 500 premium (5%) → $3,600/mese
```

**Optimistic Scenario:**
```
Month 1: 3,000 installs → 150 premium → $1,200
Month 3: 8,000 installs → 480 premium → $3,500/mese
Month 6: 15,000 installs → 900 premium → $6,500/mese
```

**Target:** $1,000-2,000/mese by Month 3

---

## 🛠️ TECH STACK

### Core Technologies

```yaml
Manifest: V3 (required by Chrome)
Frontend:
  - HTML5
  - CSS3 (Tailwind CSS via CDN)
  - Vanilla JavaScript (no framework for speed)
Language: JavaScript (ES6+)
Icons: Lucide Icons (lightweight)
Storage: Chrome Storage API (Sync + Local)
Alarms: Chrome Alarms API (for timer)
Tabs: Chrome Tabs API (for blocking)
Monetization: ExtensionPay SDK
```

### Why These Choices

- **Vanilla JS**: Faster load, smaller size, no build step
- **Tailwind CDN**: Quick styling, no build process
- **Manifest V3**: Required, future-proof
- **Chrome APIs**: Native, reliable, well-documented
- **ExtensionPay**: Easy payment handling, no backend needed

---

## 📁 FILE STRUCTURE

```
FocusFlow/
├── manifest.json                 # Extension config
├── claude.md                     # This file (project docs)
├── README.md                     # Public-facing docs
│
├── icons/                        # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon-disabled-16.png      # When focus mode OFF
│
├── popup/                        # Main UI (click extension icon)
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── options/                      # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
│
├── background/                   # Service worker
│   └── background.js             # Blocking logic, alarms
│
├── content/                      # Injected into blocked pages
│   ├── blocked.html              # "Site blocked" page
│   ├── blocked.css
│   └── blocked.js
│
└── lib/                          # External libraries
    ├── extensionpay.js           # Payment SDK
    └── utils.js                  # Shared utilities
```

---

## ✨ FEATURES BREAKDOWN

### MVP Features (Launch v1.0)

#### 1. Website Blocker
**What:**
- User adds URLs to blocklist
- Sites get blocked when focus mode is ON
- Redirect to "blocked" page with motivational message

**Implementation:**
- Background script listens to `chrome.tabs.onUpdated`
- Check if URL matches blocklist
- If match + focus mode ON → redirect to blocked.html
- Store blocklist in Chrome Storage Sync

**Free tier limit:** 10 sites max
**Premium:** Unlimited

---

#### 2. Focus Mode Toggle
**What:**
- Big toggle button in popup
- ON = blocking active
- OFF = blocking disabled
- Shows current status clearly

**Implementation:**
- State stored in Chrome Storage Local
- Background script checks state on tab updates
- Icon changes based on state (color vs grayscale)

---

#### 3. Pomodoro Timer
**What:**
- Classic 25 min work, 5 min break
- Auto-enable focus mode during work
- Auto-disable during break
- Notifications when session ends

**Implementation:**
- Chrome Alarms API for timer
- Background script handles alarm events
- Notification API for alerts
- State: working / break / stopped

**Free tier:** Fixed 25/5
**Premium:** Custom durations (15-60 min work, 3-15 min break)

---

#### 4. Quick Stats Dashboard
**What:**
- Today's focus time (hours:minutes)
- Sites blocked count today
- Current streak (consecutive days)
- Weekly trend (mini graph)

**Implementation:**
- Track sessions in Storage
- Calculate on popup open
- Chart.js for simple graphs (or Canvas API)

**Free tier:** Today only
**Premium:** Full history + export

---

#### 5. Smart Scheduling
**What:**
- Set focus hours (e.g., 9 AM - 5 PM, Mon-Fri)
- Auto-enable blocking during scheduled hours
- Quick presets: "Work hours", "Study time", "Deep work"

**Implementation:**
- Chrome Alarms API for schedule checks
- Cron-like storage: `{days: [1,2,3,4,5], start: "09:00", end: "17:00"}`
- Background checks every 5 minutes

**Free tier:** 1 schedule
**Premium:** Multiple schedules

---

#### 6. Gamification
**What:**
- Streak counter (days in a row using FocusFlow)
- Achievements/Badges:
  - "First Focus" - Complete 1 session
  - "Week Warrior" - 7 day streak
  - "Zen Master" - 30 day streak
  - "Century" - 100 hours total
  - "Unbreakable" - 100 day streak
- Progress bars to next achievement

**Implementation:**
- Store in Chrome Storage
- Check milestones on session complete
- Show badge animations in popup

**Free tier:** View only
**Premium:** All badges + share on social

---

### Post-Launch Features (v1.1, v1.2)

**v1.1 (Week 2-3):**
- Allowlist (whitelist certain URLs even during focus)
- Website categories (Social, News, Shopping presets)
- Break reminders (stretch, hydrate)
- Sounds/music during focus (optional ambient)

**v1.2 (Month 2):**
- Team/study groups (sync sessions with friends)
- Leaderboard (optional, privacy-first)
- Integration with calendar (auto-schedule based on events)
- Mobile companion (view stats on phone)

---

## 🎨 UI/UX DESIGN

### Design Principles
1. **Minimal:** No clutter, clear CTAs
2. **Fast:** Instant load, smooth animations
3. **Beautiful:** Modern gradients, clean typography
4. **Intuitive:** Zero learning curve

### Color Scheme
```css
Primary: #6366f1 (Indigo)
Success: #10b981 (Green)
Warning: #f59e0b (Amber)
Danger: #ef4444 (Red)
Background Light: #ffffff
Background Dark: #1f2937
Text Light: #111827
Text Dark: #f9fafb
```

### Typography
```css
Font: 'Inter' (Google Fonts)
Sizes:
  - Heading: 24px bold
  - Body: 16px regular
  - Small: 14px
  - Tiny: 12px
```

### Components

**Popup (300x500px):**
```
┌─────────────────────────┐
│  FocusFlow    [Settings]│
├─────────────────────────┤
│                         │
│    [BIG TOGGLE]         │
│    Focus Mode: ON       │
│                         │
├─────────────────────────┤
│  Pomodoro Timer         │
│      25:00              │
│   [Start] [Pause]       │
├─────────────────────────┤
│  Today's Stats          │
│  Focus Time: 2h 34m     │
│  Sites Blocked: 47      │
│  Streak: 🔥 12 days     │
├─────────────────────────┤
│  Quick Actions          │
│  [+Add Site] [Schedule] │
└─────────────────────────┘
```

---

## 🔐 PRIVACY & SECURITY

### Data Collection
**What we collect:**
- Blocklist (local only)
- Usage stats (local only)
- Payment email (via ExtensionPay)

**What we DON'T collect:**
- Browsing history
- Personal data
- Analytics/tracking
- Cookies

### Storage
- All data in Chrome Storage (user's browser)
- Chrome Sync for cross-device (optional)
- No external servers
- No database

### Permissions Required
```json
"permissions": [
  "storage",           // Save settings/data
  "alarms",            // Timers
  "tabs",              // Check URLs
  "notifications"      // Alerts
],
"host_permissions": [
  "<all_urls>"         // Access URLs for blocking
]
```

**Justification:** Clearly explain in store listing why each permission needed.

---

## 📅 DEVELOPMENT TIMELINE

### Week 1: Core Development (Days 1-7)

**Day 1-2: Setup + Blocker (6h)**
- Project structure
- Manifest.json
- Basic blocking logic
- Popup UI skeleton
- Test load in Chrome

**Day 3: Focus Mode + UI (4h)**
- Toggle button
- Icon state changes
- Polish popup design
- Storage integration

**Day 4: Pomodoro Timer (4h)**
- Timer logic with Alarms API
- Start/Pause/Reset buttons
- Notifications
- Auto-toggle focus mode

**Day 5: Stats Dashboard (4h)**
- Track sessions
- Calculate stats
- Display in popup
- Streak counter

**Day 6: Smart Scheduling (4h)**
- Schedule UI in options page
- Cron-like logic
- Auto-enable/disable
- Presets

**Day 7: Gamification (4h)**
- Achievements system
- Badge UI
- Progress tracking
- Milestone notifications

**Week 1 Total: ~30 hours**

---

### Week 2: Monetization + Polish (Days 8-10)

**Day 8: Freemium Logic (4h)**
- Install ExtensionPay
- Gate premium features
- Upgrade prompts (non-annoying)
- Test payment flow

**Day 9: Testing + Bug Fixes (4h)**
- Full feature testing
- Edge cases
- Performance check
- Ask 3 friends to test

**Day 10: Chrome Web Store Prep (4h)**
- Screenshots (5 images)
- Promotional graphics
- Description copy
- Privacy policy
- Icons finalized
- Zip and upload

**Week 2 Total: ~12 hours**

**TOTAL DEV TIME: ~42 hours over 10 days**

---

## 🚀 LAUNCH STRATEGY

### Pre-Launch (Day 9-10)
- [ ] Create landing page (simple, 1-page)
- [ ] Setup email list (for waitlist)
- [ ] Prepare Product Hunt submission
- [ ] Write launch blog post
- [ ] Record demo video (3 min)
- [ ] Create social media assets

### Launch Day (Day 11)
**Morning (6-9 AM PST):**
- [ ] Submit to Product Hunt (aim for top 5)
- [ ] Tweet launch thread (10-15 tweets)
- [ ] Post on LinkedIn
- [ ] Post in Reddit (r/productivity, r/chrome, r/SideProject)
- [ ] Post on Indie Hackers

**Day (9 AM - 6 PM):**
- [ ] Respond to ALL comments within 5 min
- [ ] Engage on Product Hunt
- [ ] Monitor Chrome Web Store reviews
- [ ] Fix any critical bugs reported

**Evening (6-10 PM):**
- [ ] Summary tweet (stats, thanks)
- [ ] Plan Day 2 content

**Launch Day Goal:** 100-500 installs

---

### Week 1 Post-Launch
- [ ] Daily: Respond to all reviews/comments
- [ ] Daily: Post 1 tip/feature showcase on Twitter
- [ ] Day 3: Blog post "How I built FocusFlow in 10 days"
- [ ] Day 5: YouTube demo video
- [ ] Day 7: Reach out to 10 productivity bloggers/YouTubers

**Week 1 Goal:** 500-1,500 installs

---

### Month 1 Post-Launch

**Content Marketing:**
- [ ] Blog post: "Best Chrome extensions for productivity"
- [ ] Blog post: "Pomodoro technique explained + tools"
- [ ] Guest post on Medium
- [ ] YouTube: 3 productivity tips videos

**Paid Ads (Optional, $100 budget):**
- [ ] Google Ads: "productivity chrome extension"
- [ ] Test for 7 days
- [ ] If ROAS > 2x, continue

**Partnerships:**
- [ ] Reach out to Notion, Todoist, Trello
- [ ] Cross-promote with complementary tools

**Iterate:**
- [ ] Implement top 3 feature requests
- [ ] Fix all reported bugs
- [ ] A/B test premium conversion messaging

**Month 1 Goal:** 1,500-3,000 installs, $400-1,200 revenue

---

## 📊 METRICS TO TRACK

### Key Metrics

**Acquisition:**
- Daily Active Users (DAU)
- Total Installs
- Install sources (organic, referral, ads)
- Chrome Web Store impressions → install conversion

**Activation:**
- % users who add ≥1 site to blocklist
- % users who start ≥1 focus session
- Time to first session

**Retention:**
- Day 1, 7, 30 retention
- Weekly Active Users (WAU)
- Churn rate

**Revenue:**
- Free → Premium conversion rate
- Monthly Recurring Revenue (MRR)
- Lifetime value (LTV)
- Churn (premium cancellations)

**Engagement:**
- Avg sessions per user per week
- Avg focus time per user
- Features used (which are sticky?)

### Tools
- Chrome Web Store Analytics (built-in)
- ExtensionPay dashboard (payments)
- Manual tracking in Google Sheets (first month)
- Later: PostHog (privacy-friendly analytics) if needed

---

## 💡 SUCCESS CRITERIA

### Month 1
- ✅ 1,000+ installs
- ✅ 4.0+ star rating (min 20 reviews)
- ✅ $300+ revenue
- ✅ <3 critical bugs
- ✅ Featured on 2+ blogs/newsletters

### Month 3
- ✅ 3,000+ installs
- ✅ 4.3+ star rating
- ✅ $1,000+ MRR
- ✅ 10%+ Day 7 retention
- ✅ 5%+ free → premium conversion

### Month 6
- ✅ 6,000+ installs
- ✅ 4.5+ star rating
- ✅ $2,000+ MRR
- ✅ 20%+ Day 30 retention
- ✅ Profitable (revenue > time invested)

### Month 12
- ✅ 10,000+ installs
- ✅ $3,000+ MRR
- ✅ Mostly passive (5-10h/mese maintenance)
- ✅ Ready to build Extension #2

---

## 🚨 RISKS & MITIGATION

### Technical Risks

**Risk:** Chrome policy change breaks extension
**Mitigation:** Follow Manifest V3 best practices, stay updated on Chrome blog

**Risk:** Blocking doesn't work on some sites
**Mitigation:** Test top 50 sites, handle edge cases, clear error messages

**Risk:** Performance issues (slow browser)
**Mitigation:** Optimize code, minimize background tasks, lazy load

---

### Business Risks

**Risk:** No one installs
**Mitigation:** Strong launch marketing, solve real pain point, get early reviews

**Risk:** Low conversion to premium
**Mitigation:** Free tier valuable but limited, clear upgrade path, test pricing

**Risk:** Negative reviews
**Mitigation:** Fast bug fixes, responsive support, over-deliver on promises

---

### Competitive Risks

**Risk:** Established competitor crushes us
**Mitigation:** Differentiate (UI, gamification), niche down, move fast

**Risk:** Market too saturated
**Mitigation:** Find underserved sub-niche (e.g., students, developers)

---

## 🎯 NEXT ACTIONS

### Immediate (Today)
- [x] Create claude.md (this file)
- [ ] Generate manifest.json
- [ ] Create folder structure
- [ ] Generate popup.html + popup.js base
- [ ] Test load in Chrome

### Tomorrow
- [ ] Implement blocking logic
- [ ] Create blocked.html page
- [ ] Test blocking works on 10 sites
- [ ] Polish popup UI

### This Week
- [ ] Complete all MVP features
- [ ] Internal testing
- [ ] Fix bugs
- [ ] Prepare Chrome Web Store assets

---

## 📝 NOTES & LEARNINGS

### Development Notes
- Keep code simple (vanilla JS is enough)
- Comment complex logic
- Test on multiple devices
- Use Chrome DevTools for debugging

### Marketing Notes
- Start building in public (Twitter)
- Collect emails pre-launch
- Launch on Tuesday-Thursday (best days)
- Respond to EVERY comment

### Personal Goals
- Learn Chrome Extension development
- Build first passive income product
- Reach $1,000/mese by Month 3
- Foundation for Extension #2 (LinkedIn tool)

---

## 🔗 RESOURCES

### Documentation
- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- Manifest V3 Guide: https://developer.chrome.com/docs/extensions/mv3/
- ExtensionPay Docs: https://extensionpay.com/docs

### Inspiration
- StayFocusd (competitor analysis)
- Forest (gamification ideas)
- Freedom (premium features)

### Community
- r/chromeextensions
- Indie Hackers Chrome Extension forum
- Chrome Extension Discord

---

**Last Updated:** 2025-01-05
**Next Review:** After Day 5 (mid-development check)

---

## ✅ READY TO BUILD

Questo documento è la SINGLE SOURCE OF TRUTH per FocusFlow.

**Next step:** Generate code files based on questo design.

**LET'S BUILD.** 🚀
