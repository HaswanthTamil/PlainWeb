"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const express_1 = __importDefault(require("express"));
const chromeLauncher = __importStar(require("chrome-launcher"));
const generative_ai_1 = require("@google/generative-ai");
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
const genai_1 = require("@google/genai");
admin.initializeApp();
console.log(`Firestore Emulator Host: ${process.env.FIRESTORE_EMULATOR_HOST}`);
const db = (0, firestore_1.getFirestore)();
db.settings({
    ignoreUndefinedProperties: true,
    ...(process.env.FIRESTORE_EMULATOR_HOST ? {
        host: process.env.FIRESTORE_EMULATOR_HOST,
        ssl: false,
    } : {}),
});
console.log(`Firestore initialized. Settings:`, db.settings);
// Initialize Gemini
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// Constants
const ACCESSIBILITY_RULE_MAP = {
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
const FIX_BUCKET_MAP = {
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
async function runLighthouse(url) {
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
    // Use dynamic import for Lighthouse
    const { default: lighthouse } = await Promise.resolve().then(() => __importStar(require("lighthouse")));
    const options = {
        logLevel: "info",
        output: "json",
        onlyCategories: ["accessibility"],
        port: chrome.port,
    };
    const runnerResult = await lighthouse(url, options);
    await chrome.kill();
    if (!runnerResult || !runnerResult.lhr) {
        throw new Error("Lighthouse failed to produce a report");
    }
    return runnerResult.lhr;
}
// Express App
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.get("/", (_req, res) => res.json({ ok: true, service: "plainweb-audit-service" }));
function normalizeUrl(input) {
    const url = new URL(input);
    url.protocol = "https:";
    url.hash = "";
    // Remove tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
        .forEach(p => url.searchParams.delete(p));
    // Remove trailing slash (except root)
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
}
function getDocId(url) {
    const normalized = normalizeUrl(url);
    return crypto.createHash("sha256").update(normalized).digest("hex");
}
app.post("/audit/raw", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: "missing url parameter" });
        }
        console.log(`[audit/raw] Running Lighthouse for ${url}`);
        const lhr = await runLighthouse(url);
        // Deep clone to avoid side effects
        const rawLhr = JSON.parse(JSON.stringify(lhr));
        /**
         * Remove heavy image data
         * These blow up payload size & are useless for backend processing
         */
        if (rawLhr.audits?.["final-screenshot"]) {
            delete rawLhr.audits["final-screenshot"];
        }
        if (rawLhr.audits?.["full-page-screenshot"]) {
            delete rawLhr.audits["full-page-screenshot"];
        }
        if (rawLhr.fullPageScreenshot) {
            delete rawLhr.fullPageScreenshot;
        }
        // OPTIONAL: remove runtime timing noise (still “raw-ish”)
        if (rawLhr.timing) {
            delete rawLhr.timing;
        }
        return res.json(rawLhr);
    }
    catch (err) {
        console.error("[audit/raw] error:", err);
        return res.status(500).json({
            error: "internal error",
            details: err.message,
        });
    }
});
// POST endpoints for fetching parts of the report
app.post("/audit/filtered", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: "missing url" });
        }
        const normalizedUrl = normalizeUrl(url);
        // Run Lighthouse on the original URL
        const lhr = await runLighthouse(url);
        if (!lhr?.audits || !lhr?.categories?.accessibility) {
            throw new Error("Invalid Lighthouse result");
        }
        // Get accessibility audit IDs
        const accessibilityAuditIds = new Set(lhr.categories.accessibility.auditRefs.map((ref) => ref.id));
        const filteredAudits = {};
        for (const auditId of accessibilityAuditIds) {
            const audit = lhr.audits[auditId];
            if (!audit || audit.score !== 0)
                continue;
            filteredAudits[auditId] = {
                id: audit.id,
                title: audit.title,
                score: audit.score,
                scoreDisplayMode: audit.scoreDisplayMode,
                details: audit.details
                    ? {
                        type: audit.details.type,
                        headings: audit.details.headings ?? [],
                    }
                    : undefined,
            };
        }
        // Convert filtered audits to string for Firestore
        const auditsString = JSON.stringify(filteredAudits);
        // Store minimal record in Firestore
        await db.collection("audits").add({
            url: normalizedUrl,
            score: accessibilityAuditIds.size === 0
                ? 100
                : Math.round(((accessibilityAuditIds.size - Object.keys(filteredAudits).length) /
                    accessibilityAuditIds.size) *
                    100),
            status: "completed",
            timestamp: firestore_1.FieldValue.serverTimestamp(),
            audits: auditsString, // ✅ store as string
        });
        // Return parsed JSON to client
        return res.json({
            audits: filteredAudits,
        });
    }
    catch (err) {
        console.error("audit/filtered error:", err);
        return res.status(500).json({
            error: "internal error",
            details: err.message,
        });
    }
});
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
app.post("/audit/analysis", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url)
            return res.status(400).json({ error: "missing url" });
        const normalizedUrl = normalizeUrl(url);
        const docRef = db.collection("audits").doc(getDocId(normalizedUrl));
        let doc = await docRef.get();
        let auditsJson = null;
        if (doc.exists) {
            const auditsStr = doc.data()?.audits;
            if (auditsStr)
                auditsJson = JSON.parse(auditsStr);
        }
        // If no audits, call filtered endpoint logic
        if (!auditsJson) {
            const lhr = await runLighthouse(url);
            const accessibilityAuditIds = new Set(lhr.categories.accessibility.auditRefs.map((ref) => ref.id));
            const filteredAudits = {};
            for (const auditId of accessibilityAuditIds) {
                const audit = lhr.audits[auditId];
                if (!audit || audit.score !== 0)
                    continue;
                filteredAudits[auditId] = {
                    id: audit.id,
                    title: audit.title,
                    score: audit.score,
                    scoreDisplayMode: audit.scoreDisplayMode,
                    details: audit.details
                        ? { type: audit.details.type, headings: audit.details.headings ?? [] }
                        : undefined,
                };
            }
            auditsJson = filteredAudits;
            await docRef.set({
                url: normalizedUrl,
                audits: JSON.stringify(filteredAudits),
                status: "completed",
                timestamp: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        // Use a working model for your key
        const model = "models/gemini-flash-latest";
        let geminiReport = "Unable to generate report";
        try {
            const response = await ai.models.generateContent({
                model,
                contents: `You are an expert developer assistant. Here is a JSON of failing accessibility audits:\n${JSON.stringify(auditsJson, null, 2)}\nProvide a detailed analysis for a developer explaining what each issue is, where it occurs, why it matters, and how to fix it.`,
            });
            geminiReport = response.text || "Unable to generate report";
        }
        catch (e) {
            console.error("Gemini failed:", e);
            geminiReport =
                "Failed to generate detailed report via Gemini. Using your current API key, this is expected if model access is restricted.\nError: " + e;
        }
        return res.json({ analysis: geminiReport });
    }
    catch (err) {
        console.error("audit/analysis error:", err);
        return res.status(500).json({ error: err.message });
    }
});
app.post("/audit/summary", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url)
            return res.status(400).json({ error: "missing url" });
        const normalizedUrl = normalizeUrl(url);
        const docId = getDocId(normalizedUrl);
        const docRef = db.collection("audits").doc(docId);
        let doc = await docRef.get();
        let ownerSummary = doc.data()?.report?.ownerSummary;
        let score = doc.data()?.score ?? null;
        // ---------- Regenerate if missing ----------
        if (!ownerSummary || score === null) {
            const lhr = await runLighthouse(url);
            const accessibilityAuditIds = new Set(lhr.categories.accessibility.auditRefs.map((ref) => ref.id));
            const filteredAudits = {};
            for (const auditId of accessibilityAuditIds) {
                const audit = lhr.audits[auditId];
                if (!audit || audit.score !== 0)
                    continue;
                filteredAudits[auditId] = {
                    id: audit.id,
                    title: audit.title,
                    score: audit.score,
                    scoreDisplayMode: audit.scoreDisplayMode,
                    details: audit.details
                        ? {
                            type: audit.details.type,
                            headings: audit.details.headings ?? [],
                        }
                        : undefined,
                };
            }
            // ---------- Score ----------
            score =
                accessibilityAuditIds.size === 0
                    ? 100
                    : Math.round(((accessibilityAuditIds.size -
                        Object.keys(filteredAudits).length) /
                        accessibilityAuditIds.size) *
                        100);
            // ---------- Owner-friendly summary ----------
            ownerSummary =
                Object.keys(filteredAudits).length === 0
                    ? "Great news! Your website passed our accessibility checks and meets common accessibility standards."
                    : `Your website scored ${score}/100 for accessibility. We found ${Object.keys(filteredAudits).length} issues that may affect users with disabilities. These are common and can be fixed to improve usability for everyone.`;
            // ---------- Persist ----------
            await docRef.set({
                url: normalizedUrl,
                score,
                report: {
                    ownerSummary,
                    audits: JSON.stringify(filteredAudits),
                },
                status: "completed",
                timestamp: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        // ---------- Response ----------
        return res.json({
            score,
            summary: ownerSummary,
        });
    }
    catch (err) {
        console.error("audit/summary error:", err);
        return res.status(500).json({ error: err.message });
    }
});
exports.api = (0, https_1.onRequest)({
    timeoutSeconds: 300,
    memory: "2GiB",
}, app);
