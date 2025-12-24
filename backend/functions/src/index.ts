import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import express from "express";
// import lighthouse from "lighthouse"; // Converted to dynamic import
import * as chromeLauncher from "chrome-launcher";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as crypto from "crypto";

admin.initializeApp();

const db = admin.firestore();
if (process.env.FIRESTORE_EMULATOR_HOST) {
  db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false } as any);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// WCAG Rule Mapping Table
interface AccessibilityRule {
  wcag: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  impact: string;
  autoFixPotential: "high" | "medium" | "low";
}

const ACCESSIBILITY_RULE_MAP: Record<string, AccessibilityRule> = {
  "accesskeys": {
    wcag: "WCAG 2.1 Level A 2.4.1",
    severity: "serious",
    impact: "Duplicate access keys confuse keyboard users and assistive technology",
    autoFixPotential: "high",
  },
  "aria-allowed-attr": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Invalid ARIA attributes break screen reader functionality",
    autoFixPotential: "high",
  },
  "aria-command-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Buttons and links without accessible names are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "aria-hidden-body": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "critical",
    impact: "Hiding the body element makes the entire page inaccessible to screen readers",
    autoFixPotential: "high",
  },
  "aria-hidden-focus": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Focusable elements hidden from screen readers create confusion for keyboard users",
    autoFixPotential: "medium",
  },
  "aria-input-field-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Input fields without labels are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "aria-meter-name": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "serious",
    impact: "Meters without accessible names cannot be understood by screen reader users",
    autoFixPotential: "medium",
  },
  "aria-progressbar-name": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "serious",
    impact: "Progress bars without labels provide no context to screen reader users",
    autoFixPotential: "medium",
  },
  "aria-required-attr": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Missing required ARIA attributes break screen reader functionality",
    autoFixPotential: "high",
  },
  "aria-required-children": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Invalid ARIA structure confuses screen readers about content relationships",
    autoFixPotential: "medium",
  },
  "aria-required-parent": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "ARIA elements without proper parents break semantic structure for screen readers",
    autoFixPotential: "medium",
  },
  "aria-roles": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Invalid ARIA roles prevent screen readers from understanding element purpose",
    autoFixPotential: "high",
  },
  "aria-toggle-field-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Toggle controls without labels are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "aria-tooltip-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "moderate",
    impact: "Tooltips without accessible names provide no information to screen reader users",
    autoFixPotential: "medium",
  },
  "aria-treeitem-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Tree items without labels cannot be navigated by screen reader users",
    autoFixPotential: "medium",
  },
  "aria-valid-attr-value": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Invalid ARIA attribute values break screen reader functionality",
    autoFixPotential: "high",
  },
  "aria-valid-attr": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Invalid ARIA attributes are ignored by screen readers",
    autoFixPotential: "high",
  },
  "button-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "critical",
    impact: "Buttons without accessible names are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "bypass": {
    wcag: "WCAG 2.1 Level A 2.4.1",
    severity: "serious",
    impact: "Users cannot skip repetitive navigation, forcing them to tab through all links",
    autoFixPotential: "low",
  },
  "color-contrast": {
    wcag: "WCAG 2.1 Level AA 1.4.3",
    severity: "serious",
    impact: "Low contrast text is difficult or impossible to read for users with low vision",
    autoFixPotential: "low",
  },
  "definition-list": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "Improperly structured definition lists confuse screen reader users",
    autoFixPotential: "high",
  },
  "dlitem": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "Definition list items outside proper containers break semantic structure",
    autoFixPotential: "high",
  },
  "document-title": {
    wcag: "WCAG 2.1 Level A 2.4.2",
    severity: "serious",
    impact: "Pages without titles make navigation and bookmarking difficult for all users",
    autoFixPotential: "high",
  },
  "duplicate-id-active": {
    wcag: "WCAG 2.1 Level A 4.1.1",
    severity: "serious",
    impact: "Duplicate IDs on interactive elements cause unpredictable behavior for assistive technology",
    autoFixPotential: "high",
  },
  "duplicate-id-aria": {
    wcag: "WCAG 2.1 Level A 4.1.1",
    severity: "critical",
    impact: "Duplicate IDs break ARIA relationships and screen reader functionality",
    autoFixPotential: "high",
  },
  "form-field-multiple-labels": {
    wcag: "WCAG 2.1 Level A 3.3.2",
    severity: "moderate",
    impact: "Multiple labels on form fields confuse screen reader users",
    autoFixPotential: "medium",
  },
  "frame-title": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Frames without titles make it impossible for screen reader users to understand their purpose",
    autoFixPotential: "high",
  },
  "heading-order": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "Improper heading hierarchy makes page structure confusing for screen reader users",
    autoFixPotential: "low",
  },
  "html-has-lang": {
    wcag: "WCAG 2.1 Level A 3.1.1",
    severity: "serious",
    impact: "Missing language attribute prevents screen readers from using correct pronunciation",
    autoFixPotential: "high",
  },
  "html-lang-valid": {
    wcag: "WCAG 2.1 Level A 3.1.1",
    severity: "serious",
    impact: "Invalid language codes cause screen readers to use incorrect pronunciation",
    autoFixPotential: "high",
  },
  "image-alt": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "critical",
    impact: "Images without alt text are completely inaccessible to screen reader users",
    autoFixPotential: "medium",
  },
  "input-image-alt": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "critical",
    impact: "Image buttons without alt text are unusable for screen reader users",
    autoFixPotential: "high",
  },
  "label": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "critical",
    impact: "Form inputs without labels are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "link-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "critical",
    impact: "Links without accessible names are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "list": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "Improperly structured lists confuse screen reader navigation",
    autoFixPotential: "high",
  },
  "listitem": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "List items outside proper containers break semantic structure",
    autoFixPotential: "high",
  },
  "meta-refresh": {
    wcag: "WCAG 2.1 Level A 2.2.1",
    severity: "moderate",
    impact: "Automatic page refreshes disrupt screen reader users and cause disorientation",
    autoFixPotential: "high",
  },
  "meta-viewport": {
    wcag: "WCAG 2.1 Level AA 1.4.4",
    severity: "critical",
    impact: "Disabled zooming prevents users with low vision from enlarging text",
    autoFixPotential: "high",
  },
  "object-alt": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "serious",
    impact: "Objects without alternative text are inaccessible to screen reader users",
    autoFixPotential: "medium",
  },
  "tabindex": {
    wcag: "WCAG 2.1 Level A 2.4.3",
    severity: "serious",
    impact: "Positive tabindex values create unpredictable keyboard navigation",
    autoFixPotential: "high",
  },
  "td-headers-attr": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Invalid table headers make data tables incomprehensible to screen reader users",
    autoFixPotential: "medium",
  },
  "th-has-data-cells": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "Table headers without associated cells confuse screen reader users",
    autoFixPotential: "medium",
  },
  "valid-lang": {
    wcag: "WCAG 2.1 Level AA 3.1.2",
    severity: "moderate",
    impact: "Invalid language attributes cause screen readers to use incorrect pronunciation",
    autoFixPotential: "high",
  },
  "video-caption": {
    wcag: "WCAG 2.1 Level A 1.2.2",
    severity: "critical",
    impact: "Videos without captions are completely inaccessible to deaf and hard-of-hearing users",
    autoFixPotential: "low",
  },
};

