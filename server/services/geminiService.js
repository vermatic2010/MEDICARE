// services/geminiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
  }

  async generateContent(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini Error:", error);
      throw new Error("Failed to generate content");
    }
  }

  async analyzeSymptoms(symptoms) {
    const prompt = `As a medical triage assistant, analyze these symptoms: "${symptoms}".
    
    Provide in this structured format:
    1. Likely Conditions (2-3 most probable)
    2. Recommended Specialist
    3. Urgency Level (low/medium/high)
    4. Immediate Actions
    5. When to Seek Help
    
    Keep responses concise yet informative.`;
    
    return this.generateContent(prompt);
  }

  async getHealthInfo(type, query) {
    const prompts = {
      aqi: `Provide current AQI for ${query}. Include: 
      - AQI number and level 
      - Primary pollutants 
      - Health recommendations`,
      
      food: `Give nutrition facts for ${query}:
      - Calories
      - Macronutrients
      - Key vitamins/minerals
      - Health benefits`,
      
      yoga: `Suggest yoga for ${query}:
      - 3-5 recommended poses
      - Brief instructions
      - Benefits for the condition`
    };

    if (!prompts[type]) throw new Error("Invalid query type");
    return this.generateContent(prompts[type]);
  }
}

module.exports = new GeminiService();