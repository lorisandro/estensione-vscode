# 03 - FOCUSFLOW: LAUNCH IN 7 GIORNI

## SITUAZIONE ATTUALE

✅ **Codice: 100% completo**
✅ **Features: Tutte implementate (6 core features)**
✅ **Testing: Basic done**
❌ **Icone: Mancanti** (30 minuti per creare)
❌ **Chrome Web Store: Non submitted**
❌ **Marketing assets: Da creare**

**SEI A 7 GIORNI DAL LAUNCH.** 🚀

---

## 📅 ROADMAP 7 GIORNI

### **GIORNO 1 (OGGI): ICONE + TEST** - 4 ore

#### MATTINA (2 ore): Crea Icone

**OPZIONE A: Canva (Raccomandato)**

```
1. Vai su canva.com
2. Create design → Custom size → 128x128px
3. Design:
   - Sfondo: Gradiente indigo (#6366f1) a purple (#9333ea)
   - Lettera "F" bianca, bold, Inter font, centrata
   - Oppure: Icona focus/zen (cerchi concentrici)
4. Download PNG (128x128)
5. Resize a 48x48 e 16x16 (usa tinypng.com/resize)
6. Salva come:
   - E:\Progetto\...\FocusFlow\icons\icon-16.png
   - E:\Progetto\...\FocusFlow\icons\icon-48.png
   - E:\Progetto\...\FocusFlow\icons\icon-128.png
```

**OPZIONE B: Favicon Generator (Veloce)**

```
1. Vai su favicon.io
2. Scegli "Text" generator
3. Text: "F"
4. Background: Indigo gradient
5. Font: Bold
6. Download → Rinomina files
7. Copia in FocusFlow/icons/
```

#### POMERIGGIO (2 ore): Test Completo

```bash
# 1. Carica in Chrome (5 min)
chrome://extensions/
→ Developer mode ON
→ Load unpacked
→ Select FocusFlow folder

# 2. Test ogni feature (90 min)
☐ Popup si apre
☐ Focus Mode toggle funziona
☐ Aggiungi website a blocklist
☐ Test blocking (vai su facebook.com con focus ON)
☐ Pomodoro timer start/pause
☐ Stats si aggiornano
☐ Settings page opens
☐ Dark mode toggle

# 3. Fix bugs se ci sono (30 min)
→ Console log per debug
→ Fix immediato con Claude Code se serve
```

**DELIVERABLE GIORNO 1:**
✅ Icone create
✅ Extension caricata in Chrome
✅ Tutti test passed

---

### **GIORNO 2: BUG FIXING + POLISH** - 4 ore

#### TASK LIST

```
☐ Test cross-browser (Chrome, Edge, Brave)
☐ Test con 10 siti diversi in blocklist
☐ Test Pomodoro per full cycle (25 min)
☐ Verifica storage (dati persistono dopo refresh?)
☐ Test icon cambio stato (ON/OFF)
☐ Spelling check tutti testi UI
☐ Responsive check popup (300px width)
☐ Test notifications (permessi richiesti?)
```

#### PROMPT CLAUDE CODE (Se trovi bugs)

```
"Ho trovato un bug in FocusFlow extension:

Bug: [descrivi cosa non funziona]
Expected: [cosa dovrebbe succedere]
Actual: [cosa succede invece]
Error log: [paste console errors se ci sono]

File interessato: [popup.js / background.js / etc]

Analizza e fixa il bug."
```

**DELIVERABLE GIORNO 2:**
✅ Zero bug critici
✅ Polish UI minori fatti
✅ Ready per screenshots

---

### **GIORNO 3: CHROME WEB STORE ASSETS** - 5 ore

#### PARTE 1: Screenshots (2 ore)

**5 screenshots necessari (1280x800 o 640x400)**

```
Screenshot 1: HERO
- Popup aperto con focus mode ON
- Pomodoro timer running
- Stats visible
Caption: "Stay focused with website blocking & Pomodoro timer"

Screenshot 2: BLOCKING IN ACTION
- Blocked page shown (blocked.html)
- Motivational quote visible
Caption: "Gentle reminders when you need them most"

Screenshot 3: STATS DASHBOARD
- Today's stats prominently shown
- Streak, focus time, blocked sites
Caption: "Track your productivity journey"

Screenshot 4: CUSTOMIZATION
- Settings page open
- Blocklist visible
Caption: "Customize your perfect focus environment"

Screenshot 5: TIMER
- Pomodoro timer close-up
- Clean, beautiful UI
Caption: "Built-in Pomodoro timer keeps you on track"
```