// Fix Bucket Mapping - Groups audits by DOM-level fix strategy
const FIX_BUCKET_MAP: Record<string, string> = {
  // Bucket: Add alt attributes to images
  "image-alt": "Add alt attributes to images",
  "input-image-alt": "Add alt attributes to images",
  "object-alt": "Add alt attributes to images",

  // Bucket: Add labels to form elements
  "label": "Add labels to form elements",
  "aria-input-field-name": "Add labels to form elements",
  "aria-toggle-field-name": "Add labels to form elements",
  "form-field-multiple-labels": "Add labels to form elements",

  // Bucket: Add accessible names to interactive elements
  "button-name": "Add accessible names to interactive elements",
  "link-name": "Add accessible names to interactive elements",
  "aria-command-name": "Add accessible names to interactive elements",
  "aria-meter-name": "Add accessible names to interactive elements",
  "aria-progressbar-name": "Add accessible names to interactive elements",
  "aria-tooltip-name": "Add accessible names to interactive elements",
  "aria-treeitem-name": "Add accessible names to interactive elements",

  // Bucket: Fix ARIA attributes and values
  "aria-allowed-attr": "Fix ARIA attributes and values",
  "aria-valid-attr": "Fix ARIA attributes and values",
  "aria-valid-attr-value": "Fix ARIA attributes and values",
  "aria-required-attr": "Fix ARIA attributes and values",
  "aria-roles": "Fix ARIA attributes and values",

  // Bucket: Fix ARIA structure and relationships
  "aria-required-children": "Fix ARIA structure and relationships",
  "aria-required-parent": "Fix ARIA structure and relationships",
  "aria-hidden-body": "Fix ARIA structure and relationships",
  "aria-hidden-focus": "Fix ARIA structure and relationships",

  // Bucket: Fix document structure and semantics
  "list": "Fix document structure and semantics",
  "listitem": "Fix document structure and semantics",
  "definition-list": "Fix document structure and semantics",
  "dlitem": "Fix document structure and semantics",
  "heading-order": "Fix document structure and semantics",

  // Bucket: Fix table accessibility
  "td-headers-attr": "Fix table accessibility",
  "th-has-data-cells": "Fix table accessibility",

  // Bucket: Add or fix page metadata
  "document-title": "Add or fix page metadata",
  "html-has-lang": "Add or fix page metadata",
  "html-lang-valid": "Add or fix page metadata",
  "valid-lang": "Add or fix page metadata",
  "meta-viewport": "Add or fix page metadata",
  "meta-refresh": "Add or fix page metadata",
  "frame-title": "Add or fix page metadata",

  // Bucket: Fix color contrast
  "color-contrast": "Fix color contrast",

  // Bucket: Fix keyboard navigation
  "bypass": "Fix keyboard navigation",
  "tabindex": "Fix keyboard navigation",
  "accesskeys": "Fix keyboard navigation",

  // Bucket: Fix duplicate IDs
  "duplicate-id-active": "Fix duplicate IDs",
  "duplicate-id-aria": "Fix duplicate IDs",

  // Bucket: Add captions to multimedia
  "video-caption": "Add captions to multimedia",
};



