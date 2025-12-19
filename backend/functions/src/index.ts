import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";

admin.initializeApp();

const db = admin.firestore();
if (process.env.FIRESTORE_EMULATOR_HOST) {
  db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false } as any);
}

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "plainweb-audit" }));

app.post("/audit", async (req, res) => {
  try {
    const url = (req.body && req.body.url) || req.query.url;
    if (!url) return res.status(400).json({ error: "missing url" });

    const docId = encodeURIComponent(String(url));
    const docRef = db.collection("audits").doc(docId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      return res.json({
        cached: true,
        report: data?.report,
        cachedAt: data?.cachedAt,
      });
    }

    // Produce a mock Lighthouse-style response
    const mockReport = {
      lighthouseVersion: "10.0.0",
      requestedUrl: url,
      fetchTime: new Date().toISOString(),
      categories: {
        performance: Math.floor(50 + Math.random() * 50),
        accessibility: Math.floor(50 + Math.random() * 50),
        bestPractices: Math.floor(50 + Math.random() * 50),
        seo: Math.floor(50 + Math.random() * 50),
        pwa: Math.floor(50 + Math.random() * 50),
      },
      audits: {
        "first-contentful-paint": { score: 0.9, displayValue: "1.2s" },
        "largest-contentful-paint": { score: 0.88, displayValue: "1.9s" },
      },
    };

    await docRef.set({
      report: mockReport,
      cachedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({ cached: false, report: mockReport });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

export const api = functions.https.onRequest(app);
