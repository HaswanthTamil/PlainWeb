import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import express, { Request, Response } from "express";
import * as chromeLauncher from "chrome-launcher";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as crypto from "crypto";
import cors from "cors";

admin.initializeApp();

console.log(`Firestore Emulator Host: ${process.env.FIRESTORE_EMULATOR_HOST}`);
const db = getFirestore();
db.settings({
  ignoreUndefinedProperties: true,
  ...(process.env.FIRESTORE_EMULATOR_HOST ? {
    host: process.env.FIRESTORE_EMULATOR_HOST,
    ssl: false,
  } : {}),
});
console.log(`Firestore initialized. Settings:`, db.settings);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Interfaces
interface AccessibilityRule {
  wcag: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  impact: string;
  autoFixPotential: "high" | "medium" | "low";
}

interface EnrichedIssue {
  rule: string;
  wcag: string;
  severity: string;
  failedElements: number;
  impact: string;
  autoFixPotential: string;
}

interface Bucket {
  bucketName: string;
  relatedRules: string[];
  totalFailures: number;
  highestSeverity: string;
  autoFixable: "yes" | "no" | "partial";
}

// Constants
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
    impact: "Toggle fields without accessible names are unusable for screen reader users",
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
    impact: "Unsupported ARIA attributes can cause assistive technology to malfunction",
    autoFixPotential: "high",
  },
  "button-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Buttons without accessible names are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "color-contrast": {
    wcag: "WCAG 2.1 Level AA 1.4.3",
    severity: "serious",
    impact: "Low color contrast makes content unreadable for users with low vision",
    autoFixPotential: "medium",
  },
  "document-title": {
    wcag: "WCAG 2.1 Level A 2.4.2",
    severity: "serious",
    impact: "Missing or generic page titles make site navigation difficult for screen reader users",
    autoFixPotential: "medium",
  },
  "duplicate-id-active": {
    wcag: "WCAG 2.1 Level A 4.1.1",
    severity: "serious",
    impact: "Duplicate IDs on active elements break assistive technology functionality",
    autoFixPotential: "medium",
  },
  "duplicate-id-aria": {
    wcag: "WCAG 2.1 Level A 4.1.1",
    severity: "serious",
    impact: "Duplicate IDs in ARIA context confuse screen readers and assistive technology",
    autoFixPotential: "medium",
  },
  "form-field-multiple-labels": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "moderate",
    impact: "Multiple labels on a single form field can confuse screen reader users",
    autoFixPotential: "medium",
  },
  "frame-title": {
    wcag: "WCAG 2.1 Level A 2.4.1",
    severity: "serious",
    impact: "Frames without titles are difficult for screen reader users to identify",
    autoFixPotential: "medium",
  },
  "html-has-lang": {
    wcag: "WCAG 2.1 Level A 3.1.1",
    severity: "serious",
    impact: "Missing language attribute prevents screen readers from using the correct pronunciation",
    autoFixPotential: "high",
  },
  "html-lang-valid": {
    wcag: "WCAG 2.1 Level A 3.1.1",
    severity: "serious",
    impact: "Invalid language codes prevent screen readers from performing correctly",
    autoFixPotential: "high",
  },
  "image-alt": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "serious",
    impact: "Images without alternative text provide no context for screen reader users",
    autoFixPotential: "medium",
  },
  "input-image-alt": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "serious",
    impact: "Image buttons without alt text are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "label": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Form fields without labels are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "link-name": {
    wcag: "WCAG 2.1 Level A 4.1.2",
    severity: "serious",
    impact: "Links without accessible names are unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "list": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Incorrect list structure confuses screen reader users about content relationships",
    autoFixPotential: "medium",
  },
  "listitem": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Incorrect list item placement confuses screen reader users",
    autoFixPotential: "medium",
  },
  "meta-viewport": {
    wcag: "WCAG 2.1 Level AA 1.4.4",
    severity: "serious",
    impact: "Disabling zoom prevents users with low vision from resizing and reading content",
    autoFixPotential: "high",
  },
  "object-alt": {
    wcag: "WCAG 2.1 Level A 1.1.1",
    severity: "serious",
    impact: "Objects without alternative text provide no context for screen reader users",
    autoFixPotential: "medium",
  },
  "tabindex": {
    wcag: "WCAG 2.1 Level A 2.4.3",
    severity: "serious",
    impact: "Positive tabindex values break natural focus order for keyboard users",
    autoFixPotential: "high",
  },
  "td-headers-attr": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Incorrect table header associations make complex data tables unusable for screen reader users",
    autoFixPotential: "medium",
  },
  "th-has-data-cells": {
    wcag: "WCAG 2.1 Level A 1.3.1",
    severity: "serious",
    impact: "Incorrect table structure confuses screen reader users about data relationships",
    autoFixPotential: "medium",
  },
  "valid-lang": {
    wcag: "WCAG 2.1 Level A 3.1.2",
    severity: "serious",
    impact: "Invalid language codes on page elements break screen reader pronunciation",
    autoFixPotential: "high",
  },
  "video-caption": {
    wcag: "WCAG 2.1 Level A 1.2.2",
    severity: "serious",
    impact: "Videos without captions are inaccessible to users who are deaf or hard of hearing",
    autoFixPotential: "low",
  }
};