const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "plainweb-audit" }));

app.post("/audit", async (req, res) => {
  try {
    const url = (req.body && req.body.url) || req.query.url;
    if (!url) return res.status(400).json({ error: "missing url" });
    const force = req.query.force === "true" || req.body?.force === true;

    // 1. Hash the URL to create a safe Document ID
    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);

    // 2. Check Cache
    const doc = await docRef.get();
    if (doc.exists && !force) {
      const data = doc.data();
      const cachedAt = data?.cachedAt?.toDate(); // Firestore Timestamp to Date
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      if (cachedAt && cachedAt > oneWeekAgo) {
        // Cache is valid (less than 1 week old)
        return res.json({
          cached: true,
          cachedAt: data?.cachedAt,
          report: data?.report,
        });
      }
    }

    // 3. Run Lighthouse
    // Note: We are NOT using a mock anymore. This requires the environment to support Chrome.
    // In standard Cloud Functions, this might need heavy memory settings (e.g. 2GB+).

    let chrome;
    try {
      chrome = await chromeLauncher.launch({
        chromeFlags: [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
        ],
      });
    } catch (e) {
      console.error("Failed to launch chrome", e);
      return res
        .status(500)
        .json({ error: "Failed to launch browser environment" });
    }

    const options = {
      port: chrome.port,
      output: "json" as const,
      logLevel: "info" as const,
    };
    let runnerResult;
    try {
      // Dynamic import for Lighthouse (ESM)
      const lighthouseImport = await import("lighthouse");
      const lighthouse = lighthouseImport.default; // Access default export

      runnerResult = await lighthouse(String(url), options);
    } catch (e) {
      console.error("Lighthouse failed", e);
      await chrome.kill();
      return res.status(500).json({ error: "Lighthouse audit failed" });
    }

    const lhr = runnerResult?.lhr;
    await chrome.kill();

    if (!lhr) {
      return res.status(500).json({ error: "No lighthouse report generated" });
    }

    // 4. Gemini Analysis
    let geminiAnalysis = "Analysis unavailable.";
    if (process.env.GEMINI_API_KEY) {
      try {
        // Extract key metrics to avoid token limits
        const scores = lhr.categories;
        const metrics = {
          fcp: lhr.audits["first-contentful-paint"]?.displayValue,
          lcp: lhr.audits["largest-contentful-paint"]?.displayValue,
          cls: lhr.audits["cumulative-layout-shift"]?.displayValue,
          tbt: lhr.audits["total-blocking-time"]?.displayValue,
          si: lhr.audits["speed-index"]?.displayValue,
        };

        const prompt = `
            Analyze this partial Lighthouse report for ${url}.
            Categories: ${JSON.stringify(scores, null, 2)}
            Core Web Vitals: ${JSON.stringify(metrics, null, 2)}
            
            Provide a concise, specific analysis of the performance and user experience.
            Identify the biggest bottleneck and suggest 1-2 concrete fixes.
            Keep it under 300 words. Format as Markdown.
            `;

        const result = await model.generateContent(prompt);
        geminiAnalysis = result.response.text();
      } catch (e) {
        console.error("Gemini analysis failed", e);
        geminiAnalysis = `Analysis failed: ${(e as Error).message}`;
      }
    } else {
      console.warn("Skipping Gemini analysis: GEMINI_API_KEY not set");
    }

    // 5. Filter and Store
    const audits = lhr.audits;
    const filteredAudits: Record<string, any> = {};
    const excludedAudits = [
      "screenshot-thumbnails",
      "final-screenshot",
      "errors-in-console",
    ];

    for (const [key, audit] of Object.entries(audits)) {
      if (excludedAudits.includes(key)) continue;
      if ((audit as any).score === 1) continue;

      const a = audit as any;
      if (a.details && a.details.items) {
        a.details.items = simplifyItems(a.details.items);
      }
      filteredAudits[key] = a;
    }

    // Replace audits in lhr
    lhr.audits = filteredAudits;

    // Further cleanup
    delete (lhr as any).i18n;
    delete (lhr as any).categoryGroups;
    delete (lhr as any).entities;
    delete (lhr as any).timing;

    if ((lhr as any).fullPageScreenshot) {
      delete (lhr as any).fullPageScreenshot;
    }

    // Prune empty fields recursively
    const prunedLhr = pruneEmpty(lhr);

    // Remove `performance` category from categories if present
    if (prunedLhr && (prunedLhr as any).categories) {
      delete (prunedLhr as any).categories.performance;
    }

    // Recursively remove any `description` fields from the report
    function removeDescriptions(obj: any) {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (const item of obj) removeDescriptions(item);
        return;
      }
      for (const key of Object.keys(obj)) {
        if (key === "description") {
          delete obj[key];
          continue;
        }
        const val = obj[key];
        if (typeof val === "object" && val !== null) removeDescriptions(val);
      }
    }

    removeDescriptions(prunedLhr);

    // Extract and enrich failed accessibility audits
    const failedAccessibilityAudits = extractFailedAccessibilityAudits(prunedLhr);
    const accessibilityIssues = enrichAccessibilityAudits(failedAccessibilityAudits);
    const fixBuckets = groupIssuesIntoFixBuckets(failedAccessibilityAudits);
    const accessibilityAnalysis = generateAccessibilityAnalysisPrompt(fixBuckets.buckets);

    // Generate friendly summary for website owners using Gemini
    let ownerSummary = "Your website is being analyzed for accessibility.";
    if (process.env.GEMINI_API_KEY && fixBuckets.buckets.length > 0) {
      try {
        const bucketSummary = fixBuckets.buckets
          .slice(0, 3)
          .map(b => `${b.bucketName}: ${b.totalFailures} issues`)
          .join(", ");

        const prompt = `You are explaining website accessibility issues to a non-technical website owner.

Issues found: ${bucketSummary}

Write a friendly, reassuring explanation in simple language. Rules:
- No WCAG references or technical terms
- No scores or numbers
- Max 120 words
- Reassuring and helpful tone
- Focus on why it matters and that it's fixable
- Plain text only, no formatting

Example tone: "Your website has a few accessibility issues that might make it harder for some visitors to use..."`;

        const result = await model.generateContent(prompt);
        ownerSummary = result.response.text().trim();
      } catch (e) {
        console.error("Failed to generate owner summary", e);
        ownerSummary = "We found some accessibility issues on your website that could make it harder for some visitors to use. The good news is these are common and fixable! Making your site more accessible helps everyone, including people using screen readers, keyboards, or mobile devices.";
      }
    } else if (fixBuckets.buckets.length === 0) {
      ownerSummary = "Great news! Your website passed our accessibility checks. Keep up the good work making your site welcoming for all visitors!";
    }

    const reportToStore = {
      lhr: JSON.parse(JSON.stringify(prunedLhr)), // Ensure plain object
      geminiAnalysis,
      accessibilityIssues,
      fixBuckets,
      accessibilityAnalysis,
      ownerSummary,
    };

    await docRef.set({
      report: reportToStore,
      url: String(url),
      cachedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      cached: false,
      report: reportToStore,
    });
  } catch (err: any) {
    console.error(err);
    require("fs").appendFileSync(
      "error.log",
      `${new Date().toISOString()} - ${err.message}\n${err.stack}\n\n`
    );
    return res
      .status(500)
      .json({ error: "internal error", details: err.message });
  }
});

