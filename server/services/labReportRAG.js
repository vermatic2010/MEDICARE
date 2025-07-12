// Lab Report Analysis with RAG
const medicalRAG = require("../services/medicalRAG");

class LabReportRAG {
  constructor() {
    this.commonTests = [
      'hemoglobin', 'glucose', 'cholesterol', 'creatinine', 'bilirubin',
      'triglycerides', 'urea', 'sodium', 'potassium', 'calcium'
    ];
  }

  async analyzeLabReport(reportText, patientId = null) {
    try {
      // Extract test values from report
      const extractedValues = this.extractLabValues(reportText);
      
      // Get reference ranges from database
      const referenceData = await this.getReferenceRanges(extractedValues);
      
      // Get patient context if available
      const patientContext = patientId ? await medicalRAG.getPatientContext(patientId) : null;

      // Analyze with context
      const analysis = await this.generateLabAnalysis(extractedValues, referenceData, patientContext);
      
      return analysis;
    } catch (error) {
      console.error("Lab report RAG error:", error);
      throw error;
    }
  }

  extractLabValues(reportText) {
    const values = {};
    const lines = reportText.split('\n');
    
    // Common patterns for lab values
    const patterns = [
      /(\w+(?:\s+\w+)*)\s*:?\s*(\d+\.?\d*)\s*(\w+\/?\w*)/gi,
      /(\w+)\s*[-–]\s*(\d+\.?\d*)\s*(\w+)/gi,
      /(\w+)\s*(\d+\.?\d*)\s*\((\d+\.?\d*)\s*-\s*(\d+\.?\d*)\)/gi
    ];

    lines.forEach(line => {
      patterns.forEach(pattern => {
        const matches = [...line.matchAll(pattern)];
        matches.forEach(match => {
          const testName = match[1].toLowerCase().trim();
          const value = parseFloat(match[2]);
          const unit = match[3] || '';
          
          if (!isNaN(value)) {
            values[testName] = { value, unit, original: match[0] };
          }
        });
      });
    });

    return values;
  }

  async getReferenceRanges(extractedValues) {
    const testNames = Object.keys(extractedValues);
    if (testNames.length === 0) return [];

    try {
      const placeholders = testNames.map(() => '?').join(',');
      const [ranges] = await medicalRAG.db.query(`
        SELECT test_name, normal_range_min, normal_range_max, unit,
               interpretation_low, interpretation_high, specialist_referral
        FROM lab_references
        WHERE LOWER(test_name) IN (${placeholders})
      `, testNames);

      return ranges;
    } catch (error) {
      console.error("Reference range lookup error:", error);
      return [];
    }
  }

  async generateLabAnalysis(extractedValues, referenceData, patientContext) {
    const genAI = new (require("@google/generative-ai").GoogleGenerativeAI)(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are a medical AI analyzing lab results with access to reference ranges and patient context.

EXTRACTED LAB VALUES:
${JSON.stringify(extractedValues, null, 2)}

REFERENCE RANGES:
${JSON.stringify(referenceData, null, 2)}

PATIENT CONTEXT:
${patientContext ? JSON.stringify(patientContext, null, 2) : "No patient history available"}

Provide analysis in this format:

**Lab Report Summary**: [Brief overview of tests performed]

**Abnormal Results**: [List values outside normal ranges with explanations]

**Normal Results**: [Key normal values for reassurance]

**Clinical Significance**: [What these results might indicate]

**Recommended Specialist**: [Based on abnormal results]

**Follow-up Actions**: [What patient should do next]

**Lifestyle Recommendations**: [Diet, exercise, lifestyle changes]

Always end with: "Would you like to book an appointment with the recommended specialist? (Reply 'yes' to proceed)"
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

module.exports = new LabReportRAG();
