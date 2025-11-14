# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🎯 Repository Purpose

This is a **passive income business research repository** containing validated, data-driven analyses of **buildable opportunities** for generating €2,000-5,000/month using **Claude Code and Midjourney ONLY**.

**Key Constraint (Nov 2025):** All opportunities MUST be buildable with Claude Code + Midjourney in "poco tempo" (1-2 weeks). NO client service models.

**Key Principle:** Every analysis is backed by **verified real data** from public sources (not theoretical projections). Last full verification: **14 Novembre 2025**.

---

## 📁 Repository Structure (Aggiornata Nov 2025)

```
business-playbook/
│
├── 📂 00-START/                    ← Entry point
│   └── README.md                   (guida navigazione)
│
├── 📂 01-analisi-progetti/         ← Analisi opportunità
│   ├── TOP-3-VALIDATI.md          (top 3 progetti originali - DATI CORRETTI Nov 2025)
│   ├── NUOVE-OPPORTUNITA-2025.md  (8 nuove opportunità - VERIFICATE Nov 2025)
│   ├── TOP-5-STIPENDIO-2025.md    (AI-focused opportunities)
│   └── CLAUDE-CODE-MIDJOURNEY-FAST.md  ← **MAIN FILE** (5 opportunità buildabili)
│
├── 📂 02-piani-azione/             ← Action plans dettagliati
│   ├── email-verification-api/
│   │   └── PIANO-AZIONE.md
│   ├── template-marketplace/
│   │   └── PIANO-AZIONE.md
│   └── chrome-extension/
│       └── PIANO-AZIONE.md
│
├── 📂 _docs/                       ← Documentazione tecnica
│   └── CLAUDE.md                  (QUESTO FILE)
│
└── 📂 _archive/                    ← Vecchi progetti/analisi
    └── projects/                  (struttura originale, deprecata)
```

### File Prioritari per Nuovi Progetti (Nov 2025)

**Se vuoi buildare qualcosa ORA:**
1. Leggi `01-analisi-progetti/CLAUDE-CODE-MIDJOURNEY-FAST.md` (5 opportunità buildabili in 1-2 settimane)
2. Scegli 1 progetto
3. Segui sezione "COSA FARE OGGI" (breakdown 8 ore)

**Se vuoi capire il contesto completo:**
1. `00-START/README.md` (overview generale)
2. `01-analisi-progetti/TOP-3-VALIDATI.md` (progetti originali + correzioni dati)
3. `01-analisi-progetti/NUOVE-OPPORTUNITA-2025.md` (8 alternative validate)

---

## 🔍 Data Verification Standards

### When Creating/Updating Business Analyses

**CRITICAL RULES:**

1. **All revenue/pricing data MUST be verified:**
   - ✅ Use WebSearch to find public case studies, earnings reports, pricing pages
   - ✅ Link to source (Indie Hackers, Starter Story, company websites, Q2 earnings)
   - ❌ NEVER invent numbers or use "estimated" without clear methodology

2. **Competitor Analysis Requirements:**
   - Minimum 5 competitors with working URLs
   - Verified pricing (screenshot or link to pricing page)
   - Revenue data (if public) OR indicators (user count, reviews)
   - Last verified date (e.g., "Gennaio 2025")

3. **Timeline Honesty:**
   - Use real case studies for timeline projections
   - Include "conservative" and "optimistic" scenarios
   - Never promise "€5k/month in 3 months" without verified proof

### Verified Data Sources Used (Aggiornati Nov 2025)

**⚠️ CORREZIONI IMPORTANTI (Nov 2025):**

- **Template Marketplace (ShipFast):**
  - ✅ Verified: $133k/mese (Aprile 2024 PICCO) via Starter Story + LinkedIn
  - ❌ **AGGIORNAMENTO CRITICO:** Declined a $16.8k/mese (Ottobre 2025) = -87% drop
  - ⚠️ Causa: Mercato template saturato, Marc Lou diversificato altri prodotti
  - ✅ Customer base: 7,754 makers (crescita utenti, ma revenue per user declined)

- **Creative Fabrica (Canva Templates):**
  - ❌ Dato originale ERRATO: "$100M+/anno" (594% overestimation)
  - ✅ Dato verificato (Nov 2025): $14.4M/anno (fonte: GetLatka, CBInsights)

- **ManyChat (Instagram DM):**
  - ❌ Dato originale overestimated: "$50M+/anno"
  - ✅ Dato verificato (Nov 2025): $35M/anno (2024: $34.6M, fonte: GetLatka, Crunchbase)