// GET /audit/raw - Returns raw Lighthouse JSON (before filtering)
app.get("/audit/raw", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No audit found for this URL. Run POST /audit first." });
    }

    // Note: We don't store raw LHR separately, only filtered
    return res.json({ message: "Raw Lighthouse data is not stored. Only filtered data is available via /audit/filtered" });
  } catch (err: any) {
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});

// GET /audit/filtered - Returns filtered Lighthouse JSON
app.get("/audit/filtered", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No audit found for this URL. Run POST /audit first." });
    }

    const data = doc.data();
    return res.json({ lhr: data?.report?.lhr || null });
  } catch (err: any) {
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});

// GET /audit/issues - Returns accessibility issues (WCAG-enriched)
app.get("/audit/issues", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No audit found for this URL. Run POST /audit first." });
    }

    const data = doc.data();
    return res.json(data?.report?.accessibilityIssues || { issues: [] });
  } catch (err: any) {
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});

// GET /audit/buckets - Returns fix buckets
app.get("/audit/buckets", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No audit found for this URL. Run POST /audit first." });
    }

    const data = doc.data();
    return res.json(data?.report?.fixBuckets || { buckets: [] });
  } catch (err: any) {
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});

// GET /audit/analysis - Returns expert analysis prompt
app.get("/audit/analysis", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No audit found for this URL. Run POST /audit first." });
    }

    const data = doc.data();
    return res.json({ 
      analysis: data?.report?.accessibilityAnalysis || "No analysis available",
      geminiAnalysis: data?.report?.geminiAnalysis || "No Gemini analysis available"
    });
  } catch (err: any) {
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});

