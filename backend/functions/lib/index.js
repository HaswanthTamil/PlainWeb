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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const express_1 = __importDefault(require("express"));
// import lighthouse from "lighthouse"; // Converted to dynamic import
const chromeLauncher = __importStar(require("chrome-launcher"));
const generative_ai_1 = require("@google/generative-ai");
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const db = admin.firestore();
if (process.env.FIRESTORE_EMULATOR_HOST) {
    db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
}
// Initialize Gemini
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/", (_req, res) => res.json({ ok: true, service: "plainweb-audit" }));
app.post("/audit", async (req, res) => {
    try {
        const url = (req.body && req.body.url) || req.query.url;
        if (!url)
            return res.status(400).json({ error: "missing url" });
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
        }
        catch (e) {
            console.error("Failed to launch chrome", e);
            return res
                .status(500)
                .json({ error: "Failed to launch browser environment" });
        }
        const options = {
            port: chrome.port,
            output: "json",
            logLevel: "info",
        };
        let runnerResult;
        try {
            // Dynamic import for Lighthouse (ESM)
            const lighthouseImport = await Promise.resolve().then(() => __importStar(require("lighthouse")));
            const lighthouse = lighthouseImport.default; // Access default export
            runnerResult = await lighthouse(String(url), options);
        }
        catch (e) {
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
            }
            catch (e) {
                console.error("Gemini analysis failed", e);
                geminiAnalysis = `Analysis failed: ${e.message}`;
            }
        }
        else {
            console.warn("Skipping Gemini analysis: GEMINI_API_KEY not set");
        }
        // 5. Filter and Store
        const audits = lhr.audits;
        const filteredAudits = {};
        const excludedAudits = [
            "screenshot-thumbnails",
            "final-screenshot",
            "errors-in-console",
        ];
        for (const [key, audit] of Object.entries(audits)) {
            if (excludedAudits.includes(key))
                continue;
            if (audit.score === 1)
                continue;
            const a = audit;
            if (a.details && a.details.items) {
                a.details.items = simplifyItems(a.details.items);
            }
            filteredAudits[key] = a;
        }
        // Replace audits in lhr
        lhr.audits = filteredAudits;
        // Further cleanup
        delete lhr.i18n;
        delete lhr.categoryGroups;
        delete lhr.entities;
        delete lhr.timing;
        if (lhr.fullPageScreenshot) {
            delete lhr.fullPageScreenshot;
        }
        // Prune empty fields recursively
        const prunedLhr = pruneEmpty(lhr);
        // Remove `performance` category from categories if present
        if (prunedLhr && prunedLhr.categories) {
            delete prunedLhr.categories.performance;
        }
        // Recursively remove any `description` fields from the report
        function removeDescriptions(obj) {
            if (!obj || typeof obj !== "object")
                return;
            if (Array.isArray(obj)) {
                for (const item of obj)
                    removeDescriptions(item);
                return;
            }
            for (const key of Object.keys(obj)) {
                if (key === "description") {
                    delete obj[key];
                    continue;
                }
                const val = obj[key];
                if (typeof val === "object" && val !== null)
                    removeDescriptions(val);
            }
        }
        removeDescriptions(prunedLhr);
        const reportToStore = {
            lhr: JSON.parse(JSON.stringify(prunedLhr)), // Ensure plain object
            geminiAnalysis,
        };
        await docRef.set({
            report: reportToStore,
            url: String(url),
            cachedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return res.json({
            cached: false,
            report: reportToStore,
        });
    }
    catch (err) {
        console.error(err);
        require("fs").appendFileSync("error.log", `${new Date().toISOString()} - ${err.message}\n${err.stack}\n\n`);
        return res
            .status(500)
            .json({ error: "internal error", details: err.message });
    }
});
// Helper to simplify audit details
function simplifyItems(items, limit = 5) {
    if (!Array.isArray(items))
        return [];
    return items.slice(0, limit).map((item) => ({
        node: item.node?.nodeLabel || "unknown",
        selector: item.node?.selector || null,
        explanation: item.explanation || item.failureReason || null,
    }));
}
// Recursive function to prune empty fields
function pruneEmpty(obj) {
    if (obj === null || obj === undefined || obj === "")
        return undefined;
    if (Array.isArray(obj)) {
        const result = obj.map(pruneEmpty).filter((v) => v !== undefined);
        return result.length > 0 ? result : undefined;
    }
    if (typeof obj === "object") {
        const result = {};
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
exports.api = functions
    .runWith({
    timeoutSeconds: 300,
    memory: "2GB", // Chrome needs RAM
})
    .https.onRequest(app);
