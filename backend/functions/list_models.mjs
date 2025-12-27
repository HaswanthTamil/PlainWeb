import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    // In @google/generative-ai, listing models is done via a different method usually
    // or sometimes not exposed directly in this SDK version as a simple call.
    // Actually, it's usually via a fetch call to the endpoint.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error listing models:", e);
  }
}

listModels();