// GET /audit/summary - Returns friendly owner summary
app.get("/audit/summary", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const docId = crypto.createHash("sha256").update(String(url)).digest("hex");
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No audit found for this URL. Run POST /audit first." });
    }

    const data = doc.data();
    return res.json({ summary: data?.report?.ownerSummary || "No summary available" });
  } catch (err: any) {
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});


// Helper to simplify audit details
function simplifyItems(items: any[], limit = 5) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => ({
    node: item.node?.nodeLabel || "unknown",
    selector: item.node?.selector || null,
    explanation: item.explanation || item.failureReason || null,
  }));
}

// Helper to extract failed accessibility audits
function extractFailedAccessibilityAudits(lhr: any) {
  const accessibilityCategory = lhr.categories?.accessibility;
  if (!accessibilityCategory || !accessibilityCategory.auditRefs) {
    return [];
  }

  const failedAudits: Array<{
    auditId: string;
    failCount: number;
    title: string;
  }> = [];

  for (const auditRef of accessibilityCategory.auditRefs) {
    const auditId = auditRef.id;
    const audit = lhr.audits?.[auditId];

    if (!audit) continue;

    // Ignore audits with score = 1 (passed)
    if (audit.score === 1) continue;

    // Ignore audits with score = null
    if (audit.score === null) continue;

    // Ignore audits with scoreDisplayMode = "notApplicable"
    if (audit.scoreDisplayMode === "notApplicable") continue;

    // Ignore manual audits
    if (audit.scoreDisplayMode === "manual") continue;

    // Ignore informative audits
    if (audit.scoreDisplayMode === "informative") continue;

    // Count failed elements
    let failCount = 0;
    if (audit.details && audit.details.items) {
      failCount = Array.isArray(audit.details.items)
        ? audit.details.items.length
        : 0;
    }

    failedAudits.push({
      auditId,
      failCount,
      title: audit.title || auditId,
    });
  }

  return failedAudits;
}