const FIX_BUCKET_MAP: Record<string, string> = {
  "image-alt": "Add alt attributes to images",
  "input-image-alt": "Add alt attributes to images",
  "object-alt": "Add alt attributes to images",
  "label": "Add labels to form elements",
  "aria-input-field-name": "Add labels to form elements",
  "aria-toggle-field-name": "Add labels to form elements",
  "button-name": "Add accessible names to interactive elements",
  "link-name": "Add accessible names to interactive elements",
  "aria-command-name": "Add accessible names to interactive elements",
  "aria-meter-name": "Add accessible names to interactive elements",
  "aria-progressbar-name": "Add accessible names to interactive elements",
  "aria-allowed-attr": "Fix ARIA attributes and values",
  "aria-required-attr": "Fix ARIA attributes and values",
  "aria-valid-attr": "Fix ARIA attributes and values",
  "aria-valid-attr-value": "Fix ARIA attributes and values",
  "aria-roles": "Fix ARIA attributes and values",
  "aria-required-children": "Fix ARIA structure and relationships",
  "aria-required-parent": "Fix ARIA structure and relationships",
  "aria-hidden-body": "Fix ARIA structure and relationships",
  "aria-hidden-focus": "Fix ARIA structure and relationships",
  "list": "Fix document structure and semantics",
  "listitem": "Fix document structure and semantics",
  "html-has-lang": "Add or fix page metadata",
  "html-lang-valid": "Add or fix page metadata",
  "valid-lang": "Add or fix page metadata",
  "document-title": "Add or fix page metadata",
  "meta-viewport": "Add or fix page metadata",
  "frame-title": "Add or fix page metadata",
  "color-contrast": "Fix color contrast",
  "tabindex": "Fix keyboard navigation",
  "accesskeys": "Fix keyboard navigation",
  "duplicate-id-active": "Fix duplicate IDs",
  "duplicate-id-aria": "Fix duplicate IDs",
  "td-headers-attr": "Fix table accessibility",
  "th-has-data-cells": "Fix table accessibility",
  "video-caption": "Add captions to multimedia"
};

// Helper Functions
async function runLighthouse(url: string) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
  
  // Use dynamic import for Lighthouse
  const { default: lighthouse } = await import("lighthouse");
  
  const options = {
    logLevel: "info",
    output: "json",
    onlyCategories: ["accessibility"],
    port: chrome.port,
  };

  const runnerResult = await (lighthouse as any)(url, options);
  await chrome.kill();

  if (!runnerResult || !runnerResult.lhr) {
    throw new Error("Lighthouse failed to produce a report");
  }

  return runnerResult.lhr;
}

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

function simplifyItems(items: any[], limit = 5) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => ({
    node: item.node?.nodeLabel || "unknown",
    selector: item.node?.selector || null,
    explanation: item.explanation || item.failureReason || null,
  }));
}

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
    if (audit.score === 1 || audit.score === null) continue;
    if (["notApplicable", "manual", "informative"].includes(audit.scoreDisplayMode)) continue;

    let failCount = 0;
    if (audit.details && audit.details.items) {
      failCount = Array.isArray(audit.details.items) ? audit.details.items.length : 0;
      // Simplify items while we're at it
      audit.details.items = simplifyItems(audit.details.items);
    }

    failedAudits.push({
      auditId,
      failCount,
      title: audit.title || auditId,
    });
  }

  return failedAudits;
}

