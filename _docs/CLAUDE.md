# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🎯 Repository Purpose

This is a **passive income business research repository** containing validated, data-driven analyses of 4 business models for generating €2,000-5,000/month using AI tools (Claude Code and Midjourney).

**Key Principle:** Every analysis is backed by **verified real data** from public sources (not theoretical projections).

---

## 📁 Repository Structure

```
.
├── CLAUDE-PASSIVE-INCOME.md          # Master comparison guide (START HERE)
├── projects/                          # Individual business project analyses
│   ├── template-marketplace-nextjs/  # Next.js SaaS templates (ShipFast model)
│   ├── saas-email-verification-api/  # Email validation SaaS
│   ├── chrome-extension-productivity/# Chrome extensions (productivity tools)
│   └── etsy-printables-passive/      # Etsy printables with Midjourney
└── .git/
```

### Project Structure Standard

Each `projects/[business-name]/` follows this structure:

```
projects/[business-name]/
├── README.md                          # Quick stats, decision (GO/VALUTA/SKIP), verified data
├── 01-MARKET-RESEARCH.md             # TAM/SAM/SOM, market trends
├── 02-COMPETITOR-ANALYSIS.md         # Top 5+ competitors with LINKS + pricing
├── 03-BUSINESS-PLAN.md               # ROI score, execution strategy
├── 04-FINANCIAL-PROJECTIONS.md       # 24-month realistic projections
├── 05-MARKETING-STRATEGY.md          # Channels, budget, customer acquisition
├── 06-ROADMAP.md                     # Week-by-week implementation timeline
├── 07-RESOURCES.md                   # Tools, links, learning resources
└── assets/                            # Screenshots, pricing tables, research data
    ├── competitor-screenshots/
    ├── pricing-tables/
    └── research-data/
```

**Note:** Not all 8 files exist yet for each project (work in progress). README.md is always complete.

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

### Verified Data Sources Used

- **Template Marketplace:** Marc Lou (ShipFast) - $133k/month verified via Starter Story interview + LinkedIn
- **SaaS Email API:** ZeroBounce/Hunter.io pricing pages (January 2025)
- **Chrome Extensions:** ExtensionPay blog, GMass case study ($130k/month)
- **Etsy Printables:** makingsenseofcents.com blog ($6,161 in 4 months, new shop 2024), Etsy Q2 2024 earnings

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

## 💰 ROI Scoring Framework

When analyzing a new business, use this framework (defined in projects):

```yaml
ROI Score = Time to €2k (25 pts) + Success Probability (30 pts) +
            Effort Required (15 pts) + Market Size (15 pts) +
            Competition Level (15 pts)

Score >80: GO (strong recommendation)
Score 70-80: VALUTA (needs more research)
Score <70: SKIP (not recommended)
```

**Example from Template Marketplace:**
- Time to €2k: 4-8 months = 25 points (max)
- Success Probability: Marc Lou proof = 30 points (max)
- Effort: 10-15h/week maintenance = 12 points
- Market Size: Indie hackers 200k+ = 15 points (max)
- Competition: 5-10 major players = 10 points
- **Total: 92/100** = Strong GO ✅

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

## 🎯 Key Insights from Existing Analyses

### Template Marketplace (Fastest Path)
- **Verified:** Marc Lou $133k/month (ShipFast)
- **Timeline:** 4-8 months to €2k/month
- **Why It Works:** High per-sale revenue (€150-299), proven demand, Claude Code advantage (build in 4-6 weeks)

### SaaS Email Verification (Recurring Revenue)
- **Verified:** ZeroBounce pricing €18-2,000/month
- **Timeline:** 9-15 months to €2k MRR
- **Why It Works:** B2B market, recurring revenue compounds, low churn

### Chrome Extensions (Built-in Distribution)
- **Verified:** GMass $130k/month, Closet Tools $42k/month
- **Timeline:** 9-15 months to €2k/month
- **Why It Works:** Chrome Web Store discovery, freemium viral growth

### Etsy Printables (True Passive)
- **Verified:** $6,161 in 4 months (new shop 2024), 91.5M Etsy buyers
- **Timeline:** 15-24 months to €2k/month
- **Why It Works:** 90% passive after 24 months, zero support needed, Midjourney speed advantage

---

## ⚠️ What NOT to Do

1. **Never invent revenue numbers:**
   - ❌ "Competitor likely makes €50k/month"
   - ✅ "Competitor pricing: €299/month (verified), estimated 100-200 customers based on reviews"

2. **Never promise unrealistic timelines:**
   - ❌ "€10k/month in 6 months guaranteed"
   - ✅ "€2k/month in 9-15 months realistic (based on verified case study X)"

3. **Never skip competitor links:**
   - ❌ Listing competitors without URLs
   - ✅ Every competitor has working link + pricing verification

4. **Never use outdated data:**
   - ❌ "Competitor pricing from 2022 analysis"
   - ✅ "Pricing verified January 2025 via WebFetch"

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

## 🏁 Final Notes

This repository is **living documentation** - data needs quarterly refresh to stay accurate.

**When in doubt:**
1. WebSearch for current data
2. Link to source
3. Date your verification
4. Use conservative estimates

**The goal:** Help users make informed decisions about passive income paths using AI tools, backed by real data, not hype.

---

**Last Updated:** January 2025
**Primary Maintainer:** Claude Code instances
**Purpose:** Validated passive income business research repository
