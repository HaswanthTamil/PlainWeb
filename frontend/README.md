# PlainWeb

**PlainWeb turns technical website audits into plain-English reports that anyone can understand.**

Most tools tell you _what’s wrong_ with a website — PlainWeb explains **why it matters and how to fix it**, without developer jargon.

---

## What PlainWeb Does

PlainWeb analyzes a website using Google Lighthouse and custom UI checks, then translates the results into **clear, actionable insights** for non-technical users.

### It helps answer:

- What’s broken?
- Who is affected?
- How do I fix this (in simple terms)?

---

## Key Features

- **Accessibility Analysis**  
  Detects issues like missing alt text, low contrast, keyboard traps, and unclear labels.

- **Broken & Poor UI Detection**  
  Finds mobile layout issues, tiny buttons, overlapping elements, and responsiveness problems.

- **Plain-English Reports**  
  No scores without meaning. Every issue includes:

- What’s wrong
- Why it matters
- How to fix it

- **Fast Demo-Friendly Results**  
  Reports are cached to avoid long Lighthouse run times during demos.

---

## How It Works

```
Website URL
   ↓
Lighthouse Audit (Accessibility)
   ↓
Custom UI & UX Checks
   ↓
Issue → Impact Mapping
   ↓
Plain-English Report
```

PlainWeb doesn’t replace Lighthouse — it **humanizes it**.

---

## Tech Stack

- **Frontend:** Web app (React / Next.js)
- **Audit Engine:** Google Lighthouse
- **Backend:** Firebase Cloud Functions
- **Database:** Firebase Firestore (cached reports)
- **Hosting:** Firebase Hosting
- **Optional AI:** Gemini (for summarizing reports)

---

## Target Users

- Small business owners
- Startup founders
- Designers & marketers
- Non-technical stakeholders
- Developers who want quick, readable insights

---

## Why PlainWeb?

> Lighthouse is built for developers.  
> PlainWeb is built for **humans**.

Instead of overwhelming users with metrics, PlainWeb focuses on **clarity, impact, and action**.

---

## Demo Strategy (Hackathon)

To ensure a smooth demo experience:

- Lighthouse audits are pre-run
- Results are cached in Firestore
- Reports load instantly during presentation

In production, audits run asynchronously in the background.

---

## Future Enhancements

- Shareable report links
- Before vs After accessibility comparisons
- Browser extension
- “Email this report to my developer” feature
- Cost-of-ignoring-accessibility insights

---

## Team

Built with passion by **Team Ally**  
For the **TechSprint**

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
