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

    const reportToStore = {
      lhr: JSON.parse(JSON.stringify(prunedLhr)), // Ensure plain object
      geminiAnalysis,
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

// Helper to simplify audit details
function simplifyItems(items: any[], limit = 5) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((item) => ({
    node: item.node?.nodeLabel || "unknown",
    selector: item.node?.selector || null,
    explanation: item.explanation || item.failureReason || null,
  }));
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