**COME FARE:**

1. Apri extension in Chrome
2. Windows: Win+Shift+S per screenshot
3. Mac: Cmd+Shift+4
4. Salva come PNG
5. Optional: Add captions in Canva

#### PARTE 2: Description Copy (1.5 ore)

**Store Listing - Short Description (132 chars max):**

```
Stay focused and productive. Block distracting websites, use Pomodoro timer, track your progress. Free forever.
```

**Store Listing - Detailed Description:**

```markdown
# Stay Focused. Be Productive. Build Habits.

FocusFlow helps you eliminate distractions and build better work habits.

## Core Features

✓ **Website Blocker**
Block distracting websites when you need to focus. Simple, effective, gentle.

✓ **Pomodoro Timer**
Built-in 25/5 Pomodoro timer keeps you in the zone. Start, pause, track.

✓ **Progress Tracking**
See your daily focus time, streak, and blocked sites. Motivation through data.

✓ **Smart Scheduling**
Auto-enable focus mode during your work hours. Set it and forget it.

✓ **Beautiful & Fast**
Clean, modern UI that gets out of your way. <1 second load time.

✓ **Privacy First**
All data stored locally. No tracking. No ads. No BS.

## Free Forever

Core features are 100% free:
- Block up to 10 websites
- Pomodoro timer (25/5 fixed)
- Today's stats
- Light/dark theme

## Premium ($4.99/month or $29.99 lifetime)

Unlock power features:
- Unlimited blocked websites
- Custom Pomodoro durations
- Full analytics history
- Multiple schedules
- Priority support

## Perfect For

- Students studying for exams
- Remote workers fighting distractions
- Freelancers building discipline
- Anyone serious about focus

## How It Works

1. Click icon → Enable Focus Mode
2. Add distracting sites to blocklist
3. Work without interruptions
4. Track your progress

That's it. Simple, effective, life-changing.

---

Support: focusflow@youremail.com
Privacy Policy: [link]
Website: [link]
```

#### PARTE 3: Promotional Tile + Marquee (1.5 ore)

**Promotional Tile (440x280):**

```
Design in Canva:
- Background: Same gradient as icon
- Text: "FocusFlow"
- Subtitle: "Block distractions. Build focus."
- Icon visible
```

**Marquee (1400x560) - Optional but recommended:**

```
Full-width banner:
- Left: App screenshots collage
- Right: "Stay Focused. Be Productive."
- CTA: "Try Free"
```

**DELIVERABLE GIORNO 3:**
✅ 5 screenshots
✅ Store description written
✅ Promotional images created
✅ Privacy policy draft

---

### **GIORNO 4: PRIVACY POLICY + FINAL PREP** - 3 ore

#### Privacy Policy (Simple)

```markdown
# FocusFlow Privacy Policy

Last updated: [Date]

## Data We Collect

**We collect ZERO personal data.**

FocusFlow stores:
- Your blocklist (stored locally in your browser)
- Your usage stats (stored locally in your browser)
- Your settings (stored locally in your browser)

**We do NOT collect:**
- Browsing history
- Personal information
- Usage analytics
- Cookies
- Anything else

## Third-Party Services

For premium subscriptions, we use:
- ExtensionPay (payment processing)
  - They collect: email, payment info
  - Their privacy policy: [link]

## Your Rights

- All your data is local to your browser
- Delete extension = all data deleted
- We cannot access your data (it never leaves your device)

## Contact

Questions? Email: privacy@focusflow.com

That's it. We're serious about privacy.
```

#### Final Checklist

```
☐ Version number correct in manifest.json (1.0.0)
☐ All permissions justified in description
☐ Icons all present and correct size
☐ No console errors in any page
☐ Extension size <5MB (should be ~500KB)
☐ All links working (privacy policy, support email)
☐ Developer email verified on Google Developer account
```

**DELIVERABLE GIORNO 4:**
✅ Privacy policy live (Google Doc public or simple site)
✅ Final testing passed
✅ Ready to submit

---

### **GIORNO 5: SUBMIT TO CHROME WEB STORE** - 2 ore

#### Step-by-Step Submission

**1. Create Developer Account (se non hai)**

```
1. Vai a chrome.google.com/webstore/devconsole
2. Sign in con Google account
3. Pay $5 one-time registration fee
4. Verify email
```

**2. Package Extension**

