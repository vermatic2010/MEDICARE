const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
require('dotenv').config({ path: '../.env' });

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Unified POST route: supports JSON and file uploads
router.post("/", upload.single("file"), async (req, res) => {
  let { type, userInput, symptoms } = req.body;

  // If a file is uploaded, extract text and treat as prescription
  if (req.file) {
    try {
      let text = "";
      const file = req.file;
      const ext = path.extname(file.originalname).toLowerCase();

      if (file.mimetype.startsWith("image/")) {
        // OCR for images
        const result = await Tesseract.recognize(file.path, "eng");
        text = result.data.text;
      } else if (file.mimetype === "application/pdf" || ext === ".pdf") {
        // PDF text extraction
        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdfParse(dataBuffer);
        text = data.text;
      } else if (file.mimetype === "text/plain" || ext === ".txt") {
        text = fs.readFileSync(file.path, "utf8");
      } else {
        text = "";
      }

      fs.unlinkSync(file.path); // Clean up uploaded file

      if (!text.trim()) {
        return res.status(400).json({ error: "Could not extract text from the file." });
      }

      // Now explain the prescription using Gemini
      const prompt = `
You are a medical assistant. 
Explain the following prescription in simple terms for a patient. 
List the medicines, what each is for, and any important instructions or warnings. 
Avoid medical jargon.

Prescription:
${text}
`;
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error("File extraction/Gemini error:", err.message);
      return res.status(500).json({ error: "Failed to extract or explain prescription" });
    }
  }

  // SYMPTOM CHECKER
  if (type === "symptom" || symptoms) {
    const symptomText = userInput || symptoms;
    if (!symptomText) {
      return res.status(400).json({ error: "Missing symptoms or userInput" });
    }
    const prompt = `
You are a helpful medical assistant. 
A user reports these symptoms: "${symptomText}".
Based on these, provide a helpful, safe, and non-diagnostic response. 
Suggest possible causes, home care, and when to see a doctor. 
Do not give a diagnosis.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to get response from Gemini" });
    }
  }

  // PRESCRIPTION EXPLANATION (if text is sent directly)
  if (type === "prescription" && userInput) {
    const prompt = `
You are a medical assistant. 
Explain the following prescription in simple terms for a patient. 
List the medicines, what each is for, and any important instructions or warnings. 
Avoid medical jargon.

Prescription:
${userInput}
`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to get response from Gemini" });
    }
  }

  // AQI, FOOD, YOGA
  if (type && userInput) {
    let prompt = "";
    switch (type) {
      case "aqi":
        prompt = `Provide the current AQI (Air Quality Index) for the city "${userInput}". Include AQI number, pollution level (e.g. Good, Moderate, Unhealthy), major pollutants, and health advisory. Be brief and useful.`;
        break;
      case "food":
        prompt = `Give the nutrition facts for the food item "${userInput}". Include calories, macronutrients (carbs, protein, fats), and any important vitamins or health benefits. Limit to 5-6 lines.`;
        break;
      case "yoga":
        prompt = `Suggest yoga poses for the condition or goal: "${userInput}". Provide 3-5 effective poses. Add brief descriptions and benefits for each. Use bullet points.`;
        break;
      default:
        return res.status(400).json({ error: "Invalid type provided" });
    }

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to get response from Gemini" });
    }
  }

  return res.status(400).json({ error: "Missing or invalid type/userInput/symptoms" });
});

module.exports = router;