// Helper to enrich failed accessibility audits with WCAG mapping
function enrichAccessibilityAudits(
  failedAudits: Array<{ auditId: string; failCount: number; title: string }>
) {
  interface EnrichedIssue {
    rule: string;
    wcag: string;
    severity: string;
    failedElements: number;
    impact: string;
    autoFixPotential: string;
  }

  const issues: EnrichedIssue[] = [];

  for (const audit of failedAudits) {
    const ruleData = ACCESSIBILITY_RULE_MAP[audit.auditId];

    if (ruleData) {
      // Mapped audit
      issues.push({
        rule: audit.title,
        wcag: ruleData.wcag,
        severity: ruleData.severity,
        failedElements: audit.failCount,
        impact: ruleData.impact,
        autoFixPotential: ruleData.autoFixPotential,
      });
    } else {
      // Unmapped audit - use fallback values
      issues.push({
        rule: audit.title,
        wcag: "Not mapped",
        severity: "moderate",
        failedElements: audit.failCount,
        impact: "This accessibility issue may affect some users",
        autoFixPotential: "medium",
      });
    }
  }

  return { issues };
}

// Helper to group accessibility issues into fix buckets
function groupIssuesIntoFixBuckets(
  failedAudits: Array<{ auditId: string; failCount: number; title: string }>
) {
  interface Bucket {
    bucketName: string;
    relatedRules: string[];
    totalFailures: number;
    highestSeverity: string;
    autoFixable: string;
  }

  const bucketMap = new Map<string, {
    rules: string[];
    failures: number;
    severities: string[];
    autoFixPotentials: string[];
  }>();

  // Severity ranking for comparison
  const severityRank: Record<string, number> = {
    critical: 4,
    serious: 3,
    moderate: 2,
    minor: 1,
  };

  // Group audits into buckets
  for (const audit of failedAudits) {
    const bucketName = FIX_BUCKET_MAP[audit.auditId] || "Other accessibility issues";
    const ruleData = ACCESSIBILITY_RULE_MAP[audit.auditId];

    if (!bucketMap.has(bucketName)) {
      bucketMap.set(bucketName, {
        rules: [],
        failures: 0,
        severities: [],
        autoFixPotentials: [],
      });
    }

    const bucket = bucketMap.get(bucketName)!;
    bucket.rules.push(audit.title);
    bucket.failures += audit.failCount;

    if (ruleData) {
      bucket.severities.push(ruleData.severity);
      bucket.autoFixPotentials.push(ruleData.autoFixPotential);
    } else {
      bucket.severities.push("moderate");
      bucket.autoFixPotentials.push("medium");
    }
  }

  // Convert to output format
  const buckets: Bucket[] = [];

  for (const [bucketName, data] of bucketMap.entries()) {
    // Find highest severity
    let highestSeverity = "minor";
    let highestRank = 0;
    for (const severity of data.severities) {
      const rank = severityRank[severity] || 0;
      if (rank > highestRank) {
        highestRank = rank;
        highestSeverity = severity;
      }
    }

    // Determine auto-fixable status
    let autoFixable = "no";
    const highCount = data.autoFixPotentials.filter(p => p === "high").length;
    const mediumCount = data.autoFixPotentials.filter(p => p === "medium").length;
    const total = data.autoFixPotentials.length;

    if (highCount === total) {
      autoFixable = "yes";
    } else if (highCount > 0 || mediumCount > 0) {
      autoFixable = "partial";
    }

    buckets.push({
      bucketName,
      relatedRules: data.rules,
      totalFailures: data.failures,
      highestSeverity,
      autoFixable,
    });
  }

  // Sort by severity (highest first), then by total failures
  buckets.sort((a, b) => {
    const severityDiff = severityRank[b.highestSeverity] - severityRank[a.highestSeverity];
    if (severityDiff !== 0) return severityDiff;
    return b.totalFailures - a.totalFailures;
  });

  return { buckets };
}