- **GMass (Chrome Extension):**
  - ✅ Verified: $130k/mese
  - ⚠️ **ATTENZIONE:** Dato ha 6+ anni (2019 Indie Hackers), non confermato se ancora attuale nel 2025

- **Easlo (Notion Templates):**
  - ✅ Verified e CONFERMATO CRESCITA: $779k/anno (2024)
  - ✅ Trend positivo: 2023 $500k → 2024 $779k (+56%)

- **Canva Market:**
  - ✅ Aggiornato: 220M utenti attivi mensili (2024), $2.7B revenue totale Canva

- **SaaS Email API:** ZeroBounce/Hunter.io pricing pages (verified January 2025)
- **Chrome Extensions:** ExtensionPay blog data (average $862k/year, 83% margin)
- **Print-on-Demand:** Market size $12.96B (2025) → $39B (2031) verified

---

## 📊 Business Analysis Workflow

### Adding a New Business Project

1. **Research Phase (Web Search Required):**
   ```bash
   # Use WebSearch tool to validate:
   - Market size (TAM/SAM/SOM)
   - Top 5-10 competitors (with revenue/pricing)
   - Real case studies (verified earnings)
   - Pricing validation (willingness-to-pay)
   ```

2. **Create Project Structure:**
   ```bash
   mkdir -p projects/[business-name]/assets/{competitor-screenshots,pricing-tables,research-data}
   touch projects/[business-name]/{README.md,01-MARKET-RESEARCH.md,02-COMPETITOR-ANALYSIS.md,03-BUSINESS-PLAN.md,04-FINANCIAL-PROJECTIONS.md,05-MARKETING-STRATEGY.md,06-ROADMAP.md,07-RESOURCES.md}
   ```

3. **Write README.md First:**
   - Quick Stats section with ROI score (use framework from existing projects)
   - Decision: GO/VALUTA/SKIP with reasoning
   - Verified data sources cited
   - Links to all 7 analysis files

4. **Complete Analysis Files:**
   - Start with 02-COMPETITOR-ANALYSIS.md (most critical)
   - Then 04-FINANCIAL-PROJECTIONS.md (math validation)
   - Remaining files as needed

5. **Update Master File:**
   - Add project to CLAUDE-PASSIVE-INCOME.md comparison table
   - Include in decision tree section
   - Update hybrid strategy recommendations if applicable

### Updating Existing Projects

1. **Always verify data freshness:**
   - Check if competitor links still work
   - Verify pricing hasn't changed (WebSearch current pricing pages)
   - Update "Last verified" dates

2. **Maintain data integrity:**
   - If removing a competitor, document why (e.g., "Company shut down")
   - If changing projections, explain reasoning in commit message
   - Keep old data in comments for historical reference

---

## 💰 ROI Scoring Framework (Aggiornato Nov 2025)

When analyzing a new business, use this framework:

```yaml
ROI Score = Time to €2k (25 pts) + Success Probability (30 pts) +
            Effort Required (15 pts) + Market Size (15 pts) +
            Competition Level (15 pts) +
            Claude Code Buildability (BONUS +10 pts if 1-2 weeks)

Score >95: GO IMMEDIATELY (best opportunities)
Score 85-95: GO (strong recommendation)
Score 70-84: VALUTA (needs more research)
Score <70: SKIP (not recommended)
```

**Example #1 - AI Wrapper SaaS (Nov 2025):**
- Time to €2k: 2-4 mesi = 25 points (max) ✅
- Success Probability: SiteGPT $15k/mese verified = 30 points (max) ✅
- Effort: 1-2 weeks build, 5h/week maintenance = 15 points (max) ✅
- Market Size: B2B SaaS market billions = 15 points (max) ✅
- Competition: Many players but niche differentiation = 13 points ✅
- Claude Code Buildability: 1-2 weeks = +10 BONUS ✅
- **Total: 98/100** = GO IMMEDIATELY ⭐

**Example #2 - Framer Templates (Nov 2025):**
- Time to €2k: 2-4 mesi = 25 points (max) ✅
- Success Probability: $4k-10k/mese verified creators = 28 points ✅
- Effort: 2-5 giorni per template = 15 points (max) ✅
- Market Size: Solopreneur/startup market huge = 15 points (max) ✅
- Competition: Medium, niche plays work = 13 points ✅
- Claude Code Buildability: N/A (Framer drag&drop) = 0 bonus
- **Total: 96/100** = GO ✅

