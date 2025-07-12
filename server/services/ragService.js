const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.medicalKnowledge = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load medical knowledge into memory
      await this.seedMedicalKnowledge();
      this.isInitialized = true;
      console.log('✅ RAG Service initialized (in-memory mode)');
    } catch (error) {
      console.error('❌ Failed to initialize RAG Service:', error);
    }
  }

  async seedMedicalKnowledge() {
    console.log('🌱 Seeding medical knowledge base...');

    const medicalData = [
      // Symptom-Disease mappings
      {
        id: uuidv4(),
        document: "Fever, headache, body ache, fatigue are common symptoms of viral infections like flu, cold, or COVID-19. Usually resolve in 7-10 days with rest and hydration.",
        metadata: { type: "symptom", category: "viral_infection", severity: "mild" }
      },
      {
        id: uuidv4(),
        document: "Chest pain, shortness of breath, dizziness, nausea can indicate heart problems. Requires immediate medical attention, especially if pain radiates to arm or jaw.",
        metadata: { type: "symptom", category: "cardiac", severity: "emergency" }
      },
      {
        id: uuidv4(),
        document: "Severe headache, neck stiffness, fever, sensitivity to light may indicate meningitis. This is a medical emergency requiring immediate hospital treatment.",
        metadata: { type: "symptom", category: "neurological", severity: "emergency" }
      },
      {
        id: uuidv4(),
        document: "Persistent cough, fever, difficulty breathing, chest tightness can indicate respiratory infections like pneumonia or bronchitis. See a pulmonologist.",
        metadata: { type: "symptom", category: "respiratory", severity: "moderate" }
      },
      {
        id: uuidv4(),
        document: "Abdominal pain, nausea, vomiting, diarrhea are common gastrointestinal symptoms. Could be food poisoning, gastritis, or infection. See gastroenterologist if persistent.",
        metadata: { type: "symptom", category: "gastrointestinal", severity: "mild" }
      },

      // Drug information
      {
        id: uuidv4(),
        document: "Paracetamol (Acetaminophen): Safe pain reliever and fever reducer. Adults: 500-1000mg every 4-6 hours, max 4g/day. Overdose can cause liver damage.",
        metadata: { type: "drug", category: "analgesic", safety: "safe" }
      },
      {
        id: uuidv4(),
        document: "Ibuprofen: Anti-inflammatory pain reliever. Adults: 400-800mg every 6-8 hours, max 3.2g/day. Can cause stomach ulcers, avoid with blood thinners.",
        metadata: { type: "drug", category: "nsaid", safety: "caution" }
      },
      {
        id: uuidv4(),
        document: "Amoxicillin: Antibiotic for bacterial infections. Common side effects: nausea, diarrhea, allergic reactions. Take full course even if feeling better.",
        metadata: { type: "drug", category: "antibiotic", safety: "prescription" }
      },

      // Specialist recommendations
      {
        id: uuidv4(),
        document: "Cardiologist: Heart problems, chest pain, high blood pressure, irregular heartbeat, family history of heart disease. ECG, echocardiogram, stress tests.",
        metadata: { type: "specialist", category: "cardiology" }
      },
      {
        id: uuidv4(),
        document: "Pulmonologist: Lung problems, persistent cough, breathing difficulties, asthma, COPD, sleep apnea. Chest X-ray, lung function tests.",
        metadata: { type: "specialist", category: "pulmonology" }
      },
      {
        id: uuidv4(),
        document: "Neurologist: Headaches, seizures, memory problems, dizziness, numbness, movement disorders. MRI, CT scan, nerve conduction studies.",
        metadata: { type: "specialist", category: "neurology" }
      },
      {
        id: uuidv4(),
        document: "Gastroenterologist: Stomach problems, abdominal pain, digestive issues, acid reflux, bowel problems. Endoscopy, colonoscopy.",
        metadata: { type: "specialist", category: "gastroenterology" }
      },

      // Emergency indicators
      {
        id: uuidv4(),
        document: "Emergency symptoms requiring immediate medical attention: chest pain, difficulty breathing, severe bleeding, loss of consciousness, severe burns, suspected poisoning.",
        metadata: { type: "emergency", severity: "critical" }
      },
      {
        id: uuidv4(),
        document: "Stroke symptoms: sudden numbness, confusion, trouble speaking, severe headache, vision problems, loss of balance. Call emergency services immediately.",
        metadata: { type: "emergency", category: "stroke", severity: "critical" }
      },

      // Nutrition and Food Information
      {
        id: uuidv4(),
        document: "Banana: Rich in potassium (358mg), vitamin B6, vitamin C, dietary fiber. Good for heart health, muscle function, and energy. 105 calories per medium banana. Natural sugars provide quick energy.",
        metadata: { type: "nutrition", category: "fruit", calories: 105, benefits: ["heart", "energy", "muscle"] }
      },
      {
        id: uuidv4(),
        document: "Apple: High in fiber, vitamin C, antioxidants. Low calorie (95 per medium apple). Pectin helps lower cholesterol. Good for digestive health and weight management.",
        metadata: { type: "nutrition", category: "fruit", calories: 95, benefits: ["digestive", "weight", "antioxidant"] }
      },
      {
        id: uuidv4(),
        document: "Spinach: Excellent source of iron, vitamin K, vitamin A, folate, magnesium. Low calorie (7 per cup). Supports bone health, blood formation, and immune system.",
        metadata: { type: "nutrition", category: "vegetable", calories: 7, benefits: ["bone", "blood", "immune"] }
      },
      {
        id: uuidv4(),
        document: "Broccoli: High in vitamin C, vitamin K, fiber, antioxidants. Contains sulforaphane for cancer protection. 25 calories per cup. Supports immune and heart health.",
        metadata: { type: "nutrition", category: "vegetable", calories: 25, benefits: ["immune", "heart", "cancer-prevention"] }
      },
      {
        id: uuidv4(),
        document: "Salmon: Rich in omega-3 fatty acids, high-quality protein, vitamin D, selenium. 206 calories per 100g. Reduces inflammation, supports brain and heart health.",
        metadata: { type: "nutrition", category: "fish", calories: 206, benefits: ["brain", "heart", "anti-inflammatory"] }
      },
      {
        id: uuidv4(),
        document: "Chicken breast: Lean protein (31g per 100g), B vitamins, selenium, phosphorus. 165 calories per 100g. Supports muscle building, metabolism, and immune function.",
        metadata: { type: "nutrition", category: "protein", calories: 165, benefits: ["muscle", "metabolism", "immune"] }
      },
      {
        id: uuidv4(),
        document: "Quinoa: Complete protein containing all 9 essential amino acids, fiber, iron, magnesium. 222 calories per cooked cup. Gluten-free grain alternative.",
        metadata: { type: "nutrition", category: "grain", calories: 222, benefits: ["protein", "gluten-free", "mineral"] }
      },
      {
        id: uuidv4(),
        document: "Greek yogurt: High protein (20g per cup), probiotics, calcium, B vitamins. 130 calories per cup plain. Supports digestive health and bone strength.",
        metadata: { type: "nutrition", category: "dairy", calories: 130, benefits: ["digestive", "bone", "protein"] }
      },
      {
        id: uuidv4(),
        document: "Avocado: Healthy monounsaturated fats, fiber, potassium, vitamin K. 234 calories per medium avocado. Supports heart health and nutrient absorption.",
        metadata: { type: "nutrition", category: "fruit", calories: 234, benefits: ["heart", "absorption", "healthy-fats"] }
      },
      {
        id: uuidv4(),
        document: "Sweet potato: Beta-carotene, fiber, potassium, vitamin A. 112 calories per medium potato. Supports eye health, immune system, and blood sugar regulation.",
        metadata: { type: "nutrition", category: "vegetable", calories: 112, benefits: ["eye", "immune", "blood-sugar"] }
      },
      {
        id: uuidv4(),
        document: "Oats: Soluble fiber (beta-glucan), protein, B vitamins, minerals. 154 calories per cooked cup. Helps lower cholesterol and stabilize blood sugar.",
        metadata: { type: "nutrition", category: "grain", calories: 154, benefits: ["cholesterol", "blood-sugar", "fiber"] }
      },
      {
        id: uuidv4(),
        document: "Almonds: Healthy fats, protein, vitamin E, magnesium, fiber. 161 calories per ounce (23 nuts). Supports heart health and blood sugar control.",
        metadata: { type: "nutrition", category: "nut", calories: 161, benefits: ["heart", "blood-sugar", "vitamin-e"] }
      },
      {
        id: uuidv4(),
        document: "Dark chocolate (70%+ cacao): Antioxidants, iron, magnesium, flavonoids. 170 calories per ounce. May improve brain function and reduce inflammation in moderation.",
        metadata: { type: "nutrition", category: "treat", calories: 170, benefits: ["brain", "antioxidant", "moderation"] }
      },
      {
        id: uuidv4(),
        document: "Green tea: Antioxidants (catechins), L-theanine, minimal calories. May boost metabolism, improve brain function, and reduce disease risk. Limit caffeine intake.",
        metadata: { type: "nutrition", category: "beverage", calories: 2, benefits: ["metabolism", "brain", "antioxidant"] }
      },
      {
        id: uuidv4(),
        document: "Beans and legumes: High fiber, plant protein, folate, iron, potassium. 245 calories per cooked cup. Support digestive health and blood sugar control.",
        metadata: { type: "nutrition", category: "legume", calories: 245, benefits: ["digestive", "blood-sugar", "protein"] }
      }
    ];

    // Store medical knowledge in memory
    this.medicalKnowledge = medicalData;
    console.log(`✅ Loaded ${medicalData.length} medical documents into memory`);
  }

  // Simple text similarity using keyword matching (no embeddings needed)
  calculateSimilarity(query, document) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const docWords = document.toLowerCase().split(/\s+/);
    
    let matches = 0;
    queryWords.forEach(word => {
      if (docWords.some(docWord => docWord.includes(word) || word.includes(docWord))) {
        matches++;
      }
    });
    
    return matches / queryWords.length;
  }

  async retrieveRelevantContext(query, limit = 5) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Simple similarity search using keyword matching
      const scoredDocuments = this.medicalKnowledge.map(item => ({
        ...item,
        score: this.calculateSimilarity(query, item.document)
      }));

      // Sort by similarity score and take top results
      const relevantDocs = scoredDocuments
        .filter(doc => doc.score > 0.1) // Only include docs with some relevance
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return relevantDocs;
    } catch (error) {
      console.error('Error retrieving context:', error);
      return [];
    }
  }

  async ragAnalyzeSymptoms(symptoms) {
    try {
      // Step 1: Retrieve relevant medical context
      const relevantContext = await this.retrieveRelevantContext(symptoms, 5);
      
      if (relevantContext.length === 0) {
        // Fallback to non-RAG if no context found
        return this.fallbackAnalysis(symptoms);
      }

      // Step 2: Build augmented prompt with retrieved context
      const contextText = relevantContext
        .filter(doc => doc.score > 0.3) // Only use relevant docs
        .map(doc => `- ${doc.document}`)
        .join('\n');

      const augmentedPrompt = `
You are a medical assistant analyzing symptoms. Use the following medical knowledge to provide accurate guidance:

RELEVANT MEDICAL KNOWLEDGE:
${contextText}

PATIENT SYMPTOMS: "${symptoms}"

Based on the medical knowledge above and the patient's symptoms, provide:

1. **Possible Conditions**: List 2-3 most likely conditions
2. **Recommended Specialist**: Which doctor to consult
3. **Urgency Level**: Emergency/Urgent/Routine
4. **Immediate Actions**: What to do now
5. **Red Flags**: Warning signs to watch for

If this appears to be an emergency based on the medical knowledge, start your response with "🚨 EMERGENCY" and recommend immediate medical attention.

Format your response clearly and avoid giving definitive diagnoses.
`;

      return {
        prompt: augmentedPrompt,
        context: relevantContext,
        isRAGEnhanced: true
      };

    } catch (error) {
      console.error('RAG Analysis Error:', error);
      return this.fallbackAnalysis(symptoms);
    }
  }

  fallbackAnalysis(symptoms) {
    return {
      prompt: `Analyze these symptoms: "${symptoms}". Provide possible causes and recommended specialist.`,
      context: [],
      isRAGEnhanced: false
    };
  }

  async ragAnalyzeNutrition(foodQuery) {
    try {
      // Step 1: Retrieve relevant nutrition context
      const relevantContext = await this.retrieveRelevantContext(foodQuery, 8);
      
      if (relevantContext.length === 0) {
        // Fallback to non-RAG if no context found
        return this.fallbackNutritionAnalysis(foodQuery);
      }

      // Step 2: Build augmented prompt with retrieved nutrition context
      const contextText = relevantContext
        .filter(doc => doc.similarity > 0.6) // Slightly lower threshold for nutrition
        .map(doc => `- ${doc.content}`)
        .join('\n');

      const augmentedPrompt = `
You are a nutrition expert providing food and dietary guidance. Use the following nutritional knowledge to give accurate information:

RELEVANT NUTRITIONAL KNOWLEDGE:
${contextText}

USER FOOD QUERY: "${foodQuery}"

Based on the nutritional knowledge above and the user's query, provide:

1. **Nutritional Profile**: Key nutrients, calories, vitamins, minerals
2. **Health Benefits**: Specific health advantages
3. **Serving Recommendations**: Portion sizes and frequency
4. **Preparation Tips**: Best ways to prepare or consume
5. **Dietary Considerations**: Any warnings, allergies, or interactions
6. **Similar Foods**: Other foods with comparable benefits

If asking about a specific diet plan or weight management, include relevant calorie and macronutrient information.

Format your response in a helpful, easy-to-understand manner with practical advice.
`;

      return {
        prompt: augmentedPrompt,
        context: relevantContext,
        isRAGEnhanced: true,
        type: 'nutrition'
      };

    } catch (error) {
      console.error('RAG Nutrition Analysis Error:', error);
      return this.fallbackNutritionAnalysis(foodQuery);
    }
  }

  fallbackNutritionAnalysis(foodQuery) {
    return {
      prompt: `Provide nutritional information about: "${foodQuery}". Include calories, nutrients, health benefits, and serving suggestions.`,
      context: [],
      isRAGEnhanced: false,
      type: 'nutrition'
    };
  }

  // Method to add new medical knowledge
  async addMedicalDocument(document, metadata) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const id = uuidv4();
      const embedding = await this.generateEmbeddings([document]);

      await this.collection.add({
        ids: [id],
        embeddings: embedding,
        documents: [document],
        metadatas: [metadata]
      });

      return { success: true, id };
    } catch (error) {
      console.error('Error adding document:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RAGService();