function categorizeAudits(lhr: any) {
  const accessibilityCategory = lhr.categories?.accessibility;
  if (!accessibilityCategory || !accessibilityCategory.auditRefs) {
    return { failedIssues: [], passedChecks: [], manualChecks: [] };
  }

  const failedIssues: any[] = [];
  const passedChecks: any[] = [];
  const manualChecks: any[] = [];

  for (const auditRef of accessibilityCategory.auditRefs) {
    const auditId = auditRef.id;
    const audit = lhr.audits?.[auditId];

    if (!audit) continue;

    const simplifiedAudit = {
      id: auditId,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      scoreDisplayMode: audit.scoreDisplayMode,
      details: audit.details,
    };

    if (simplifiedAudit.details && simplifiedAudit.details.items) {
      simplifiedAudit.details.items = simplifyItems(simplifiedAudit.details.items);
    }

    if (audit.scoreDisplayMode === "manual") {
      manualChecks.push(simplifiedAudit);
    } else if (audit.score === 1) {
      passedChecks.push(simplifiedAudit);
    } else if (
      audit.score !== null &&
      audit.score < 1 &&
      audit.scoreDisplayMode !== "notApplicable" &&
      audit.scoreDisplayMode !== "informative"
    ) {
      failedIssues.push(simplifiedAudit);
    }
  }

  return { failedIssues, passedChecks, manualChecks };
}

function flattenAuditsToText(categorized: { failedIssues: any[]; manualChecks: any[] }) {
  let text = "ACCESSIBILITY AUDIT REPORT\n========================\n\n";

  if (categorized.failedIssues.length > 0) {
    text += "FAILED ISSUES:\n";
    categorized.failedIssues.forEach((issue, idx) => {
      text += `${idx + 1}. [${issue.id}] ${issue.title}\n`;
      text += `   Description: ${issue.description}\n`;
      if (issue.details?.items?.length > 0) {
        text += `   Affected Elements:\n`;
        issue.details.items.forEach((item: any) => {
          text += `     - Node: ${item.node}\n`;
          if (item.selector) text += `       Selector: ${item.selector}\n`;
          if (item.explanation) text += `       Note: ${item.explanation}\n`;
        });
      }
      text += "\n";
    });
  }

  if (categorized.manualChecks.length > 0) {
    text += "MANUAL CHECKS REQUIRED:\n";
    categorized.manualChecks.forEach((check, idx) => {
      text += `${idx + 1}. [${check.id}] ${check.title}\n`;
      text += `   Description: ${check.description}\n\n`;
    });
  }

  return text;
}

async function generateExpertFixGuide(flattenedText: string) {
  if (!process.env.GEMINI_API_KEY) return null;

  const prompt = `You are a Senior Accessibility Engineer. I will provide you with a flattened Lighthouse Accessibility report.
Your task is to provide a "Developer's Expert Fix Guide".

Rules:
1. Group issues by common themes (e.g., Semantic HTML, Colors, ARIA).
2. For each group, provides specific, technical instructions on HOW to fix the issues.
3. Provide code snippets (HTML/CSS) where appropriate.
4. Keep it highly actionable and professional.
5. Focus ONLY on the failed issues and manual checks provided.
6. Use Markdown formatting.

AUDIT DATA:
${flattenedText}

GENERATE THE GUIDE:`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.error("Gemini Guide Generation failed", e);
    return "Expert guide generation temporarily unavailable.";
  }
}

