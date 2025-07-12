-- Enhanced Medical Knowledge Base Schema for RAG

-- Medical conditions database for symptom-to-condition matching
CREATE TABLE IF NOT EXISTS medical_conditions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    condition_name VARCHAR(255) NOT NULL,
    symptoms TEXT NOT NULL,
    specialist VARCHAR(100) NOT NULL,
    urgency_level ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
    description TEXT,
    common_age_group VARCHAR(50),
    gender_preference ENUM('Male', 'Female', 'Both') DEFAULT 'Both',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FULLTEXT(symptoms, description)
);

-- Medicines database for drug interactions and side effects
CREATE TABLE IF NOT EXISTS medicines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    medicine_type ENUM('Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops') NOT NULL,
    interactions TEXT,
    side_effects TEXT,
    contraindications TEXT,
    dosage_info TEXT,
    storage_conditions VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FULLTEXT(medicine_name, interactions, side_effects, contraindications)
);

-- Lab test reference values for report analysis
CREATE TABLE IF NOT EXISTS lab_references (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_name VARCHAR(255) NOT NULL,
    normal_range_min DECIMAL(10,3),
    normal_range_max DECIMAL(10,3),
    unit VARCHAR(50),
    interpretation_low TEXT,
    interpretation_high TEXT,
    recommended_action TEXT,
    specialist_referral VARCHAR(100),
    FULLTEXT(test_name, interpretation_low, interpretation_high)
);

-- Medical knowledge base for general health information
CREATE TABLE IF NOT EXISTS medical_knowledge (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    category ENUM('Symptom', 'Disease', 'Treatment', 'Prevention', 'Nutrition', 'Exercise') NOT NULL,
    content TEXT NOT NULL,
    tags VARCHAR(500),
    reliability_score INT DEFAULT 5,
    source VARCHAR(255),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FULLTEXT(topic, content, tags)
);

-- Insert sample medical conditions data
INSERT INTO medical_conditions (condition_name, symptoms, specialist, urgency_level, description) VALUES
('Acute Appendicitis', 'abdominal pain, nausea, vomiting, fever, loss of appetite, pain in right lower abdomen', 'Gastroenterologist', 'Critical', 'Inflammation of the appendix requiring immediate medical attention'),
('Myocardial Infarction', 'chest pain, shortness of breath, sweating, nausea, arm pain, jaw pain', 'Cardiologist', 'Critical', 'Heart attack requiring emergency care'),
('Hypertension', 'headache, dizziness, blurred vision, chest pain, shortness of breath', 'Cardiologist', 'High', 'High blood pressure that needs monitoring and treatment'),
('Type 2 Diabetes', 'frequent urination, excessive thirst, fatigue, blurred vision, slow healing wounds', 'Endocrinologist', 'Medium', 'Metabolic disorder affecting blood sugar levels'),
('Migraine', 'severe headache, nausea, sensitivity to light, visual disturbances', 'Neurologist', 'Medium', 'Recurrent headache disorder'),
('Pneumonia', 'cough, fever, shortness of breath, chest pain, fatigue', 'Pulmonologist', 'High', 'Lung infection requiring prompt treatment'),
('Gastroenteritis', 'diarrhea, vomiting, abdominal cramps, fever, dehydration', 'Gastroenterologist', 'Medium', 'Stomach and intestine inflammation'),
('Anxiety Disorder', 'excessive worry, restlessness, fatigue, difficulty concentrating, sleep problems', 'Psychiatrist', 'Medium', 'Mental health condition affecting daily life');

-- Insert sample medicines data
INSERT INTO medicines (medicine_name, generic_name, medicine_type, interactions, side_effects, contraindications, dosage_info) VALUES
('Paracetamol', 'Acetaminophen', 'Tablet', 'Warfarin increases bleeding risk', 'Nausea, skin rash, liver damage in overdose', 'Severe liver disease', '500mg every 6 hours, max 4g daily'),
('Aspirin', 'Acetylsalicylic Acid', 'Tablet', 'Warfarin, NSAIDs increase bleeding risk', 'Stomach upset, bleeding, tinnitus', 'Active bleeding, children under 16', '75-100mg daily for prevention'),
('Metformin', 'Metformin HCl', 'Tablet', 'Contrast dyes, alcohol', 'Nausea, diarrhea, lactic acidosis rare', 'Kidney disease, liver disease', '500mg twice daily with meals'),
('Lisinopril', 'Lisinopril', 'Tablet', 'NSAIDs, potassium supplements', 'Dry cough, hyperkalemia, angioedema', 'Pregnancy, bilateral renal artery stenosis', '10-20mg once daily'),
('Atorvastatin', 'Atorvastatin', 'Tablet', 'Grapefruit juice, certain antibiotics', 'Muscle pain, liver enzyme elevation', 'Active liver disease, pregnancy', '20-40mg once daily'),
('Omeprazole', 'Omeprazole', 'Capsule', 'Clopidogrel effectiveness reduced', 'Headache, nausea, diarrhea, B12 deficiency', 'Severe liver impairment', '20mg once daily before meals');

-- Insert sample lab reference values
INSERT INTO lab_references (test_name, normal_range_min, normal_range_max, unit, interpretation_low, interpretation_high, recommended_action, specialist_referral) VALUES
('Hemoglobin', 12.0, 16.0, 'g/dL', 'Anemia, blood loss, nutritional deficiency', 'Polycythemia, dehydration', 'Repeat test, check iron levels', 'Hematologist'),
('Blood Glucose Fasting', 70, 100, 'mg/dL', 'Hypoglycemia, excessive insulin', 'Diabetes, prediabetes', 'Dietary counseling, HbA1c test', 'Endocrinologist'),
('Total Cholesterol', 0, 200, 'mg/dL', 'Malnutrition, liver disease', 'Cardiovascular risk, dietary issues', 'Lipid profile, lifestyle changes', 'Cardiologist'),
('Blood Pressure Systolic', 90, 120, 'mmHg', 'Hypotension, shock', 'Hypertension, cardiovascular risk', 'Lifestyle modification, medication', 'Cardiologist'),
('Creatinine', 0.6, 1.2, 'mg/dL', 'Muscle wasting, low protein', 'Kidney dysfunction', 'Kidney function tests, hydration', 'Nephrologist');

-- Insert sample medical knowledge
INSERT INTO medical_knowledge (topic, category, content, tags) VALUES
('Heart Attack Prevention', 'Prevention', 'Regular exercise, healthy diet, avoid smoking, manage stress, control blood pressure and cholesterol levels', 'heart, prevention, lifestyle, cardiovascular'),
('Diabetes Management', 'Treatment', 'Monitor blood sugar regularly, take medications as prescribed, follow diabetic diet, exercise regularly, check feet daily', 'diabetes, management, blood sugar, diet'),
('High Blood Pressure Diet', 'Nutrition', 'Reduce sodium intake, increase potassium-rich foods, limit alcohol, maintain healthy weight, eat plenty of fruits and vegetables', 'hypertension, diet, nutrition, sodium'),
('Stress Management', 'Prevention', 'Practice deep breathing, regular exercise, adequate sleep, meditation, time management, social support', 'stress, mental health, relaxation, lifestyle');