```bash
# Crea .zip di FocusFlow folder
# INCLUDI:
- manifest.json
- icons/
- popup/
- background/
- content/
- options/
- README.md (optional)

# NON includere:
- .git/
- node_modules/ (se hai)
- .env files
- claude.md (docs interne)
```

**3. Upload**

```
1. Chrome Web Store Developer Dashboard
2. "New Item"
3. Upload .zip
4. Fill form:
   - Category: Productivity
   - Language: English
   - Upload screenshots (5)
   - Detailed description (paste from Day 3)
   - Promotional images
   - Privacy policy URL
   - Support email
5. Permissions justification:
   - storage: Save user settings
   - alarms: Pomodoro timer
   - tabs: Check URLs for blocking
   - notifications: Timer alerts
6. Submit for review
```

**4. Timing**

```
Review time: 1-5 days (usually 2-3 days)
Status: Check dashboard daily
```

**DELIVERABLE GIORNO 5:**
✅ Extension submitted
✅ Payment processed ($5)
✅ Confirmation email received

---

### **GIORNO 6-7: PREPARE LAUNCH MATERIALS** - 6 ore

#### Mentre aspetti review, prepara marketing

**TASK 1: Landing Page (3 ore)**

```
Option A: Simple Carrd.co page (FREE)

Structure:
- Hero: "Stay Focused. Be Productive."
- Features grid (6 features)
- Screenshots carousel
- Pricing (Free vs Premium)
- CTA: "Install Free" (link to Chrome Store)
- Footer: Privacy, Contact

Option B: GitHub Pages (FREE)

Simple HTML page:
→ Prompt Claude Code:
"Create a landing page for FocusFlow Chrome extension.
Features: [list 6 features]
Include: Hero, features, screenshots, pricing, CTA.
Style: Modern, gradients, clean. Tailwind CSS."
```

**TASK 2: Product Hunt Draft (1 ora)**

```
Headline: "FocusFlow - Block distractions, build focus habits"

Description:
"Stay focused with website blocking, Pomodoro timer, and progress tracking.
 Free forever with premium features for power users."

Tagline: "Website blocker + Pomodoro timer + Habit tracking"

Topics: Productivity, Browser Extensions, Time Management

Media:
- Logo (128x128 icon)
- Screenshots (5)
- Demo video (create on Day 7)
```

**TASK 3: Demo Video (2 ore)**

```
Use Loom (free):
1. Record 60-90 seconds
2. Show:
   - Install extension (5 sec)
   - Add site to blocklist (10 sec)
   - Enable focus mode (5 sec)
   - Try to visit blocked site (10 sec)
   - Show blocked page (10 sec)
   - Start Pomodoro timer (10 sec)
   - Show stats (10 sec)
   - Quick settings tour (20 sec)
   - CTA (10 sec)
3. Add background music (YouTube Audio Library)
4. Export + upload to YouTube

Script:
"Focus is hard. FocusFlow makes it easy.
 [Demo blocking]
 [Demo timer]
 [Demo stats]
 Try it free today."
```

**DELIVERABLE GIORNO 6-7:**
✅ Landing page live
✅ Product Hunt draft ready
✅ Demo video created
✅ Social media posts drafted

---

## 🚀 LAUNCH DAY (GIORNO 8+)

### When Extension Approved

**MORNING (Launch Channels):**

```
☐ Product Hunt
  - Submit before 12:01 AM PST (best visibility)
  - Respond to ALL comments within 5 minutes
  - Aim: Top 5 of the day

☐ Twitter/X
  - Thread (8-10 tweets):
    1. Hook: "I built FocusFlow to solve my own distraction problem"
    2. The problem (distractions killing productivity)
    3. Feature showcase (GIF of blocking)
    4. Feature showcase (Pomodoro)
    5. Feature showcase (Stats)
    6. Why free forever
    7. Call to action
    8. Link + thanks
  - Pin to profile

☐ LinkedIn
  - Post with demo video
  - "I just launched FocusFlow..."
  - Tag relevant people

☐ Reddit
  - r/productivity (use "I made this" flair)
  - r/Chrome (check rules first)
  - r/SideProject
  - Wait 24h between posts (no spam)

☐ Indie Hackers
  - Post in "Show IH"
  - Share journey + link

☐ Hacker News
  - Submit as "Show HN: FocusFlow"
  - Include demo video in comment
```

**DURING DAY:**

```
☐ Respond to EVERY comment (5 min response time)
☐ Monitor Chrome Web Store reviews
☐ Fix any critical bugs immediately
☐ Thank everyone who shares
☐ Post updates (user count, feedback)
```

**EVENING:**