function enrichAccessibilityAudits(
  failedAudits: Array<{ auditId: string; failCount: number; title: string }>
) {
  const issues: EnrichedIssue[] = [];

  for (const audit of failedAudits) {
    const ruleData = ACCESSIBILITY_RULE_MAP[audit.auditId];

    if (ruleData) {
      issues.push({
        rule: audit.title,
        wcag: ruleData.wcag,
        severity: ruleData.severity,
        failedElements: audit.failCount,
        impact: ruleData.impact,
        autoFixPotential: ruleData.autoFixPotential,
      });
    } else {
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

function groupIssuesIntoFixBuckets(
  failedAudits: Array<{ auditId: string; failCount: number; title: string }>
) {
  const bucketMap = new Map<string, {
    rules: string[];
    failures: number;
    severities: string[];
    autoFixPotentials: string[];
  }>();

  const severityRank: Record<string, number> = {
    critical: 4, serious: 3, moderate: 2, minor: 1,
  };

  for (const audit of failedAudits) {
    const bucketName = FIX_BUCKET_MAP[audit.auditId] || "Other accessibility issues";
    const ruleData = ACCESSIBILITY_RULE_MAP[audit.auditId];

    if (!bucketMap.has(bucketName)) {
      bucketMap.set(bucketName, {
        rules: [], failures: 0, severities: [], autoFixPotentials: [],
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

  const buckets: Bucket[] = [];

  for (const [bucketName, data] of bucketMap.entries()) {
    let highestSeverity = "minor";
    let highestRank = 0;
    for (const severity of data.severities) {
      const rank = severityRank[severity] || 0;
      if (rank > highestRank) {
        highestRank = rank;
        highestSeverity = severity as any;
      }
    }

    let autoFixable: "yes" | "no" | "partial" = "no";
    const highCount = data.autoFixPotentials.filter(p => p === "high").length;
    const mediumCount = data.autoFixPotentials.filter(p => p === "medium").length;
    const total = data.autoFixPotentials.length;

    if (highCount === total) autoFixable = "yes";
    else if (highCount > 0 || mediumCount > 0) autoFixable = "partial";

    buckets.push({
      bucketName,
      relatedRules: data.rules,
      totalFailures: data.failures,
      highestSeverity,
      autoFixable,
    });
  }

  buckets.sort((a, b) => {
    const severityDiff = severityRank[b.highestSeverity] - severityRank[a.highestSeverity];
    if (severityDiff !== 0) return severityDiff;
    return b.totalFailures - a.totalFailures;
  });

  return { buckets };
}

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

function generateAccessibilityAnalysisPrompt(buckets: Bucket[]) {
  if (buckets.length === 0) {
    return "Great news! No significant accessibility issues were detected on this page.";
  }

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

  const top3 = buckets.slice(0, 3);
  let prompt = `## Accessibility Assessment\n\n`;
  prompt += `**Overall Risk**: ${riskLevel.toUpperCase()} — This page has ${riskDescription}. `;
  prompt += `Found ${totalIssues} accessibility ${totalIssues === 1 ? 'issue' : 'issues'} across ${buckets.length} ${buckets.length === 1 ? 'category' : 'categories'}.\n\n`;
  prompt += `### Top 3 Fix Priorities\n\n`;

  top3.forEach((bucket, index) => {
    prompt += `**${index + 1}. ${bucket.bucketName}**\n`;
    prompt += `- ${bucket.totalFailures} ${bucket.totalFailures === 1 ? 'element' : 'elements'} affected\n`;
    prompt += `- Impact: ${getUserImpactForBucket(bucket.bucketName)}\n`;
    
    if (bucket.autoFixable === "yes") {
      prompt += `- Can be automated: Yes — A browser extension could fix these automatically\n`;
    } else if (bucket.autoFixable === "partial") {
      prompt += `- Can be automated: Partially — Some fixes need human judgment\n`;
    } else {
      prompt += `- Can be automated: No — Requires manual design or content decisions\n`;
    }
    prompt += `\n`;
  });

  prompt += `### What Matters to Real Users\n\n`;
  if (criticalCount > 0) {
    prompt += `These critical issues prevent certain users from accessing your content at all. `;
  }
  prompt += `Every accessibility barrier you remove helps millions of users with disabilities.\n\n`;

  return prompt.trim();
}

// Express App
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "plainweb-audit-service" }));


function normalizeUrl(input: string) {
  try {
    const u = new URL(input);
    u.hash = "";
    // Remove trailing slash and force lowercase for consistency
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch (e) {
    throw new Error("Invalid URL");
  }
}

function getDocId(url: string) {
  const normalized = normalizeUrl(url);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function deepRemoveKeys(obj: any, keysToRemove: string[]) {
  if (!obj || typeof obj !== "object") return;

  for (const key of Object.keys(obj)) {
    if (keysToRemove.includes(key)) {
      delete obj[key];
    } else {
      deepRemoveKeys(obj[key], keysToRemove);
    }
  }
}

app.post("/audit/raw", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "missing url parameter" });

    const normalized = normalizeUrl(url);
    const docId = getDocId(normalized);
    const docRef = db.collection("audits").doc(docId);

    // Run Lighthouse
    console.log(`Running Lighthouse for ${url}...`);
    const lhr = await runLighthouse(url);

    // Initial Processing
    delete (lhr as any).i18n;
    delete (lhr as any).categoryGroups;
    delete (lhr as any).entities;
    delete (lhr as any).timing;
    if ((lhr as any).fullPageScreenshot) delete (lhr as any).fullPageScreenshot;

    // Remove performance if only accessibility was requested (though we forced it in runLighthouse)
    if (lhr.categories && (lhr.categories as any).performance) {
      delete (lhr.categories as any).performance;
    }

    const failedAccessibilityAudits = extractFailedAccessibilityAudits(lhr);
    const accessibilityIssues = enrichAccessibilityAudits(failedAccessibilityAudits);
    const fixBuckets = groupIssuesIntoFixBuckets(failedAccessibilityAudits);
    const accessibilityAnalysis = generateAccessibilityAnalysisPrompt(fixBuckets.buckets);
    const categorizedAudits = categorizeAudits(lhr);

    // Flatten audits and generate expert guide
    const flattenedAudits = flattenAuditsToText(categorizedAudits);
    const expertFixGuide = await generateExpertFixGuide(flattenedAudits);

    // Cleanup LHR further
    removeDescriptions(lhr);
    const prunedLhr = pruneEmpty(lhr);

    // Generate Owner Summary with Gemini
    let ownerSummary = "Your website is being analyzed for accessibility.";
    if (process.env.GEMINI_API_KEY && fixBuckets.buckets.length > 0) {
      try {
        const bucketSummary = fixBuckets.buckets
          .slice(0, 3)
          .map(b => `${b.bucketName}: ${b.totalFailures} issues`)
          .join(", ");

        const prompt = `You are explaining website accessibility issues to a non-technical website owner.
        Issues found: ${bucketSummary}
        Write a friendly, reassuring explanation in simple language. Max 120 words. Focus on why it matters and that it's fixable. No technical terms or WCAG references.`;

        const result = await model.generateContent(prompt);
        ownerSummary = result.response.text().trim();
      } catch (e) {
        console.error("Gemini failed", e);
        ownerSummary = "We found some accessibility issues that could make it harder for some visitors to use. These are common and fixable!";
      }
    } else if (fixBuckets.buckets.length === 0) {
      ownerSummary = "Great news! Your website passed our accessibility checks.";
    }

    const reportToStore = {
      lhr: JSON.parse(JSON.stringify(prunedLhr)),
      accessibilityIssues,
      fixBuckets,
      accessibilityAnalysis,
      ownerSummary,
      expertFixGuide,
      categorizedAudits: pruneEmpty(categorizedAudits),
    };

    console.log(`Saving report to Firestore with docId: ${docId}`);
    try {
      await docRef.set({
        report: reportToStore,
        url: normalized,
        cachedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Successfully saved report for ${url}`);
    } catch (dbErr: any) {
      console.error(`Error saving to Firestore: ${dbErr.message}`);
      // We still return the JSON since the audit was successful, 
      // but the user should know about the DB failure in logs.
    }

    return res.json(reportToStore);
  } catch (err: any) {
    console.error("Audit error:", err);
    return res.status(500).json({ error: "internal error", details: err.message });
  }
});


// GET endpoints for fetching parts of the report

app.post("/audit/filtered", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "missing url" });
    }

    const docId = getDocId(url);
    const doc = await db.collection("audits").doc(docId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "not found" });
    }

    const lhr = doc.data()?.report?.lhr;
    if (!lhr || !lhr.audits) {
      return res.json({ audits: {} });
    }

    const filteredAudits: Record<string, any> = {};

    for (const [auditKey, audit] of Object.entries(lhr.audits)) {
      if ((audit as any)?.score === 0) {
        // Clone to avoid mutating stored LHR
        const auditCopy = JSON.parse(JSON.stringify(audit));

        // Remove noisy / heavy fields everywhere
        deepRemoveKeys(auditCopy, ["items", "debugData"]);

        filteredAudits[auditKey] = auditCopy;
      }
    }

    return res.json({
      audits: filteredAudits,
    });
  } catch (err: any) {
    console.error("audit/filtered error:", err);
    return res.status(500).json({
      error: "internal error",
      details: err?.message,
    });
  }
});

app.post("/audit/analysis", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "missing url" });
    const docId = getDocId(url);
    const doc = await db.collection("audits").doc(docId).get();
    if (!doc.exists) return res.status(404).json({ error: "not found" });
    return res.json({ analysis: doc.data()?.report?.accessibilityAnalysis || "" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/audit/summary", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "missing url" });
    const docId = getDocId(url);
    const doc = await db.collection("audits").doc(docId).get();
    if (!doc.exists) return res.status(404).json({ error: "not found" });
    return res.json({ summary: doc.data()?.report?.ownerSummary || "" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const api = onRequest({
  timeoutSeconds: 300,
  memory: "2GiB",
}, app);
