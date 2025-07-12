// Medical Knowledge Base RAG Service
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mysql = require("mysql2/promise");

class MedicalRAG {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    this.db = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "1234",
      database: "medicare",
    });
  }

  // RAG for symptom analysis with medical knowledge
  async analyzeSymptomWithRAG(symptoms, patientHistory = null) {
    try {
      // Retrieve relevant medical knowledge from database
      const relevantData = await this.retrieveMedicalContext(symptoms);
      
      // Get patient's medical history if available
      const patientContext = patientHistory ? await this.getPatientContext(patientHistory) : "";
      
      const prompt = `
You are an expert medical AI with access to medical knowledge and patient context.

MEDICAL KNOWLEDGE:
${relevantData}

PATIENT CONTEXT:
${patientContext}

REPORTED SYMPTOMS: "${symptoms}"

Provide analysis using the following structured format:

**Risk Assessment**: [Low/Medium/High/Critical based on knowledge base]
**Possible Conditions**: [Top 3 conditions from medical knowledge]
**Recommended Specialist**: [Specific doctor type with reasoning]
**Urgency Timeline**: [When to seek care - immediately/within 24h/within week]
**Red Flags**: [Warning signs to watch for]
**Self-Care**: [Safe immediate actions]

Always end with: "Would you like to book an appointment with the recommended specialist? (Reply 'yes' to proceed)"
`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Medical RAG error:", error);
      throw error;
    }
  }

  // Retrieve relevant medical information
  async retrieveMedicalContext(symptoms) {
    try {
      // Search medical conditions database
      const [conditions] = await this.db.query(`
        SELECT condition_name, symptoms, specialist, urgency_level, description 
        FROM medical_conditions 
        WHERE MATCH(symptoms, description) AGAINST(? IN NATURAL LANGUAGE MODE)
        LIMIT 5
      `, [symptoms]);

      // Search drug interactions if patient has medicines
      const [interactions] = await this.db.query(`
        SELECT medicine_name, interactions, side_effects 
        FROM medicines 
        WHERE MATCH(side_effects) AGAINST(? IN NATURAL LANGUAGE MODE)
        LIMIT 3
      `, [symptoms]);

      return {
        conditions: conditions,
        possibleInteractions: interactions
      };
    } catch (error) {
      console.error("Medical context retrieval error:", error);
      return { conditions: [], possibleInteractions: [] };
    }
  }

  // Get patient's medical history for context
  async getPatientContext(patientId) {
    try {
      const [appointments] = await this.db.query(`
        SELECT a.appointment_time, d.specialization, a.status
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_time DESC
        LIMIT 5
      `, [patientId]);

      const [prescriptions] = await this.db.query(`
        SELECT medicine_name, dosage, start_date, end_date
        FROM prescriptions
        WHERE patient_id = ? AND (end_date IS NULL OR end_date > NOW())
      `, [patientId]);

      return {
        recentAppointments: appointments,
        currentMedications: prescriptions
      };
    } catch (error) {
      console.error("Patient context error:", error);
      return { recentAppointments: [], currentMedications: [] };
    }
  }

  // RAG for prescription analysis
  async analyzePrescriptionWithRAG(prescriptionText, patientId = null) {
    try {
      // Get drug interaction database
      const drugContext = await this.getDrugInteractions(prescriptionText);
      
      // Get patient's current medications
      const patientMeds = patientId ? await this.getPatientCurrentMeds(patientId) : [];

      const prompt = `
You are a pharmaceutical expert with access to drug databases.

PRESCRIPTION TEXT:
${prescriptionText}

DRUG DATABASE INFO:
${JSON.stringify(drugContext)}

PATIENT'S CURRENT MEDICATIONS:
${JSON.stringify(patientMeds)}

Analyze and provide:

**Prescribed Medicines**: [List with purposes and dosages]
**Drug Interactions**: [Check against current medications]
**Side Effects**: [Common and serious side effects to watch]
**Contraindications**: [When not to take these medicines]
**Lifestyle Advice**: [Diet, activity restrictions]
**Follow-up**: [When to see doctor again]

Always end with: "Would you like to book a follow-up appointment with your doctor? (Reply 'yes' to proceed)"
`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Prescription RAG error:", error);
      throw error;
    }
  }

  async getDrugInteractions(prescriptionText) {
    // Extract medicine names from prescription text
    const medicineNames = this.extractMedicineNames(prescriptionText);
    
    if (medicineNames.length === 0) return [];

    try {
      const placeholders = medicineNames.map(() => '?').join(',');
      const [interactions] = await this.db.query(`
        SELECT medicine_name, interactions, side_effects, contraindications
        FROM medicines
        WHERE medicine_name IN (${placeholders})
      `, medicineNames);

      return interactions;
    } catch (error) {
      console.error("Drug interaction lookup error:", error);
      return [];
    }
  }

  extractMedicineNames(text) {
    // Simple regex to extract common medicine patterns
    const patterns = [
      /\b[A-Z][a-z]+(?:cin|zole|pril|sartan|olol|pine|ine|ate|ide)\b/g, // Common drug suffixes
      /\b(?:Tab|Cap|Syp|Inj)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, // Tab/Cap patterns
    ];
    
    const medicines = [];
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) medicines.push(...matches);
    });
    
    return [...new Set(medicines)]; // Remove duplicates
  }

  async getPatientCurrentMeds(patientId) {
    try {
      const [meds] = await this.db.query(`
        SELECT medicine_name, dosage
        FROM prescriptions
        WHERE patient_id = ? AND (end_date IS NULL OR end_date > NOW())
      `, [patientId]);
      
      return meds;
    } catch (error) {
      console.error("Patient medications error:", error);
      return [];
    }
  }
}

module.exports = new MedicalRAG();
