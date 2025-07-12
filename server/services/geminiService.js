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
    
    Provide concise response with minimal spacing:
    **Likely Conditions**: [2-3 most probable conditions]
    **Recommended Specialist**: [Specific doctor type needed]
    **Urgency Level**: [low/medium/high/URGENT]
    **Immediate Actions**: [What to do now]
    **When to Seek Help**: [Warning signs]
    
    Keep responses brief yet informative. Always end with: "Would you like to book an appointment with the recommended specialist? (Reply 'yes' to proceed)"`;
    
    return this.generateContent(prompt);
  }

  async getHealthInfo(type, query) {
    const prompts = {
      food: `Give nutrition facts for ${query} with minimal spacing:
      **Calories**: [Per serving]
      **Macronutrients**: [Carbs, protein, fats]
      **Key Nutrients**: [Important vitamins/minerals]
      **Health Benefits**: [Brief benefits]`,
      
      yoga: `Suggest yoga for ${query} with minimal spacing:
      **Recommended Poses**: [3-5 specific poses]
      **Instructions**: [Brief how-to for each]
      **Benefits**: [How each helps the condition]`
    };

    if (!prompts[type]) throw new Error("Invalid query type");
    return this.generateContent(prompts[type]);
  }
}

module.exports = new GeminiService();