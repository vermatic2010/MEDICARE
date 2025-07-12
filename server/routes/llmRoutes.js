const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '../.env' });

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

router.post("/llm-intent", async (req, res) => {
  const { text, role } = req.body;
  const prompt = `
You are an intent and entity extractor for a wellness chatbot.
Extract the user's intent as one of: "bmi", "bp", "food", "yoga", or "other".
Also extract the relevant entity:
- For yoga, extract the health goal (e.g., "shoulder pain", "knee pain", "pain in my knees", "stiff knees", "arthritis in knee", "back pain", "cramps of stomach", etc.) as "goal".
- For bmi, extract "weight" (number, kg) and "height" (number, cm).
- For bp, extract "systolic" (number) and "diastolic" (number).
- For food, extract "food" (the item).
Respond as JSON. If not present, omit the field.

Examples:
User: "give me yoga poses for knee pain"
{"intent": "yoga", "goal": "knee pain"}

User: "suggest yoga for shoulder pain"
{"intent": "yoga", "goal": "shoulder pain"}

User: "whats my bp if its 120/80"
{"intent": "bp", "systolic": 120, "diastolic": 80}

User: "bp is 135/90"
{"intent": "bp", "systolic": 135, "diastolic": 90}

User: "give me bmi if my weight is 60kg and height is 170cm"
{"intent": "bmi", "weight": 60, "height": 170}

User: "get me nutrition for guava"
{"intent": "food", "food": "guava"}

User: "bmi for 72kg and 180cm"
{"intent": "bmi", "weight": 72, "height": 180}

User: "yoga for back pain"
{"intent": "yoga", "goal": "back pain"}

User: "${text}"
`;

  try {
    const result = await model.generateContent(prompt);
    let responseText = await result.response.text();
    // Optionally log for debugging
    // console.log("LLM raw response:", responseText);
    let json = {};
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      // fallback: just intent as string
      json = { intent: responseText.trim().replace(/"/g, "") };
    }
    res.json(json);
  } catch (err) {
    console.error("Gemini intent error:", err.message);
    res.json({ intent: "other" });
  }
});

module.exports = router;