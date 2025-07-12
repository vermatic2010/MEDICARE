npm(node package manager) - default package manager for nodejs
nvm(node version manager) - allows to switch between mutiple nodejs versions
nodejs - allows to run javascript outide of the browser like server
npm i - npm install - intalls packages from package.json
nodemon - automatically restarts nodejs server on file changes
express.js - web framework for nodejs to build web applications and APIs
nodemailer - module to send emails using services like gmail,outlook,SMTP
twilio - cloud communications platform for sending SMS, voice calls, and more using APIs

npm i in both terminals
cd client   
cd server 
package.json is there in 3 places, one in main, other two in client and server

npm start --> in client terminal
node index.js --> in server terminal

*** SETUP NOTES ***
- ChromaDB dependency removed to fix installation conflicts
- RAG service now works in-memory (no vector database needed)
- SMS notifications: ENABLED with real Twilio credentials
- Run test-twilio-sms.bat to test SMS functionality
- NotificationService temporarily bypassed to fix syntax errors
- Run final-server-test.bat to verify server startup
- Restart server after credential changes to enable SMS
- BMI calculation bug FIXED (was incorrectly swapping weight/height values)
- Medicine entry format IMPROVED (now accepts entries with or without dashes)
- PRESCRIPTION NOTIFICATIONS: ENABLED - Patients automatically receive SMS + Email when doctors prescribe medicine (automatic only)


*** PATIENTS list ***


*** DOCTORS list ***


*** FEATURES ***

1. signup passwords for patients and doctors are hashed using bcryptjs
const password_hash = await bcrypt.hash(password, 10); in authRoutes.js

2. there are validation checks for login using username and password for patients and doctors in SignUpLogin.js

3. intent - what the user wants to do
   enitity - the specific details needed to fulfill the intent

*** DEMO ***
1. WELLNESS CHAT
- Click "🍎 Food Nutrition" button → Bot asks for food item → Type "guava" → Should get nutrition info
- Click "🧘 Yoga" button → Bot asks for health goal → Type "yoga for back pain" → Should get yoga advice
- Type naturally: "my weight is 70kg height 175cm" → Should calculate BMI (pattern matching)
- Type naturally: "weight is 90kg and height is 170cm" → Should calculate BMI (pattern matching)
- Type naturally: "90kg 170cm" → Should calculate BMI (pattern matching)
- Type naturally: "my BP is 120/80" → Should analyze blood pressure (pattern matching)
- Type naturally: "blood pressure 140 over 90" → Should analyze BP (pattern matching)
- Type naturally: "nutrition for apple" → Should get food nutrition (pattern matching)
- Type naturally: "nutrition list of apple" → Should get nutrition info (pattern matching)
- Type naturally: "apple nutrition" → Should get nutrition info (pattern matching)
- Type naturally: "calories in banana" → Should get nutrition info (pattern matching)
- Type naturally: "yoga for stress" → Should get yoga advice (pattern matching) 

*** DDL ***
1. 
CREATE TABLE `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `doctor_id` int DEFAULT NULL,
  `appointment_time` datetime DEFAULT NULL,
  `status` varchar(30) DEFAULT 'scheduled',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
)

2.
CREATE TABLE `patients` ( 
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `gender` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`)
)

3.
CREATE TABLE `doctors` (
 `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `specialization` varchar(100) DEFAULT NULL,
  `license` varchar(50) DEFAULT NULL,
  `experience` int DEFAULT NULL,
  `hospital` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`)
)

4.
CREATE TABLE `prescriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `doctor_id` int DEFAULT NULL,
  `medicine_name` varchar(255) NOT NULL,
  `dosage` varchar(100) NOT NULL,
  `duration` varchar(100) NOT NULL,
  `instructions` text,
  `prescribed_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive','completed') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patient_id` (`patient_id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_status` (`status`),
  KEY `idx_prescribed_date` (`prescribed_date`),
  CONSTRAINT `prescriptions_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_2` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL
)

5.
CREATE TABLE `doctor_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `doctor_id` int DEFAULT NULL,
  `day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `doctor_id` (`doctor_id`),
  CONSTRAINT `doctor_availability_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
)


**PROMPTS**
- BMI
1. "Calculate my BMI with weight 70kg and height 175cm"
2. "My weight is 90kg and height is 170cm, what is my BMI?" 
-BP
1. "My blood pressure is 140 over 90"
2."My bp is 120 over 80, is it normal?"
-Yoga
1. "Suggest yoga for back pain"
2. "give me yoga for ankle pain"
- Nutrition
1. "Suggest a balanced diet plan for weight loss"
2. "What are some healthy snacks for weight loss?"
- symptum cheker
1. "I have chest pain"
2. "I have a headache and fever, what could it be?"
- prescription
1. "give me my all prescription history"
- appointment
1. "I want to book an apppointment"