// Helper to generate human-readable accessibility analysis prompt
function generateAccessibilityAnalysisPrompt(
  buckets: Array<{
    bucketName: string;
    relatedRules: string[];
    totalFailures: number;
    highestSeverity: string;
    autoFixable: string;
  }>
) {
  if (buckets.length === 0) {
    return "Great news! No significant accessibility issues were detected on this page.";
  }

  // Calculate overall risk
  const criticalCount = buckets.filter(b => b.highestSeverity === "critical").length;
  const seriousCount = buckets.filter(b => b.highestSeverity === "serious").length;
  const totalIssues = buckets.reduce((sum, b) => sum + b.totalFailures, 0);

  let riskLevel = "low";
  let riskDescription = "minor accessibility barriers";
  
  if (criticalCount > 0) {
    riskLevel = "high";
    riskDescription = "critical accessibility barriers that block users from accessing content";
  } else if (seriousCount >= 3) {
    riskLevel = "high";
    riskDescription = "multiple serious accessibility issues";
  } else if (seriousCount > 0) {
    riskLevel = "moderate";
    riskDescription = "significant accessibility gaps";
  }

  // Get top 3 priorities
  const top3 = buckets.slice(0, 3);

  // Build prompt
  let prompt = `## Accessibility Assessment\n\n`;
  prompt += `**Overall Risk**: ${riskLevel.toUpperCase()} — This page has ${riskDescription}. `;
  prompt += `Found ${totalIssues} accessibility ${totalIssues === 1 ? 'issue' : 'issues'} across ${buckets.length} ${buckets.length === 1 ? 'category' : 'categories'}.\n\n`;

  prompt += `### Top 3 Fix Priorities\n\n`;

  top3.forEach((bucket, index) => {
    prompt += `**${index + 1}. ${bucket.bucketName}**\n`;
    prompt += `- ${bucket.totalFailures} ${bucket.totalFailures === 1 ? 'element' : 'elements'} affected\n`;
    
    // Add user impact based on bucket name
    const impact = getUserImpactForBucket(bucket.bucketName);
    prompt += `- Impact: ${impact}\n`;
    
    // Add automation note
    if (bucket.autoFixable === "yes") {
      prompt += `- Can be automated: Yes — A browser extension could fix these automatically\n`;
    } else if (bucket.autoFixable === "partial") {
      prompt += `- Can be automated: Partially — Some fixes need human judgment (e.g., writing meaningful alt text)\n`;
    } else {
      prompt += `- Can be automated: No — Requires manual design or content decisions\n`;
    }
    prompt += `\n`;
  });

  prompt += `### What Matters to Real Users\n\n`;
  
  if (criticalCount > 0) {
    prompt += `These critical issues prevent screen reader users, keyboard-only users, or people with visual impairments from accessing your content at all. `;
  }
  
  prompt += `Every accessibility barrier you remove helps millions of users with disabilities, `;
  prompt += `plus anyone using assistive technology, mobile devices, or browsing in challenging conditions.\n\n`;

  // Automation summary
  const autoFixableCount = buckets.filter(b => b.autoFixable === "yes").length;
  const partialCount = buckets.filter(b => b.autoFixable === "partial").length;
  
  if (autoFixableCount > 0 || partialCount > 0) {
    prompt += `### Automation Potential\n\n`;
    if (autoFixableCount > 0) {
      prompt += `${autoFixableCount} ${autoFixableCount === 1 ? 'category' : 'categories'} can be fully automated by a browser extension. `;
    }
    if (partialCount > 0) {
      prompt += `${partialCount} ${partialCount === 1 ? 'category requires' : 'categories require'} human input for quality (like writing descriptive alt text or choosing better color contrasts).`;
    }
  }

  return prompt.trim();
}