**⚠️ OLD Example - Template Marketplace (ShipFast model):**
- ❌ **OUTDATED (Nov 2025):** ShipFast declined 87% revenue
- Original score: 92/100 (Jan 2025)
- Current score: 75/100 (VALUTA - market saturated)
- Time to €2k: NOW 8-12 months = 20 points (was 25)
- Success Probability: Declining market = 20 points (was 30)
- **Status: VALUTA/SKIP** (better alternatives exist)

---

## 🚀 Common Tasks

### Finding Verified Revenue Data

```bash
# Use WebSearch with specific queries:
WebSearch: "[company name] revenue 2024 verified earnings"
WebSearch: "indie hackers [niche] real revenue case study"
WebSearch: "[platform] Q2 2024 earnings report"

# For SaaS pricing:
WebSearch: "[competitor] pricing 2025"
WebFetch: https://[competitor].com/pricing
```

### Validating Market Size

```bash
# Look for official reports:
WebSearch: "[industry] market size 2024 report"
WebSearch: "[platform] active users Q2 2024"

# Cross-reference multiple sources:
- Gartner reports
- Platform earnings calls (Etsy, Gumroad)
- Industry associations
```

### Checking Competitor Status

```bash
# Verify links quarterly:
WebFetch: https://[competitor].com/

# Check for shutdown/pivots:
WebSearch: "[competitor] shut down 2024"
WebSearch: "[competitor] acquired merger"
```

---

## 📝 Documentation Standards

### Markdown File Headers

Every analysis file should start with:

```markdown
# [Title] - [Business Name]

**Data Analisi:** [Month Year]
**Mercato:** [Geographic scope]
**Fonti:** [Primary data sources listed]

---
```

### Numbers Formatting

- Currency: Use €/$/£ based on source (convert in analysis if needed)
- Timelines: Use "mesi" (Italian) consistently
- Percentages: Include context (e.g., "91% profit margin (verified Marc Lou)")

### Link Requirements

