/**
 * AI Response Route - HealthConnect Backend
 * 
 * This route handles different types of AI-powered requests:
 * 
 * TRUE RAG IMPLEMENTATIONS:
 * - Symptom analysis with medical knowledge retrieval
 * - Food nutrition analysis with nutrition database retrieval
 * 
 * STRUCTURED PROMPTING (NOT RAG):
 * - Intent/entity extraction for user input parsing
 * - Yoga advice generation
 * - Prescription text explanation
 * - Wellness workflow parsing
 * 
 * Note: Only symptom and food flows use true RAG with vector search.
 * Other flows use Gemini AI with structured prompts (no retrieval).
 */

const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const ragService = require("../services/ragService");
require('dotenv').config({ path: '../.env' });

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

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

  // === TRUE RAG: SYMPTOM ANALYSIS ===
  // Uses vector search to retrieve relevant medical knowledge from database
  // Then augments Gemini prompt with retrieved context for accurate diagnosis
  if (type === "symptom" || type === "symptom-specialist" || symptoms) {
    const symptomText = userInput || symptoms;
    if (!symptomText) {
      return res.status(400).json({ error: "Missing symptoms or userInput" });
    }

    try {
      // Use RAG Service for enhanced analysis
      const ragResult = await ragService.ragAnalyzeSymptoms(symptomText);
      
      // Generate response using Gemini with retrieved context
      const result = await model.generateContent(ragResult.prompt);
      const response = await result.response.text();
      
      // Return enhanced response with RAG metadata
      return res.json({ 
        response,
        ragEnhanced: ragResult.isRAGEnhanced,
        contextUsed: ragResult.context.length,
        relevantContext: ragResult.context.map(ctx => ({
          similarity: ctx.similarity,
          type: ctx.metadata.type,
          category: ctx.metadata.category
        }))
      });
    } catch (error) {
      console.error("RAG Symptom Analysis error:", error.message);
      
      // Fallback to simple analysis
      const fallbackPrompt = `
You are a helpful medical assistant. 
A user reports these symptoms: "${symptomText}".
Based on these, provide possible causes, home care, and when to see a doctor. 
Do not give a diagnosis.`;

      try {
        const result = await model.generateContent(fallbackPrompt);
        const response = await result.response.text();
        return res.json({ 
          response, 
          ragEnhanced: false,
          fallback: true 
        });
      } catch (fallbackError) {
        return res.status(500).json({ error: "Failed to analyze symptoms" });
      }
    }
  }

  // === STRUCTURED PROMPTING: PRESCRIPTION EXPLANATION ===
  // Uses Gemini AI with predefined prompt - NO retrieval, NO vector search
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

  // === STRUCTURED PROMPTING: INTENT & ENTITY EXTRACTION ===
  // Uses Gemini AI to parse user input and extract intents/entities
  // NO retrieval, NO vector search - just intelligent text parsing
  if (type === "comprehensive-intent-extraction" && userInput) {
    const { context: userContext = "general" } = req.body;
    
    let contextPrompt = "";
    if (userContext === "doctor") {
      contextPrompt = `You are analyzing input from a DOCTOR. Doctors typically want to:
- Add medicines for patients
- View patient medicine history
- Check patient active medicines
- View their appointments
- Book appointments for consultation`;
    } else if (userContext === "patient") {
      contextPrompt = `You are analyzing input from a PATIENT. Patients typically want to:
- View their prescription history
- Book appointments
- Check symptoms
- Upload prescriptions
- View their appointments`;
    }

    const prompt = `${contextPrompt}

Extract comprehensive information from this medical request: "${userInput}"

Respond with ONLY a JSON object in this exact format:
{
  "intent": "prescription_history|book_appointment|patient_lookup|medicine_add|symptom_check|appointment_view|upload_prescription|other",
  "count": number_or_null,
  "timeframe": "recent|all|null",
  "doctor_id": number_or_null,
  "specialist": "string_or_null", 
  "date": "YYYY-MM-DD_or_null",
  "time": "HH:MM_AM/PM_or_null",
  "patient_identifier": "username_or_id_or_null",
  "patient_type": "username|id|null",
  "action": "view_patient_medicines|check_active_medicines|null",
  "medicines": [{"name": "string", "dosage": "string", "duration": "string", "instructions": "string"}] or null,
  "symptoms": "string_or_null",
  "target": "doctor|patient|null"
}

Examples:
- "show my recent 3 prescriptions" -> {"intent": "prescription_history", "count": 3, "timeframe": "recent", ...}
- "add paracetamol 500mg for patient john for 5 days" -> {"intent": "medicine_add", "patient_identifier": "john", "medicines": [{"name": "paracetamol", "dosage": "500mg", "duration": "5 days", "instructions": "As prescribed"}], ...}
- "check patient 5 active medicines" -> {"intent": "patient_lookup", "patient_identifier": "5", "patient_type": "id", "action": "check_active_medicines", ...}
- "book appointment with cardiologist tomorrow 3PM" -> {"intent": "book_appointment", "specialist": "cardiologist", "time": "3:00 PM", ...}
- "I have fever and headache" -> {"intent": "symptom_check", "symptoms": "fever and headache", ...}
- "show my appointments" -> {"intent": "appointment_view", "target": "patient", ...}

Extract all relevant entities and normalize formats. Set unused fields to null.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to extract comprehensive intent from Gemini" });
    }
  }

  // === STRUCTURED PROMPTING: WELLNESS INTENT & ENTITY EXTRACTION ===
  // Uses Gemini AI to parse wellness queries and extract health data
  // NO retrieval, NO vector search - just parsing BMI, BP, food, etc.
  if (type === "wellness-intent-extraction" && userInput) {
    const prompt = `Extract comprehensive wellness information from this request: "${userInput}"

Respond with ONLY a JSON object in this exact format:
{
  "intent": "bmi|bp|food|yoga|upload|other",
  "weight": number_or_null,
  "height": number_or_null,
  "unit": "metric|imperial|null",
  "systolic": number_or_null,
  "diastolic": number_or_null,
  "food_item": "string_or_null",
  "goal": "string_or_null",
  "city": "string_or_null",
  "bmi_value": number_or_null
}

Examples:
- "I weigh 70kg and I'm 175cm tall" -> {"intent": "bmi", "weight": 70, "height": 175, "unit": "metric", ...}
- "my weight is 150 pounds height 5 feet 8 inches" -> {"intent": "bmi", "weight": 150, "height": 68, "unit": "imperial", ...}
- "my bp is 120/80" -> {"intent": "bp", "systolic": 120, "diastolic": 80, ...}
- "blood pressure 140 over 90" -> {"intent": "bp", "systolic": 140, "diastolic": 90, ...}
- "nutrition info for apple" -> {"intent": "food", "food_item": "apple", ...}
- "calories in rice" -> {"intent": "food", "food_item": "rice", ...}
- "yoga for back pain" -> {"intent": "yoga", "goal": "back pain", ...}
- "exercises for stress relief" -> {"intent": "yoga", "goal": "stress relief", ...}
- "upload medical document" -> {"intent": "upload", ...}

Extract all relevant wellness entities. Convert height in feet/inches to total inches. Set unused fields to null.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to extract wellness intent from Gemini" });
    }
  }

  // INTENT EXTRACTION for prescription history
  if (type === "intent-extraction" && userInput) {
    const prompt = `Extract information from this prescription request: "${userInput}"

Respond with ONLY a JSON object in this exact format:
{
  "intent": "prescription_history",
  "count": number_or_null,
  "timeframe": "recent|all|null"
}

Examples:
- "show my recent 3 prescriptions" -> {"intent": "prescription_history", "count": 3, "timeframe": "recent"}
- "get my last 5 medicines" -> {"intent": "prescription_history", "count": 5, "timeframe": "recent"}
- "show all prescriptions" -> {"intent": "prescription_history", "count": null, "timeframe": "all"}
- "prescription history" -> {"intent": "prescription_history", "count": null, "timeframe": null"}
- "fetch my recent prescriptions" -> {"intent": "prescription_history", "count": null, "timeframe": "recent"}

Extract numbers mentioned (1-100) and set timeframe to "recent" if words like "recent", "latest", "last" are used.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to extract intent from Gemini" });
    }
  }

  // APPOINTMENT EXTRACTION for booking
  if (type === "appointment-extraction" && userInput) {
    const prompt = `Extract appointment booking information from: "${userInput}"

Respond with ONLY a JSON object:
{
  "intent": "book_appointment",
  "doctor_id": number_or_null,
  "specialist": "string_or_null",
  "date": "YYYY-MM-DD_or_null",
  "time": "HH:MM_AM/PM_or_null"
}

Examples:
- "book appointment with doctor 1 tomorrow at 3PM" -> {"intent": "book_appointment", "doctor_id": 1, "specialist": null, "date": null, "time": "3:00 PM"}
- "schedule with cardiologist" -> {"intent": "book_appointment", "doctor_id": null, "specialist": "cardiologist", "date": null, "time": null}
- "see doctor 2 on 2025-01-15 at 10AM" -> {"intent": "book_appointment", "doctor_id": 2, "specialist": null, "date": "2025-01-15", "time": "10:00 AM"}

Extract doctor ID numbers, specialist names, dates in YYYY-MM-DD format, and times in HH:MM AM/PM format.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to extract appointment info from Gemini" });
    }
  }

  // PATIENT EXTRACTION for doctor lookups
  if (type === "patient-extraction" && userInput) {
    const prompt = `Extract patient identifier from: "${userInput}"

Respond with ONLY a JSON object:
{
  "patient_identifier": "username_or_id",
  "type": "username|id|unknown"
}

Examples:
- "patient john doe" -> {"patient_identifier": "johndoe", "type": "username"}
- "user mrigank" -> {"patient_identifier": "mrigank", "type": "username"}
- "patient id 5" -> {"patient_identifier": "5", "type": "id"}
- "123" -> {"patient_identifier": "123", "type": "id"}
- "show medicines for alex" -> {"patient_identifier": "alex", "type": "username"}

Convert names to lowercase usernames (remove spaces). Identify numbers as IDs.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      return res.json({ response });
    } catch (error) {
      console.error("Gemini API error:", error.message);
      return res.status(500).json({ error: "Failed to extract patient info from Gemini" });
    }
  }

  // === TRUE RAG: NUTRITION/FOOD ANALYSIS ===
  // Uses vector search to retrieve relevant nutrition knowledge from database
  // Then augments Gemini prompt with retrieved context for accurate nutrition info
  if (type === "food" && userInput) {
    try {
      // Use RAG Service for enhanced nutrition analysis
      const ragResult = await ragService.ragAnalyzeNutrition(userInput);
      
      // Generate response using Gemini with retrieved nutrition context
      const result = await model.generateContent(ragResult.prompt);
      const response = await result.response.text();
      
      // Return enhanced response with RAG metadata
      return res.json({ 
        response,
        ragEnhanced: ragResult.isRAGEnhanced,
        contextUsed: ragResult.context.length,
        relevantContext: ragResult.context.map(ctx => ({
          similarity: ctx.similarity,
          type: ctx.metadata.type,
          category: ctx.metadata.category,
          calories: ctx.metadata.calories,
          benefits: ctx.metadata.benefits
        }))
      });
    } catch (error) {
      console.error("RAG Nutrition Analysis error:", error.message);
      
      // Fallback to simple nutrition analysis
      const fallbackPrompt = `Give the nutrition facts for the food item "${userInput}". Include calories, macronutrients (carbs, protein, fats), and any important vitamins or health benefits. Limit to 5-6 lines.`;

      try {
        const result = await model.generateContent(fallbackPrompt);
        const response = await result.response.text();
        return res.json({ 
          response, 
          ragEnhanced: false,
          fallback: true 
        });
      } catch (fallbackError) {
        return res.status(500).json({ error: "Failed to analyze nutrition" });
      }
    }
  }

  // === STRUCTURED PROMPTING: YOGA ADVICE ===
  // Uses Gemini AI with predefined prompts - NO retrieval, NO vector search
  // These could be converted to RAG in the future by adding knowledge bases
  if (type && userInput) {
    let prompt = "";
    switch (type) {
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