const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in env");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
        console.log("Available Models:");
        data.models.forEach(m => console.log(`- ${m.name}`));
    } else {
        console.log("No models found or error:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("Error listing models:", e);
  }
}

listModels();
