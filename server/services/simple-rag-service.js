// simple-rag-service.js - ChromaDB-free RAG implementation
const OpenAI = require('openai');
const mysql = require('mysql2/promise');

class SimpleRAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // In-memory vector storage (simple approach)
    this.medicalEmbeddings = [];
    this.nutritionEmbeddings = [];
    this.isInitialized = false;
    
    // Database connection
    this.db = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1234',
      database: process.env.DB_NAME || 'medicare',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔬 Initializing Simple RAG Service...');
    
    try {
      // Load medical knowledge from database and create embeddings
      await this.loadMedicalKnowledge();
      await this.loadNutritionKnowledge();
      
      this.isInitialized = true;
      console.log('✅ Simple RAG Service initialized successfully');
    } catch (error) {
      console.error('❌ RAG Service initialization failed:', error.message);
      // Fallback: use SQL-based RAG only
      this.isInitialized = true;
    }
  }

  async loadMedicalKnowledge() {
    try {
      const [conditions] = await this.db.query(
        'SELECT condition_name, symptoms, specialist, description FROM medical_conditions LIMIT 50'
      );
      
      console.log(`📚 Loading ${conditions.length} medical conditions...`);
      
      for (const condition of conditions) {
        const text = `${condition.condition_name}: ${condition.symptoms}. Requires ${condition.specialist}. ${condition.description}`;
        
        try {
          const embedding = await this.createEmbedding(text);
          this.medicalEmbeddings.push({
            id: `medical-${condition.condition_name}`,
            text: text,
            embedding: embedding,
            metadata: {
              type: 'symptom',
              category: 'medical',
              specialist: condition.specialist
            }
          });
        } catch (embeddingError) {
          console.log(`⚠️ Skipping embedding for ${condition.condition_name}: ${embeddingError.message}`);
        }
      }
      
      console.log(`✅ Created ${this.medicalEmbeddings.length} medical embeddings`);
    } catch (error) {
      console.log('⚠️ Using fallback medical knowledge (no embeddings)');
    }
  }

  async loadNutritionKnowledge() {
    // Simple nutrition database
    const nutritionFacts = [
      "Apple: 95 calories, high in fiber, vitamin C, antioxidants. Good for heart health and digestion.",
      "Banana: 105 calories, high in potassium, vitamin B6. Good for energy and muscle function.",
      "Spinach: 7 calories per cup, high in iron, vitamin K, folate. Good for blood health.",
      "Salmon: 206 calories per 100g, high in omega-3, protein. Good for brain and heart health.",
      "Avocado: 160 calories, high in healthy fats, fiber, potassium. Good for heart health."
    ];

    for (const fact of nutritionFacts) {
      try {
        const embedding = await this.createEmbedding(fact);
        this.nutritionEmbeddings.push({
          id: `nutrition-${fact.split(':')[0].toLowerCase()}`,
          text: fact,
          embedding: embedding,
          metadata: {
            type: 'nutrition',
            category: 'food'
          }
        });
      } catch (error) {
        console.log(`⚠️ Skipping nutrition embedding: ${error.message}`);
      }
    }
    
    console.log(`✅ Created ${this.nutritionEmbeddings.length} nutrition embeddings`);
  }

  async createEmbedding(text) {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  }

  async ragAnalyzeSymptoms(symptomText) {
    await this.initialize();
    
    try {
      // Try vector search first
      if (this.medicalEmbeddings.length > 0) {
        const queryEmbedding = await this.createEmbedding(symptomText);
        const results = this.findSimilar(queryEmbedding, this.medicalEmbeddings, 3);
        
        if (results.length > 0) {
          const context = results.map(r => r.text).join('\n\n');
          return {
            response: `Based on medical knowledge:\n\n${context}\n\nRecommendation: Please consult with the appropriate specialist.`,
            isRAGEnhanced: true,
            context: results,
            type: 'symptom'
          };
        }
      }
      
      // Fallback to SQL-based RAG
      return await this.sqlBasedSymptomAnalysis(symptomText);
      
    } catch (error) {
      console.log('⚠️ RAG failed, using SQL fallback:', error.message);
      return await this.sqlBasedSymptomAnalysis(symptomText);
    }
  }

  async ragAnalyzeNutrition(foodText) {
    await this.initialize();
    
    try {
      if (this.nutritionEmbeddings.length > 0) {
        const queryEmbedding = await this.createEmbedding(foodText);
        const results = this.findSimilar(queryEmbedding, this.nutritionEmbeddings, 2);
        
        if (results.length > 0) {
          const context = results.map(r => r.text).join('\n\n');
          return {
            response: `Nutrition information:\n\n${context}`,
            isRAGEnhanced: true,
            context: results,
            type: 'nutrition'
          };
        }
      }
      
      // Fallback to Gemini
      const geminiService = require('./geminiService');
      const response = await geminiService.getHealthInfo('food', foodText);
      return {
        response: response,
        isRAGEnhanced: false,
        context: [],
        type: 'nutrition'
      };
      
    } catch (error) {
      console.log('⚠️ Nutrition RAG failed:', error.message);
      return {
        response: `I don't have specific nutrition information for "${foodText}". Please consult a nutritionist.`,
        isRAGEnhanced: false,
        context: [],
        type: 'nutrition'
      };
    }
  }

  async sqlBasedSymptomAnalysis(symptoms) {
    try {
      const [conditions] = await this.db.query(
        `SELECT condition_name, symptoms, specialist, urgency_level, description 
         FROM medical_conditions 
         WHERE symptoms LIKE ? OR condition_name LIKE ?
         LIMIT 3`,
        [`%${symptoms}%`, `%${symptoms}%`]
      );

      if (conditions.length > 0) {
        const context = conditions.map(c => 
          `Condition: ${c.condition_name}\nSymptoms: ${c.symptoms}\nSpecialist: ${c.specialist}\nUrgency: ${c.urgency_level}`
        ).join('\n\n');
        
        return {
          response: `Based on medical database:\n\n${context}\n\nPlease consult with the recommended specialist.`,
          isRAGEnhanced: true,
          context: conditions.map(c => ({ text: `${c.condition_name}: ${c.symptoms}`, similarity: 0.8 })),
          type: 'symptom'
        };
      }
    } catch (error) {
      console.log('⚠️ SQL fallback failed:', error.message);
    }
    
    return {
      response: `I found symptoms related to "${symptoms}". Please consult with a healthcare professional for proper diagnosis.`,
      isRAGEnhanced: false,
      context: [],
      type: 'symptom'
    };
  }

  findSimilar(queryEmbedding, embeddings, topK = 3) {
    const similarities = embeddings.map(item => ({
      ...item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding)
    }));
    
    return similarities
      .filter(item => item.similarity > 0.6) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

module.exports = new SimpleRAGService();