// Helper to get user impact description for bucket
function getUserImpactForBucket(bucketName: string): string {
  const impactMap: Record<string, string> = {
    "Add alt attributes to images": "Screen reader users cannot understand images or complete image-based actions",
    "Add labels to form elements": "Screen reader users cannot identify or fill out form fields",
    "Add accessible names to interactive elements": "Screen reader users cannot identify buttons, links, or controls",
    "Fix ARIA attributes and values": "Assistive technology receives incorrect information about page elements",
    "Fix ARIA structure and relationships": "Screen readers announce confusing or broken page structure",
    "Fix document structure and semantics": "Screen reader navigation becomes difficult or impossible",
    "Fix table accessibility": "Screen reader users cannot understand data table relationships",
    "Add or fix page metadata": "Users cannot identify pages, understand language, or zoom text",
    "Fix color contrast": "Users with low vision cannot read text",
    "Fix keyboard navigation": "Keyboard-only users get trapped or cannot navigate efficiently",
    "Fix duplicate IDs": "Assistive technology behaves unpredictably",
    "Add captions to multimedia": "Deaf and hard-of-hearing users cannot access video content",
  };

  return impactMap[bucketName] || "Users with disabilities may struggle to access this content";
}



// Recursive function to prune empty fields
function pruneEmpty(obj: any): any {
  if (obj === null || obj === undefined || obj === "") return undefined;
  if (Array.isArray(obj)) {
    const result = obj.map(pruneEmpty).filter((v) => v !== undefined);
    return result.length > 0 ? result : undefined;
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const key in obj) {
      const val = pruneEmpty(obj[key]);
      if (val !== undefined) {
        result[key] = val;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return obj;
}

export const api = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "2GB", // Chrome needs RAM
  })
  .https.onRequest(app);