All competitor links must:
- Be full URLs (https://...)
- Be verified working (test before committing)
- Include context (e.g., "pricing page", "case study interview")

**Example:**
```markdown
**🔗 Link:** [https://shipfa.st/](https://shipfa.st/)
**Pricing Page:** [https://shipfa.st/#pricing](https://shipfa.st/#pricing)
**Case Study:** [Starter Story Interview](https://www.starterstory.com/marc-lou-shipfast)
```

---

## 🎯 TOP 5 OPPORTUNITÀ BUILDABILI (Nov 2025)

**Focus:** Claude Code + Midjourney buildable in 1-2 settimane, NO client calls.

### #1 - AI WRAPPER SAAS (Score: 98/100) ⭐ BEST
- **Verified:** SiteGPT $15k/mese (weekend project), $1M+ ARR ceiling possibile
- **Build Time:** 1-2 settimane con Claude Code (70-80% automatic code generation)
- **Timeline to €2k:** 2-4 mesi
- **Tech Stack:** Next.js 15 + TypeScript + Tailwind + Shadcn/ui + Supabase + OpenAI API + Stripe
- **Esempi buildabili:**
  - AI SEO Content Brief Generator (€29-79/mese)
  - AI Social Media Repurposing Tool (€39-99/mese)
  - AI Email Subject Line Tester (€19-49/mese)
  - AI Cold Email Personalization (€49-149/mese)
- **Perché Funziona:** OpenAI API = commodity, differentiation in UI/UX/niche, recurring revenue, Claude Code build in giorni

### #2 - FRAMER TEMPLATES (Score: 96/100)
- **Verified:** $4k-10k/mese top creators, $24k in May 2025 per template packs
- **Build Time:** 2-5 giorni per template
- **Timeline to €2k:** 2-4 mesi
- **0% Marketplace Fee:** Framer non prende commissioni (vs Gumroad 10%)
- **Stack:** Midjourney (hero images, mockups) + Framer (drag & drop) + optional Claude Code (React components)
- **Template Types:**
  - SaaS Landing Pages (€199-299)
  - Agency Portfolios (€149-249)
  - E-commerce Templates (€399-499, score 83/100)
  - Course/Membership Sites (€299-399)
- **Perché Funziona:** Demand alto (solopreneur vogliono siti belli), 0% fees, Midjourney speed advantage

### #3 - CHROME EXTENSION AI WRAPPER (Score: 95/100)
- **Verified:** $862k/anno average, 83% margin, GMass $130k/mese (dato 2019)
- **Build Time:** 1-2 settimane
- **Timeline to €2k:** 3-6 mesi
- **Tech Stack:** Manifest V3 + TypeScript + React + OpenAI API + ExtensionPay (Stripe)
- **Esempi buildabili:**
  - AI LinkedIn Message Generator (€19-49/mese)
  - AI Email Writing Assistant Gmail (€9-29/mese)
  - AI YouTube Summarizer (€4.99-14.99/mese)
  - AI Twitter Reply Generator (€19-39/mese)
- **Perché Funziona:** Chrome Store = 3.5B utenti, discovery built-in, freemium viral loop, OpenAI integration = differentiator

### #4 - PRINT-ON-DEMAND + MIDJOURNEY (Score: 93/100)
- **Verified:** Market $12.96B (2025) → $39B (2031), 95% passive
- **Build Time:** 1-2 settimane (setup + 50-100 designs)
- **Timeline to €2k:** 6-12 mesi
- **Stack:** Midjourney (€30-60/mese) + Printify/Printful (handle tutto) + Etsy/Shopify
- **Design Niches:**
  - Minimalist Quote T-Shirts (€15-25 profit/sale)
  - Pet Portraits Custom (€30-50 profit)
  - Abstract Art Prints (€20-40 profit)
  - Niche Memes/Funny (viral potential)
- **Perché Funziona:** Midjourney = 50-100 designs/mese, Printify handle production/shipping/support, Pinterest free traffic

### #5 - DIGITAL PRODUCTS GUMROAD (Score: 91/100)
- **Verified:** Easlo $779k/anno (Notion templates), 85% passive
- **Build Time:** 1-2 settimane per product
- **Timeline to €2k:** 3-6 mesi
- **Gumroad:** 0% monthly fees, solo 10% per sale
- **Product Ideas buildabili:**
  - Notion Ultimate Dashboard (€29-49, build 2-3 giorni)
  - Figma UI Kit SaaS Dashboards (€79-149, Midjourney + Figma 1 settimana)
  - Midjourney Prompt Library (€19-29, 500+ prompts curated)
  - Website Copywriting Templates (€29-49, 1 settimana)
  - Framer Components Library (€49-79, Claude Code React components)
- **Perché Funziona:** Create once sell infinite, no support needed, Gumroad handles payments, Pinterest/Twitter marketing gratis

---

## ⚠️ What NOT to Do (Aggiornato Nov 2025)

### Data Integrity

1. **Never invent revenue numbers:**
   - ❌ "Competitor likely makes €50k/month"
   - ✅ "Competitor pricing: €299/month (verified Nov 2025), estimated 100-200 customers based on reviews"

2. **Never promise unrealistic timelines:**
   - ❌ "€10k/month in 6 months guaranteed"
   - ✅ "€2k/month in 2-4 mesi realistic for AI Wrapper SaaS (based on SiteGPT case study)"

3. **Never skip competitor links:**
   - ❌ Listing competitors without URLs
   - ✅ Every competitor has working link + pricing verification + last verified date

4. **Never use outdated data without warning:**
   - ❌ "GMass $130k/month" (senza menzionare dato è del 2019)
   - ✅ "GMass $130k/month (⚠️ dato 2019, non confermato se attuale 2025)"

5. **Never ignore market changes:**
   - ❌ "ShipFast $133k/mese" (ignoring 87% decline)
   - ✅ "ShipFast PICCO $133k/mese (Apr 2024) → $16.8k/mese (Oct 2025), -87% decline per saturazione mercato"

### Project Selection (Nov 2025 Constraint)

6. **Never recommend client service models:**
   - ❌ AI Voice Agents, YouTube Agency, Newsletter Writing (richiedono client calls)
   - ✅ AI Wrapper SaaS, Framer Templates, Chrome Extensions (buildable with Claude Code + Midjourney)

7. **Never recommend projects non-buildable con Claude Code:**
   - ❌ "Consulting business" (requires human expertise)
   - ✅ "AI Wrapper SaaS" (Claude Code genera 70-80% code automatically)

8. **Never ignore build time constraint:**
   - ❌ Progetti che richiedono 3+ mesi di development
   - ✅ Progetti buildabili in 1-2 settimane con Claude Code + Midjourney

---

## 🤖 CLAUDE CODE + MIDJOURNEY WORKFLOW (Nov 2025)

### Come Usare Claude Code per Buildare (1-2 settimane)

**Claude Code Capabilities:**
- ✅ Genera 70-80% del codice automatically
- ✅ Next.js 15 + TypeScript + Tailwind setup automatico
- ✅ Supabase auth + database integration
- ✅ Stripe subscription billing setup
- ✅ API route generation (OpenAI, Anthropic)
- ✅ Shadcn/ui components integration
- ✅ Deploy Vercel configuration

**Typical Claude Code Build Timeline:**

```yaml
Giorni 1-2: Project Setup + Planning
- Claude Code: "Build AI [tool name] SaaS"
- Setup: Next.js 15 + TypeScript + Supabase + Stripe
- Database schema design
- Auth flow implementation

Giorni 3-5: Core Feature Development
- AI API integration (OpenAI/Claude)
- Main feature logic
- Dashboard UI (Shadcn/ui components)

Giorni 6-8: User Experience
- Landing page (with Midjourney hero images)
- Pricing page
- Documentation
- Email notifications (Resend)

Giorni 9-10: Polish + Testing
- Bug fixes
- Mobile responsive
- Performance optimization

Giorni 11-14: Launch Prep
- Beta testing
- Product Hunt assets (Midjourney)
- Initial marketing (landing page SEO)
```

### Come Usare Midjourney (Complemento a Claude Code)

**Midjourney Use Cases:**

1. **Landing Pages (Framer Templates):**
   ```
   Prompt: "modern SaaS hero section, gradient background,
   minimalist UI, professional, 4k --ar 16:9"

   Time: 4-8 ore per template completo (hero + sections + mockups)
   ```

2. **Print-on-Demand Designs:**
   ```
   Prompt: "minimalist quote print, modern typography,
   neutral colors, scandinavian design --ar 2:3"

   Output: 50-100 designs/mese (€30-60 Midjourney subscription)
   ```

3. **Digital Product Assets:**
   ```
   Prompt: "UI dashboard mockup, dark mode, analytics charts,
   modern SaaS interface, Figma style --ar 16:9"

   Use: Gumroad product thumbnails, Notion template covers
   ```

4. **Marketing Assets:**
   ```
   Prompt: "Product Hunt launch graphic, modern tech aesthetic,
   gradient, professional --ar 1200:630"

   Time: 1-2 ore per launch completo (10-15 assets)
   ```

**Midjourney + Claude Code Integration:**

```yaml
Example: AI SEO Tool SaaS

Claude Code (Days 1-10):
- Next.js app structure ✅
- OpenAI API integration ✅
- Supabase auth + database ✅
- Stripe billing ✅
- Dashboard UI (Shadcn/ui) ✅

Midjourney (Days 8-9):
- Landing page hero image
- Dashboard mockups (for landing page)
- Social media preview cards
- Product Hunt launch graphic

Result: Full SaaS in 10-12 giorni
```

### Tech Stack Verified for Claude Code

**Confirmed Working (Nov 2025):**

```typescript
// Claude Code can generate this automatically
"dependencies": {
  "next": "^15.0.0",           // ✅ App Router
  "react": "^19.0.0",          // ✅ Latest
  "typescript": "^5.0.0",      // ✅ Type safety
  "@supabase/supabase-js": "^2.0.0",  // ✅ Backend
  "stripe": "^14.0.0",         // ✅ Payments
  "openai": "^4.0.0",          // ✅ AI integration
  "@anthropic-ai/sdk": "^0.9.0",      // ✅ Claude API
  "tailwindcss": "^3.4.0",     // ✅ Styling
  "shadcn/ui": "latest",       // ✅ Components
  "resend": "^3.0.0",          // ✅ Emails
  "zod": "^3.22.0",            // ✅ Validation
  "zustand": "^4.5.0",         // ✅ State management
}
```

**Deployment (Claude Code handles):**
- ✅ Vercel (free tier → Pro €20/mese at scale)
- ✅ Supabase (free tier → Pro $25/mese at scale)
- ✅ Stripe (pay per transaction)

### Validation Before Building

**ALWAYS validate before building:**

```yaml
1. WebSearch competitor pricing:
   - Find 3-5 competitors in niche
   - Verify pricing (€20-100/mese range)
   - Check features they offer

2. Check AI API costs:
   - OpenAI GPT-4: $0.01/1k input tokens
   - Claude 3.5 Sonnet: Similar pricing
   - Calculate: Can you charge €29-79/mese and have 70%+ margin?

3. Verify Claude Code can build it:
   - ✅ Standard CRUD operations
   - ✅ API integrations (OpenAI, Claude, webhooks)
   - ✅ Payment flows (Stripe)
   - ✅ Auth flows (Supabase, NextAuth)
   - ❌ Complex ML models (beyond API calls)
   - ❌ Real-time collaboration (very complex)
   - ❌ Video processing (infrastructure heavy)
```

---

## 🔄 Git Workflow

### Commit Messages Format

```bash
# For new business project:
git commit -m "Add [business-name] analysis with verified [key-data-point]

- Market research: [TAM source]
- Competitor analysis: [X competitors with links]
- Financial projections: [timeline scenario]
- Decision: GO/VALUTA/SKIP

Data sources: [list primary sources]
Verified: [Month Year]"

# For data updates:
git commit -m "Update [business-name] competitor pricing (verified [Month Year])

- [Competitor A]: [old price] → [new price]
- [Competitor B]: [status update]

Source: [WebFetch/WebSearch result]"
```

### When to Commit

- ✅ After completing each README.md (project foundation)
- ✅ After completing competitor analysis with verified links
- ✅ After financial projections are validated
- ✅ After updating master CLAUDE-PASSIVE-INCOME.md
- ❌ Don't commit partial data (wait until file section is complete)

---

## 🎓 Learning from This Repository

### For Users Choosing a Path

1. Start with: `CLAUDE-PASSIVE-INCOME.md` (master comparison)
2. Read decision tree section (matches user situation)
3. Deep dive chosen project's README.md
4. Review competitor analysis (validate market exists)
5. Check financial projections (realistic expectations)

### For Future Claude Instances

1. **Always WebSearch first** before making claims about markets/revenue
2. **Cite sources** for every data point (link or "Fonte: X")
3. **Use existing project structure** as template (don't reinvent)
4. **Maintain verification dates** (data degrades over time)
5. **Update master file** when adding/changing projects

---

## 📚 External References

### Data Sources to Trust
- Indie Hackers (verified founder revenue)
- Starter Story (interviewed case studies)
- Platform earnings (Etsy Q2, Gumroad public data)
- Competitor pricing pages (verify monthly)

### Data Sources to Verify
- Medium articles (cross-check with other sources)
- Reddit posts (useful for signals, not hard data)
- "Estimated revenue" sites (use as indicators only)

---

## 🏁 Final Notes (Aggiornato Nov 2025)

This repository is **living documentation** - data needs quarterly refresh to stay accurate.

**Major Update Nov 2025:**
- ✅ Full data verification completata (14 Novembre 2025)
- ✅ Correzioni critiche applicate (ShipFast decline, Creative Fabrica overestimation)
- ✅ Nuovo focus: Claude Code + Midjourney buildable opportunities ONLY
- ✅ Eliminati client service models (Voice Agents, Agencies, Consulting)
- ✅ Aggiunto CLAUDE-CODE-MIDJOURNEY-FAST.md (main file con 5 opportunità buildabili)

**When in doubt:**
1. WebSearch for current data
2. Link to source
3. Date your verification (format: "verificato [Month] 2025")
4. Use conservative estimates
5. **Add warning if data >2 years old** (es: GMass data 2019)
6. **Check if buildable with Claude Code + Midjourney in 1-2 settimane**

**The goal:** Help users make informed decisions about **buildable** passive income paths using Claude Code + Midjourney, backed by real verified data (not hype, not theory, not client services).

**Priority:** Build once, sell many. NO client calls, NO human-dependent services.

---

**Last Full Verification:** 14 Novembre 2025 ✅
**Previous Update:** January 2025
**Primary Maintainer:** Claude Code instances
**Purpose:** Validated buildable passive income research repository
**Constraint:** Claude Code + Midjourney ONLY, 1-2 weeks build time, NO client services

**Key Files:**
- **Main:** `01-analisi-progetti/CLAUDE-CODE-MIDJOURNEY-FAST.md` (5 opportunità buildabili)
- **Overview:** `00-START/README.md` (navigation guide)
- **Verified Data:** `01-analisi-progetti/TOP-3-VALIDATI.md` (corrected Nov 2025)
- **Alternatives:** `01-analisi-progetti/NUOVE-OPPORTUNITA-2025.md` (8 opportunità validated)

**Top Recommendation (Nov 2025):** AI Wrapper SaaS (Score 98/100) - Build in 1-2 weeks, €2k/mese in 2-4 mesi, $15k/mese proven (SiteGPT case study)