```
☐ Summary post (stats, learnings, thanks)
☐ Email friends/network
☐ Plan tomorrow's content
```

---

## 📊 SUCCESS METRICS

### Day 1 (Launch Day)

```
GOOD:
- 50-100 installs
- 10-20 comments/feedback
- 0 critical bugs

GREAT:
- 100-300 installs
- Product Hunt top 10
- 5-star review

AMAZING:
- 300-500 installs
- Product Hunt top 5
- Viral on Twitter
```

### Week 1

```
TARGET:
- 500-1,500 installs
- 10+ reviews (avg 4+ stars)
- 5-10 premium conversions ($25-50)

ACTION:
- Daily Twitter posts
- Respond to all reviews
- Fix reported bugs within 24h
- Post in 2-3 new communities
```

### Month 1

```
TARGET:
- 1,000-3,000 installs
- 50+ reviews
- 50-100 premium users ($250-500/month)

ITERATE:
- Top 3 feature requests → roadmap
- Improve based on feedback
- A/B test premium messaging
```

---

## 🐛 TROUBLESHOOTING

### "Extension Rejected by Chrome"

**Common Reasons:**

1. **Permissions too broad**
   - Fix: Justify each permission in description
   - Provide use case examples

2. **Privacy policy missing**
   - Fix: Add public privacy policy URL

3. **Icons wrong size**
   - Fix: Exact sizes (16x16, 48x48, 128x128 PNG)

4. **Manifest errors**
   - Fix: Validate at Manifest V3 validator

**Recovery:**
- Fix issue
- Resubmit (usually faster review 2nd time)
- Add detailed notes explaining fix

### "Zero Installs After Launch"

**Diagnosis:**

```
Check:
☐ Is listing live and visible?
☐ Are screenshots compelling?
☐ Is description clear?
☐ Did you actually market it?
```

**Fix:**
- Marketing was the problem 90% of the time
- Double down on launch channels
- Ask friends to install + review
- Share in more communities

### "Users Report Bugs"

**Process:**

```
1. Acknowledge immediately (< 1 hour)
2. Reproduce bug (30 min)
3. Fix with Claude Code (1-2 hours)
4. Test fix (30 min)
5. Update extension (upload new version)
6. Reply to user: "Fixed in v1.0.1, update in 24h"
```

---

## 📋 COMPLETE CHECKLIST

```
PRE-LAUNCH:
☐ Icons created (16, 48, 128)
☐ Full testing done
☐ No console errors
☐ Screenshots taken (5)
☐ Description written
☐ Privacy policy live
☐ Promotional images made
☐ Developer account setup ($5 paid)
☐ Extension submitted

WHILE IN REVIEW:
☐ Landing page live
☐ Demo video created
☐ Product Hunt draft ready
☐ Social posts drafted
☐ Launch strategy clear

POST-APPROVAL:
☐ Product Hunt submitted
☐ Social media blitz
☐ Monitor feedback
☐ Fix bugs immediately
☐ Respond to all comments

WEEK 1:
☐ Daily content
☐ Community engagement
☐ Bug fixes
☐ Feature prioritization
```

---

## 🎯 AFTER LAUNCH

### Week 2-4: Iterate

```
Based on feedback:
☐ Implement top 3 feature requests
☐ Improve onboarding (if confusion)
☐ A/B test premium conversion
☐ Content marketing (blog posts, videos)
```

### Month 2-3: Scale

```
☐ SEO content ("best Chrome productivity extensions")
☐ Reach out to productivity bloggers
☐ Submit to extension directories
☐ Consider affiliates/partnerships
☐ Launch v1.1 with new features
```

---

## 💰 REVENUE EXPECTATIONS

```
Week 1: $25-100
Week 4: $200-500/month
Month 3: $800-1,500/month
Month 6: $1,500-3,000/month
Month 12: $3,000-5,000/month

Based on:
- 1,000-10,000 installs by Month 12
- 5-10% premium conversion
- $4.99/month pricing
```

---

## 🔥 FINAL MESSAGE

**YOU'RE 7 DAYS FROM YOUR FIRST PASSIVE INCOME PRODUCT.**

**Timeline is aggressive but achievable.**

**Day 1-2:** Build (icons + test)
**Day 3-5:** Prep + submit
**Day 6-7:** Marketing prep
**Day 8+:** LAUNCH

**Stay focused. Execute. Launch.**

---

**PROSSIMO FILE: `04-CLAUDE-CODE-SUPERPOWERS.md`**

*(Come usare Claude Code per 10x velocità)*
