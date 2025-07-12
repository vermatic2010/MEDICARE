import React, { useState } from "react";
import ChatWindow from "../components/ChatWindow";

const SmartTriage = ({ role = "patient", user, onNavigate }) => {
  const [chat, setChat] = useState([
    {
      sender: "bot",
      text:
        role === "doctor"
          ? "Welcome Doctor! Use the buttons below to view appointments, check symptoms, or upload a prescription. You can also type natural language requests like 'show patient 1 medicines' or 'check john's active prescriptions'. (🔬 Symptom analysis uses RAG-enhanced medical knowledge!)"
          : "Welcome to Smart Triage! Use buttons below to start symptom checker, upload prescription, book appointment, view your appointments, or check prescription history. You can also type natural language requests like 'show my recent 3 prescriptions' or 'book appointment with cardiologist'. (🔬 Symptom analysis uses RAG-enhanced medical knowledge!)",
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [awaitingSymptoms, setAwaitingSymptoms] = useState(false);
  const [awaitingBooking, setAwaitingBooking] = useState(null);
  const [suggestedSpecialist, setSuggestedSpecialist] = useState(null);
  const [doctorListCache, setDoctorListCache] = useState(null);
  const [awaitingMedicineInput, setAwaitingMedicineInput] = useState(false);
  const [awaitingPatientId, setAwaitingPatientId] = useState(false);
  const [awaitingPrescriptionChoice, setAwaitingPrescriptionChoice] = useState(false);

  // Buttons for both doctor and patient
  const commonButtons = [
    { label: "🩺 Symptom Checker", type: "symptom_checker" },
    { label: "📄 Upload Prescription", type: "upload_prescription" },
  ];
  const patientButtons = [
    ...commonButtons,
    { label: "📅 Book Appointment", type: "book_appointment" },
    { label: "📋 My Appointments", type: "view_my_appointments" },
    { label: "📜 Prescription History", type: "view_prescription_history" }
  ];
  const doctorButtons = [
    ...commonButtons,
    { label: "📆 View Appointments", type: "view_appointments" },
    { label: "💊 Add Medicine for Patient", type: "add_medicine" },
    { label: "📋 View Patient Medicine History", type: "view_patient_medicines" }
  ];

  const buttons = role === "doctor" ? doctorButtons : patientButtons;

  // Gemini AI-powered intent detection and entity extraction (NOT RAG - just parsing)
  const geminiParseInput = async (input, context = "general") => {
    try {
      const response = await fetch("http://localhost:3001/api/ai-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "comprehensive-intent-extraction",
          userInput: input,
          context: context // "patient", "doctor", or "general"
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const cleanResponse = data.response.replace(/```json|```/g, '').trim();
        
        try {
          return JSON.parse(cleanResponse);
        } catch (parseError) {
          console.log("Failed to parse Gemini response:", parseError);
          return null;
        }
      }
    } catch (error) {
      console.log("Gemini parsing failed:", error);
    }
    return null;
  };

  // Enhanced intent detection with comprehensive Gemini AI support
  const detectIntent = async (input) => {
    const text = input.toLowerCase();
    
    // Use Gemini for comprehensive intent and entity extraction
    const geminiResult = await geminiParseInput(input, role);
    
    if (geminiResult) {
      // Handle complex extracted intents
      switch (geminiResult.intent) {
        case "prescription_history":
          return {
            type: "view_prescription_history",
            count: geminiResult.count,
            timeframe: geminiResult.timeframe
          };
        
        case "book_appointment":
          return {
            type: "book_appointment",
            doctor_id: geminiResult.doctor_id,
            specialist: geminiResult.specialist,
            date: geminiResult.date,
            time: geminiResult.time
          };
        
        case "patient_lookup":
          return {
            type: geminiResult.action || "view_patient_medicines",
            patient_identifier: geminiResult.patient_identifier,
            patient_type: geminiResult.patient_type
          };
        
        case "medicine_add":
          return {
            type: "add_medicine",
            patient_identifier: geminiResult.patient_identifier,
            medicines: geminiResult.medicines
          };
        
        case "symptom_check":
          return {
            type: "symptom_checker",
            symptoms: geminiResult.symptoms
          };
        
        case "appointment_view":
          return {
            type: geminiResult.target === "doctor" ? "view_appointments" : "view_my_appointments"
          };
        
        default:
          // Map other intents to existing types
          if (geminiResult.intent) {
            return { type: geminiResult.intent };
          }
      }
    }
    
    // Fallback to quick regex-based detection for common patterns
    if (/book.*appointment/.test(text)) return { type: "book_appointment" };
    if (/view.*appointment/.test(text) || /my.*appointment/.test(text)) return { type: "view_my_appointments" };
    if (/symptom|check.*symptom/.test(text)) return { type: "symptom_checker" };
    if (/upload.*prescription/.test(text)) return { type: "upload_prescription" };
    if (/patient.*medicine|medicine.*history|patient.*prescription/.test(text)) return { type: "view_patient_medicines" };
    
    // Enhanced prescription history detection with number parsing
    const prescriptionPatterns = [
      /prescription.*list|last.*prescription|prescription.*history/,
      /recent.*prescription|latest.*prescription/,
      /my.*prescription|get.*prescription|fetch.*prescription/,
      /show.*prescription|list.*prescription/
    ];
    
    if (prescriptionPatterns.some(pattern => pattern.test(text))) {
      return { type: "view_prescription_history" };
    }
    
    return null;
  };

  // TRUE RAG: analyzeSymptoms uses medical knowledge database
  const analyzeSymptoms = async (symptoms) => {
    try {
      setIsAnalyzing(true);
      setAwaitingSymptoms(false);
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Analyzing your symptoms...", isLoading: true },
      ]);
      const response = await fetch("http://localhost:3001/api/ai-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "symptom-specialist",
          userInput: `Given these symptoms: "${symptoms}", what are the possible diseases and which specialist should the patient consult? Respond with:\nPossible diseases: <list>\nRecommended specialist: <specialist>\nIf serious, add: "Would you like to book an appointment with a <specialist>? (Type yes to proceed)"`,
        }),
      });
      if (!response.ok) throw new Error("Failed to analyze symptoms");
      const data = await response.json();
      let analysisText = data.response.replace(/\n/g, "\n");
      const specialistMatch = analysisText.match(/Recommended specialist:\s*([^\n]+)/i);
      let specialist = null;
      if (specialistMatch) {
        specialist = specialistMatch[1].trim();
        setSuggestedSpecialist(specialist);
      } else {
        setSuggestedSpecialist(null);
      }
      if (/would you like to book an appointment/i.test(analysisText) && specialist) {
        setAwaitingBooking(specialist);
      } else {
        setAwaitingBooking(null);
      }
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { sender: "bot", text: analysisText },
      ]);
    } catch (error) {
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { sender: "bot", text: "Sorry, I couldn't analyze your symptoms right now. Please try again later." },
      ]);
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // STRUCTURED PROMPTING: prescription explanation (NOT RAG - just AI parsing)
  const explainPrescription = async (prescriptionText) => {
    try {
      setIsAnalyzing(true);
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Explaining your prescription...", isLoading: true },
      ]);
      const response = await fetch("http://localhost:3001/api/ai-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "prescription",
          userInput: `Explain this prescription in simple terms for a patient:\n${prescriptionText}`,
        }),
      });
      if (!response.ok) throw new Error("Failed to analyze prescription");
      const data = await response.json();
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { sender: "bot", text: `📝 Prescription explained:\n\n${data.response.replace(/\n/g, "\n")}` },
      ]);
    } catch (error) {
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { sender: "bot", text: "Sorry, I couldn't analyze your prescription right now. Please try again later." },
      ]);
      console.error("Prescription analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle file upload for prescriptions
  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp',
      'application/pdf', 'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "❌ Unsupported file type. Please upload an image (JPG, PNG), PDF, or text file." },
      ]);
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "❌ File too large. Please upload a file smaller than 10MB." },
      ]);
      return;
    }

    try {
      setIsAnalyzing(true);
      setChat((prev) => [
        ...prev,
        { sender: "user", text: `📎 Uploaded: ${file.name}` },
        { sender: "bot", text: "📋 Analyzing your medical document...", isLoading: true },
      ]);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'prescription');

      const response = await fetch("http://localhost:3001/api/ai-response", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to analyze document");
      
      const data = await response.json();
      
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { 
          sender: "bot", 
          text: `📋 **Medical Document Analysis:**\n\n${data.response}`
        },
      ]);
    } catch (error) {
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { sender: "bot", text: "❌ Failed to analyze the document. Please try again or type the prescription text manually." },
      ]);
      console.error("File upload error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Main user input handler
  const handleUserInput = async (input, fromUser = true) => {
    if (fromUser) {
      if (typeof input === "string") {
        setChat((prev) => [...prev, { sender: "user", text: input }]);
      } else if (input && input.label) {
        setChat((prev) => [...prev, { sender: "user", text: input.label }]);
      }
    }

    // Handle button actions
    if (input && input.type) {
      // Reset states when new button is clicked
      setAwaitingSymptoms(false);
      setAwaitingMedicineInput(false);
      setAwaitingPatientId(false);
      setAwaitingPrescriptionChoice(false);
      
      switch (input.type) {
        case "symptom_checker":
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "Please describe your symptoms in detail." },
          ]);
          setAwaitingSymptoms(true);
          return;

        case "upload_prescription":
          setChat((prev) => [
            ...prev,
            { 
              sender: "bot", 
              text: "Please upload your prescription or medical document. I can analyze:\n\n📋 Images (JPG, PNG, etc.)\n📄 PDF documents\n📝 Text files\n\nOr you can type the prescription text directly.", 
              showFileUpload: true 
            },
          ]);
          return;

        case "view_my_appointments":
          try {
            const patient_id = user?.id || 1;
            const response = await fetch(`http://localhost:3001/api/patients/appointments/${patient_id}`);
            const data = await response.json();
            
            // Handle MCP-style response
            const appointments = data.appointments || [];
            if (appointments.length > 0) {
              const appointmentsList = appointments.map(appt => {
                const date = new Date(appt.appointment_time);
                return `📅 ${date.toLocaleDateString()} at ${date.toLocaleTimeString()} with Dr. ${appt.doctor_name}`;
              }).join('\n');
              
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: `Your upcoming appointments:\n\n${appointmentsList}` },
              ]);
            } else {
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: data.message || "You have no upcoming appointments." },
              ]);
            }
          } catch (error) {
            console.error("Error fetching appointments:", error);
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: "Error fetching appointments. Please try again later." },
            ]);
          }
          return;

        case "view_prescription_history":
          // Check if we have enhanced parameters from Gemini
          if (input.count || input.timeframe) {
            await handlePrescriptionHistoryWithParams(input.count, input.timeframe);
          } else {
            // Default behavior - ask user for choice
            setChat((prev) => [
              ...prev,
              { sender: "user", text: "You chose Prescription History" },
              { sender: "bot", text: "Would you like to see:\n\n📋 **All** prescriptions\n🕒 **Recent** prescriptions (last 10)\n\nPlease type 'all' or 'recent':" },
            ]);
            setAwaitingPrescriptionChoice(true);
          }
          return;

        case "book_appointment":
          await handleAppointmentBooking(input.specialist);
          return;

        case "view_appointments":
          // Doctor view appointments - MCP style
          try {
            const doctor_id = user?.id || 1;
            const response = await fetch(`http://localhost:3001/api/doctors/appointments/${doctor_id}`);
            const data = await response.json();
            
            // Handle MCP-style response
            const appointments = data.appointments || [];
            if (appointments.length > 0) {
              const appointmentsList = appointments.map(appt => {
                const date = new Date(appt.appointment_time);
                return `📅 ${date.toLocaleDateString()} at ${date.toLocaleTimeString()} with ${appt.patient_name}`;
              }).join('\n');
              
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: `Your appointments:\n\n${appointmentsList}` },
              ]);
            } else {
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: data.message || "You have no scheduled appointments." },
              ]);
            }
          } catch (error) {
            console.error("Error fetching appointments:", error);
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: "Error fetching appointments. Please try again later." },
            ]);
          }
          return;

        case "add_medicine":
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "Please enter medicines in this format:\nPatient Username: [username]\nMedicines:\n- [Medicine Name], [Dosage], [Duration], [Instructions]\n- [Medicine Name], [Dosage], [Duration], [Instructions]\n\nExample (with dashes):\nPatient Username: mrigankshekharverma\nMedicines:\n- Paracetamol, 500mg, 5 days, Take twice daily after meals\n- Vitamin D3, 1000 IU, 30 days, Take once daily with breakfast\n\nExample (without dashes also works):\nPatient Username: mrigankshekharverma\nMedicines:\nParacetamol, 500mg, 5 days, Take twice daily after meals\nVitamin D3, 1000 IU, 30 days, Take once daily with breakfast" }
          ]);
          setAwaitingMedicineInput(true);
          return;

        case "view_patient_medicines":
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "Please enter the patient's username or patient ID to view their medicine history:" }
          ]);
          setAwaitingPatientId(true);
          return;

      }
    }

    // Handle prescription choice (all or recent)
    if (awaitingPrescriptionChoice && typeof input === "string") {
      setAwaitingPrescriptionChoice(false);
      const choice = input.toLowerCase().trim();
      
      if (choice === "all" || choice === "recent") {
        try {
          const patient_id = user?.id || 1;
          const limit = choice === "all" ? 1000 : 10;
          const response = await fetch(`http://localhost:3001/api/patients/${patient_id}/prescription-history?limit=${limit}`);
          const data = await response.json();
          
          // Handle MCP-style response
          const prescriptions = data.prescriptions || [];
          if (prescriptions.length > 0) {
            const prescriptionsList = prescriptions.map(presc => {
              const date = new Date(presc.prescribed_date);
              const doctorName = presc.doctor_name ? `by Dr. ${presc.doctor_name}` : 'by Unknown Doctor';
              return `📜 ${presc.medicine_name} (${presc.dosage}) - ${presc.duration}\n   Prescribed on ${date.toLocaleDateString()} ${doctorName}\n   Status: ${presc.status}`;
            }).join('\n\n');
            
            const displayText = choice === "all" 
              ? `All your prescriptions (${prescriptions.length} total):\n\n${prescriptionsList}`
              : `Your recent prescriptions (last ${prescriptions.length}):\n\n${prescriptionsList}`;
            
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: displayText },
            ]);
          } else {
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: data.message || "No prescription history found." },
            ]);
          }
        } catch (error) {
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "Error fetching prescription history." },
          ]);
        }
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: "Please type 'all' or 'recent' to choose what prescriptions to view." },
        ]);
        setAwaitingPrescriptionChoice(true);
      }
      return;
    }

    // Handle medicine input for doctors - MCP style
    if (awaitingMedicineInput && typeof input === "string") {
      setAwaitingMedicineInput(false);
      
      try {
        // Parse the new format
        const lines = input.trim().split('\n');
        const patientUsernameLine = lines.find(line => line.toLowerCase().includes('patient username'));
        
        if (!patientUsernameLine) {
          setChat((prev) => [...prev, { sender: "bot", text: "Please include 'Patient Username: [username]' in your input." }]);
          return;
        }
        
        const patientUsername = patientUsernameLine.split(':')[1].trim();
        if (!patientUsername) {
          setChat((prev) => [...prev, { sender: "bot", text: "Please provide a valid patient username." }]);
          return;
        }
        
        // Extract medicine lines (lines starting with - OR valid medicine format)
        let medicineLines = lines.filter(line => line.trim().startsWith('-'));
        
        // Also check for medicine-like lines without dashes
        const potentialMedicineLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && 
                 !trimmed.toLowerCase().includes('patient username') && 
                 !trimmed.toLowerCase().includes('medicines:') &&
                 !trimmed.startsWith('-') && // Not already processed
                 trimmed.includes(',') &&
                 trimmed.split(',').length >= 3; // At least name, dosage, duration
        });
        
        if (potentialMedicineLines.length > 0) {
          // Add non-dashed medicine lines, prefixed with dashes for processing
          medicineLines = medicineLines.concat(potentialMedicineLines.map(line => `- ${line.trim()}`));
        }
        
        if (medicineLines.length === 0) {
          setChat((prev) => [...prev, { sender: "bot", text: "Please include at least one medicine in the correct format.\n\nExample:\n- Paracetamol, 500mg, 5 days, Take twice daily after meals\n\nOr without dashes:\nParacetamol, 500mg, 5 days, Take twice daily after meals" }]);
          return;
        }
        
        // Parse each medicine BEFORE patient lookup
        const medicines = [];
        for (const line of medicineLines) {
          const parts = line.substring(1).split(',').map(s => s.trim()); // Remove '-' and split
          if (parts.length >= 3) {
            medicines.push({
              name: parts[0],
              dosage: parts[1],
              duration: parts[2],
              instructions: parts[3] || "As prescribed by doctor"
            });
          }
        }
        
        if (medicines.length === 0) {
          setChat((prev) => [...prev, { sender: "bot", text: "Please use correct format: - Medicine Name, Dosage, Duration, Instructions" }]);
          return;
        }
        
        // NOW do patient lookup after validating format
        const lookupResponse = await fetch(`http://localhost:3001/api/patients/lookup/${patientUsername}`);
        const lookupData = await lookupResponse.json();
        
        if (!lookupResponse.ok || lookupData.context.status !== "found") {
          setChat((prev) => [...prev, { sender: "bot", text: `Patient not found with username: ${patientUsername}. Please check the username and try again.` }]);
          return;
        }
        
        const patientId = lookupData.patient.id;
        const patientName = lookupData.patient.full_name;
        
        // Add each medicine
        let successCount = 0;
        let failCount = 0;
        const results = [];
        
        for (const medicine of medicines) {
          try {
            const response = await fetch("http://localhost:3001/api/prescriptions/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                context: {
                  patient_id: patientId,
                  doctor_id: user?.id || 1,
                  medicine_name: medicine.name,
                  dosage: medicine.dosage,
                  duration: medicine.duration,
                  instructions: medicine.instructions
                }
              })
            });
            const data = await response.json();
            
            if (data.context && data.context.status === "prescribed") {
              successCount++;
              results.push(`✅ ${medicine.name} - Added successfully`);
            } else {
              failCount++;
              results.push(`❌ ${medicine.name} - ${data.error || "Failed to add"}`);
            }
          } catch (error) {
            failCount++;
            results.push(`❌ ${medicine.name} - Error adding medicine`);
          }
        }
        
        const summary = `Added ${successCount} medicine(s) for ${patientName} (${patientUsername})${failCount > 0 ? `, ${failCount} failed` : ''}:\n\n${results.join('\n')}`;
        setChat((prev) => [...prev, { sender: "bot", text: summary }]);
        
      } catch (error) {
        // Fallback to old format for backward compatibility
        const [patientIdOrUsername, name, dosage, duration] = input.split(",").map(s => s.trim());
        
        // Check if it's a number (old format) or username (new format)
        const isNumeric = !isNaN(patientIdOrUsername);
        let patientId;
        
        if (isNumeric) {
          // Old format with patient ID
          patientId = parseInt(patientIdOrUsername);
        } else {
          // Try to lookup username
          try {
            const lookupResponse = await fetch(`http://localhost:3001/api/patients/lookup/${patientIdOrUsername}`);
            const lookupData = await lookupResponse.json();
            
            if (!lookupResponse.ok || lookupData.context.status !== "found") {
              setChat((prev) => [...prev, { sender: "bot", text: `Patient not found: ${patientIdOrUsername}. Please check the format.` }]);
              return;
            }
            patientId = lookupData.patient.id;
          } catch (lookupError) {
            setChat((prev) => [...prev, { sender: "bot", text: "Failed to lookup patient. Please check the format." }]);
            return;
          }
        }
        
        try {
          const response = await fetch("http://localhost:3001/api/prescriptions/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: {
                patient_id: patientId,
                doctor_id: user?.id || 1,
                medicine_name: name,
                dosage: dosage,
                duration: duration,
                instructions: "As prescribed by doctor"
              }
            })
          });
          const data = await response.json();
          
          if (data.context && data.context.status === "prescribed") {
            setChat((prev) => [...prev, { sender: "bot", text: data.message || "Medicine added for patient." }]);
          } else {
            setChat((prev) => [...prev, { sender: "bot", text: data.error || "Failed to add medicine." }]);
          }
        } catch (fallbackError) {
          setChat((prev) => [...prev, { sender: "bot", text: "Failed to add medicine. Please check the format." }]);
        }
      }
      return;
    }

    // Handle patient username input for viewing medicine history with enhanced NLP
    if (awaitingPatientId && typeof input === "string") {
      setAwaitingPatientId(false);
      let patientInput = input.trim();
      
      // Try to extract patient identifier using Gemini for natural language
      if (!/^\d+$/.test(patientInput) && !patientInput.includes('@') && patientInput.length > 3) {
        try {
          const response = await fetch("http://localhost:3001/api/ai-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "patient-extraction",
              userInput: `Extract patient identifier from: "${input}"\n\nRespond with ONLY a JSON object:\n{\n  "patient_identifier": "username_or_id",\n  "type": "username|id|unknown"\n}\n\nExamples:\n- "patient john doe" -> {"patient_identifier": "johndoe", "type": "username"}\n- "user mrigank" -> {"patient_identifier": "mrigank", "type": "username"}\n- "patient id 5" -> {"patient_identifier": "5", "type": "id"}\n- "123" -> {"patient_identifier": "123", "type": "id"}`
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const cleanResponse = data.response.replace(/```json|```/g, '').trim();
            
            try {
              const parsed = JSON.parse(cleanResponse);
              if (parsed.patient_identifier && parsed.type !== "unknown") {
                patientInput = parsed.patient_identifier;
              }
            } catch (parseError) {
              console.log("Failed to parse patient extraction:", parseError);
            }
          }
        } catch (error) {
          console.log("Gemini patient extraction failed:", error);
        }
      }
      
      if (!patientInput) {
        setChat((prev) => [...prev, { sender: "bot", text: "Please enter a valid patient username or ID." }]);
        return;
      }

      try {
        let patientId, patientName;
        
        // Check if input is a number (patient ID) or username
        if (/^\d+$/.test(patientInput)) {
          // Input is a number, treat as patient ID
          patientId = parseInt(patientInput, 10);
          
          // Fetch patient details by ID
          const patientResponse = await fetch(`http://localhost:3001/api/patients/${patientId}`);
          const patientData = await patientResponse.json();
          
          if (!patientResponse.ok || !patientData.patient) {
            setChat((prev) => [...prev, { sender: "bot", text: `Patient not found with ID: ${patientId}. Please check the ID and try again.` }]);
            return;
          }
          
          patientName = patientData.patient.full_name;
        } else {
          // Input is a username, lookup patient ID from username
          const lookupResponse = await fetch(`http://localhost:3001/api/patients/lookup/${patientInput}`);
          const lookupData = await lookupResponse.json();
          
          if (!lookupResponse.ok || lookupData.context.status !== "found") {
            setChat((prev) => [...prev, { sender: "bot", text: `Patient not found with username: ${patientInput}. Please check the username and try again.` }]);
            return;
          }
          
          patientId = lookupData.patient.id;
          patientName = lookupData.patient.full_name;
        }
        
        // Now fetch prescription history
        const response = await fetch(`http://localhost:3001/api/patients/${patientId}/prescription-history`);
        const data = await response.json();
        
        // Handle MCP-style response
        const prescriptions = data.prescriptions || [];
        if (prescriptions.length > 0) {
          const prescriptionsList = prescriptions.map(presc => {
            const date = new Date(presc.prescribed_date);
            const doctorName = presc.doctor_name ? `by Dr. ${presc.doctor_name}` : 'by Unknown Doctor';
            return `📜 ${presc.medicine_name} (${presc.dosage}) - ${presc.duration}\n   Prescribed on ${date.toLocaleDateString()} ${doctorName}\n   Status: ${presc.status}\n   Instructions: ${presc.instructions || 'None'}`;
          }).join('\n\n');
          
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: `Medicine history for ${patientName} (${/^\d+$/.test(patientInput) ? `ID: ${patientInput}` : patientInput}):\n\n${prescriptionsList}` },
          ]);
        } else {
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: data.message || `No prescription history found for ${patientName} (${/^\d+$/.test(patientInput) ? `ID: ${patientInput}` : patientInput}).` },
          ]);
        }
      } catch (error) {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `Error fetching medicine history for patient: ${patientInput}.` },
        ]);
      }
      return;
    }

    // Handle simple number input for doctor selection (when doctor list is shown)
    if (typeof input === "string" && /^\d+$/.test(input.trim()) && doctorListCache) {
      const doctorId = parseInt(input.trim(), 10);
      const doctor = doctorListCache.find(d => d.id === doctorId);
      
      if (doctor) {
        // Show doctor details and ask for appointment details
        let availabilityText = "";
        if (doctor.slots && Object.keys(doctor.slots).length > 0) {
          const availableDays = Object.keys(doctor.slots)
            .filter(day => doctor.slots[day] && doctor.slots[day].length > 0)
            .map(day => {
              const slots = doctor.slots[day];
              const timeSlots = slots.map(s => s.time).join(", ");
              return `${day}: ${timeSlots}`;
            });
          
          availabilityText = availableDays.length > 0 
            ? `\n\nAvailable slots:\n${availableDays.join("\n")}`
            : "\nNo availability set";
        }
        
        setChat((prev) => [
          ...prev,
          { 
            sender: "bot", 
            text: `You selected Dr. ${doctor.full_name} (${doctor.specialization})${availabilityText}\n\nTo book an appointment, type:\n"book my appointment for doctor id ${doctor.id} on YYYY-MM-DD, HH:MM AM/PM"\n\nExample: "book my appointment for doctor id ${doctor.id} on 2025-07-15, 10:00 AM"` 
          }
        ]);
        return;
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `Doctor with ID ${doctorId} not found in the current list. Please choose from the available doctors above.` }
        ]);
        return;
      }
    }

    // Handle appointment booking by doctor ID and slot (supports "5PM", "5 PM", "5:00PM", etc.)
    const bookingRegex = /book.*appointment.*doctor\s*id\s*(\d+).*on\s*(\d{4}-\d{2}-\d{2})\s*,?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i;
    const bookingMatch = typeof input === "string" && input.match(bookingRegex);
    if (bookingMatch) {
      await handleDirectBooking(bookingMatch);
      return;
    }

    // Handle awaiting booking confirmation
    if (awaitingBooking && typeof input === "string") {
      const answer = input.trim().toLowerCase();
      if (answer === "yes" && suggestedSpecialist) {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `Booking an appointment with a ${suggestedSpecialist} for you...` },
        ]);
        await handleAppointmentBooking(suggestedSpecialist);
        setAwaitingBooking(null);
        setSuggestedSpecialist(null);
        return;
      }
      if (answer === "no") {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: "Okay, I won't book an appointment. If you need anything else, just let me know!" },
        ]);
        setAwaitingBooking(null);
        setSuggestedSpecialist(null);
        return;
      }
    }

    // Handle awaiting symptoms
    if (awaitingSymptoms) {
      await analyzeSymptoms(input);
      return;
    }

    // Symptom keyword detection
    const symptomKeywords = [
      "fever", "cough", "cold", "headache", "pain", "sore throat", "vomit", 
      "nausea", "diarrhea", "chills", "fatigue", "rash", "dizzy", "breath", "congestion"
    ];
    const lower = typeof input === "string" ? input.toLowerCase() : "";
    if (symptomKeywords.some((kw) => lower.includes(kw))) {
      await analyzeSymptoms(input);
      return;
    }

    // Prescription text detection
    const prescriptionKeywords = [
      "tablet", "capsule", "syrup", "medicine", "drug", "prescription", "dosage", 
      "take", "mg", "ml", "twice daily", "once daily", "before meals", "after meals"
    ];
    if (typeof input === "string" && prescriptionKeywords.some((kw) => lower.includes(kw))) {
      await explainPrescription(input);
      return;
    }

    // Enhanced natural language processing with comprehensive Gemini parsing
    if (typeof input === "string") {
      // Get comprehensive parsing from Gemini
      const geminiResult = await geminiParseInput(input, role);
      
      if (geminiResult) {
        // Handle direct medicine addition with extracted data
        if (geminiResult.intent === "medicine_add" && geminiResult.patient_identifier && geminiResult.medicines) {
          await handleMedicineAdditionFromGemini(geminiResult);
          return;
        }
        
        // Handle patient lookup with extracted data
        if (geminiResult.intent === "patient_lookup" && geminiResult.patient_identifier) {
          await handlePatientLookupFromGemini(geminiResult);
          return;
        }
        
        // Handle direct appointment booking with full details
        if (geminiResult.intent === "book_appointment" && geminiResult.doctor_id && geminiResult.date && geminiResult.time) {
          const bookingMatch = [null, geminiResult.doctor_id.toString(), geminiResult.date, geminiResult.time];
          await handleDirectBooking(bookingMatch);
          return;
        }
        
        // Handle symptom analysis with extracted symptoms
        if (geminiResult.intent === "symptom_check" && geminiResult.symptoms) {
          await analyzeSymptoms(geminiResult.symptoms);
          return;
        }
        
        // Handle prescription history with extracted parameters
        if (geminiResult.intent === "prescription_history") {
          await handlePrescriptionHistoryWithParams(geminiResult.count, geminiResult.timeframe);
          return;
        }
      }
      
      // Enhanced intent detection for text input
      const intentResult = await detectIntent(input);
      if (intentResult) {
        await handleUserInput(intentResult, false);
        return;
      }
    }

    // Default response
    setChat((prev) => [
      ...prev,
      { sender: "bot", text: "How can I help you today? You can:\n• Use the buttons below\n• Describe your symptoms\n• Type natural language requests like:\n  - 'show my recent 5 prescriptions'\n  - 'book appointment with cardiologist'\n  - 'get patient john's medicine history'" },
    ]);
  };

  // Helper function to handle medicine addition from Gemini extraction
  const handleMedicineAdditionFromGemini = async (geminiResult) => {
    try {
      const { patient_identifier, medicines } = geminiResult;
      
      // Resolve patient
      let patientId, patientName;
      if (/^\d+$/.test(patient_identifier)) {
        const patientResponse = await fetch(`http://localhost:3001/api/patients/${patient_identifier}`);
        const patientData = await patientResponse.json();
        if (!patientResponse.ok || !patientData.patient) {
          setChat((prev) => [...prev, { sender: "bot", text: `Patient not found with ID: ${patient_identifier}` }]);
          return;
        }
        patientId = parseInt(patient_identifier);
        patientName = patientData.patient.full_name;
      } else {
        const lookupResponse = await fetch(`http://localhost:3001/api/patients/lookup/${patient_identifier}`);
        const lookupData = await lookupResponse.json();
        if (!lookupResponse.ok || lookupData.context.status !== "found") {
          setChat((prev) => [...prev, { sender: "bot", text: `Patient not found: ${patient_identifier}` }]);
          return;
        }
        patientId = lookupData.patient.id;
        patientName = lookupData.patient.full_name;
      }
      
      // Add medicines
      let successCount = 0;
      let failCount = 0;
      const results = [];
      
      for (const medicine of medicines) {
        try {
          const response = await fetch("http://localhost:3001/api/prescriptions/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: {
                patient_id: patientId,
                doctor_id: user?.id || 1,
                medicine_name: medicine.name,
                dosage: medicine.dosage,
                duration: medicine.duration,
                instructions: medicine.instructions || "As prescribed by doctor"
              }
            })
          });
          const data = await response.json();
          
          if (data.context && data.context.status === "prescribed") {
            successCount++;
            results.push(`✅ ${medicine.name} - Added successfully`);
          } else {
            failCount++;
            results.push(`❌ ${medicine.name} - ${data.error || "Failed to add"}`);
          }
        } catch (error) {
          failCount++;
          results.push(`❌ ${medicine.name} - Error adding medicine`);
        }
      }
      
      const summary = `Added ${successCount} medicine(s) for ${patientName} (${patient_identifier})${failCount > 0 ? `, ${failCount} failed` : ''}:\n\n${results.join('\n')}`;
      setChat((prev) => [...prev, { sender: "bot", text: summary }]);
      
    } catch (error) {
      setChat((prev) => [...prev, { sender: "bot", text: "Error processing medicine addition." }]);
    }
  };

  // Helper function to handle patient lookup from Gemini extraction
  const handlePatientLookupFromGemini = async (geminiResult) => {
    try {
      const { patient_identifier, action = "view_patient_medicines" } = geminiResult;
      
      // Resolve patient
      let patientId, patientName;
      if (/^\d+$/.test(patient_identifier)) {
        const patientResponse = await fetch(`http://localhost:3001/api/patients/${patient_identifier}`);
        const patientData = await patientResponse.json();
        if (!patientResponse.ok || !patientData.patient) {
          setChat((prev) => [...prev, { sender: "bot", text: `Patient not found with ID: ${patient_identifier}` }]);
          return;
        }
        patientId = parseInt(patient_identifier);
        patientName = patientData.patient.full_name;
      } else {
        const lookupResponse = await fetch(`http://localhost:3001/api/patients/lookup/${patient_identifier}`);
        const lookupData = await lookupResponse.json();
        if (!lookupResponse.ok || lookupData.context.status !== "found") {
          setChat((prev) => [...prev, { sender: "bot", text: `Patient not found: ${patient_identifier}` }]);
          return;
        }
        patientId = lookupData.patient.id;
        patientName = lookupData.patient.full_name;
      }
      
      // Execute the requested action - show medicine history
      const response = await fetch(`http://localhost:3001/api/patients/${patientId}/prescription-history`);
      const data = await response.json();
      const prescriptions = data.prescriptions || [];
      
      if (prescriptions.length > 0) {
        const prescriptionsList = prescriptions.map(presc => {
          const date = new Date(presc.prescribed_date);
          const doctorName = presc.doctor_name ? `by Dr. ${presc.doctor_name}` : 'by Unknown Doctor';
          return `📜 ${presc.medicine_name} (${presc.dosage}) - ${presc.duration}\n   Prescribed on ${date.toLocaleDateString()} ${doctorName}\n   Status: ${presc.status}\n   Instructions: ${presc.instructions || 'None'}`;
        }).join('\n\n');
        
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `Medicine history for ${patientName} (${patient_identifier}):\n\n${prescriptionsList}` },
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `No prescription history found for ${patientName} (${patient_identifier}).` },
        ]);
      }
      
    } catch (error) {
      setChat((prev) => [...prev, { sender: "bot", text: "Error processing patient lookup." }]);
    }
  };

  // Helper function to handle prescription history with specific parameters
  const handlePrescriptionHistoryWithParams = async (count, timeframe) => {
    try {
      const patient_id = user?.id || 1;
      
      // Determine limit based on parameters
      let limit;
      if (count) {
        limit = parseInt(count, 10);
      } else if (timeframe === "all") {
        limit = 1000;
      } else {
        limit = 10; // default for "recent" or null
      }
      
      // Ensure reasonable limits
      if (limit > 100) limit = 100;
      if (limit < 1) limit = 10;
      
      const response = await fetch(`http://localhost:3001/api/patients/${patient_id}/prescription-history?limit=${limit}`);
      const data = await response.json();
      
      // Handle MCP-style response
      const prescriptions = data.prescriptions || [];
      if (prescriptions.length > 0) {
        const prescriptionsList = prescriptions.map(presc => {
          const date = new Date(presc.prescribed_date);
          const doctorName = presc.doctor_name ? `by Dr. ${presc.doctor_name}` : 'by Unknown Doctor';
          return `📜 ${presc.medicine_name} (${presc.dosage}) - ${presc.duration}\n   Prescribed on ${date.toLocaleDateString()} ${doctorName}\n   Status: ${presc.status}`;
        }).join('\n\n');
        
        let displayText;
        if (count) {
          displayText = `Your last ${prescriptions.length} prescription${prescriptions.length !== 1 ? 's' : ''}:\n\n${prescriptionsList}`;
        } else if (timeframe === "all") {
          displayText = `All your prescriptions (${prescriptions.length} total):\n\n${prescriptionsList}`;
        } else {
          displayText = `Your recent prescriptions (last ${prescriptions.length}):\n\n${prescriptionsList}`;
        }
        
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: displayText },
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: data.message || "No prescription history found." },
        ]);
      }
    } catch (error) {
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Error fetching prescription history." },
      ]);
    }
  };

  // Helper function to handle appointment booking
  const handleAppointmentBooking = async (specialist = null) => {
    try {
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: specialist ? `Looking for available ${specialist} doctors...` : "Looking for available doctors..." }
      ]);

      const url = specialist 
        ? `http://localhost:3001/api/doctors/available-slots?specialist=${specialist}`
        : `http://localhost:3001/api/doctors/available-slots`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.doctors && data.doctors.length > 0) {
        setDoctorListCache(data.doctors);
        
        const doctorsList = data.doctors.map(doc => {
          let availabilityText = "";
          if (doc.slots && Object.keys(doc.slots).length > 0) {
            const availableDays = Object.keys(doc.slots)
              .filter(day => doc.slots[day] && doc.slots[day].length > 0)
              .map(day => {
                const slots = doc.slots[day];
                const timeRange = `${slots[0].time} - ${slots[slots.length - 1].time}`;
                return `${day}: ${timeRange}`;
              });
            
            availabilityText = availableDays.length > 0 
              ? `\n   Available: ${availableDays.join(", ")}`
              : "\n   No availability set";
          } else {
            availabilityText = "\n   No availability set";
          }
          
          return `Dr. ${doc.full_name} (ID: ${doc.id}) - ${doc.specialization}${availabilityText}`;
        }).join("\n\n");
        
        setChat((prev) => [
          ...prev,
          { 
            sender: "bot", 
            text: `Available ${specialist || ''}doctors:\n\n${doctorsList}\n\nTo book, you can either:\n1. Type just the doctor ID number (e.g., "1" for Dr. Smith)\n2. Type: "book my appointment for doctor id [ID] on YYYY-MM-DD, HH:MM AM/PM"\n\nExample: "book my appointment for doctor id 1 on 2025-07-15, 10:00 AM"` 
          }
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `Sorry, no ${specialist || ''}doctors are available at the moment.` }
        ]);
      }
    } catch (error) {
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Error fetching doctors. Please try again later." }
      ]);
    }
  };

  // Helper function to handle direct booking
  const handleDirectBooking = async (bookingMatch) => {
    const doctorId = parseInt(bookingMatch[1], 10);
    const dateStr = bookingMatch[2];
    const slot = bookingMatch[3].toUpperCase();

    // If no doctor cache, fetch the doctor info directly
    let doctor = doctorListCache?.find(d => d.id === doctorId);
    
    if (!doctor) {
      try {
        const response = await fetch(`http://localhost:3001/api/doctors/available-slots`);
        const data = await response.json();
        
        if (data.doctors && data.doctors.length > 0) {
          setDoctorListCache(data.doctors);
          doctor = data.doctors.find(d => d.id === doctorId);
        }
      } catch (error) {
        console.error("Error fetching doctor info:", error);
      }
    }

    if (!doctor) {
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Invalid doctor selection. Please try again or use the Book Appointment button to see available doctors." }
      ]);
      return;
    }

    const dayOfWeek = new Date(dateStr).toLocaleString("en-US", { weekday: "long" });
    
    // Better slot normalization to handle leading zeros and missing minutes
    const normalizeSlot = (timeStr) => {
      // First normalize the format to always include minutes
      const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;
      const match = timeStr.match(timeRegex);
      
      if (match) {
        const hour = match[1];
        const minute = match[2] || '00'; // Default to '00' if no minutes
        const ampm = match[3].toUpperCase();
        return `${hour}:${minute}${ampm}`;
      }
      
      // Fallback to original normalization
      return timeStr.replace(/\s+/g, '').toUpperCase().replace(/^0+(\d)/, '$1');
    };
    
    const normalizedSlot = normalizeSlot(slot);
    const availableSlots = (doctor.slots[dayOfWeek] || [])
      .map(s => normalizeSlot(s.time));

    // Check slot availability
    console.log("=== SLOT NORMALIZATION DEBUG ===");
    console.log("User input slot:", slot);
    console.log("Normalized user slot:", normalizedSlot);
    console.log("Available slots raw:", doctor.slots[dayOfWeek]);
    console.log("Available slots normalized:", availableSlots);
    console.log("Match found:", availableSlots.includes(normalizedSlot));
    
    if (!availableSlots.includes(normalizedSlot)) {
      const availableDaysText = Object.keys(doctor.slots)
        .filter(day => doctor.slots[day] && doctor.slots[day].length > 0)
        .map(day => `${day}: ${doctor.slots[day].map(s => s.time).join(', ')}`)
        .join('\n   ');
      
      setChat((prev) => [
        ...prev,
        { 
          sender: "bot", 
          text: `Selected slot (${slot}) is not available on ${dayOfWeek}.\n\nDr. ${doctor.full_name} is available:\n   ${availableDaysText || 'No availability set'}\n\nPlease choose an available slot.`
        }
      ]);
      return;
    }

    // Check if slot is already booked
    try {
      const appointmentsRes = await fetch(`http://localhost:3001/api/doctors/appointments/${doctor.id}?date=${dateStr}`);
      const appointmentsData = await appointmentsRes.json();
      
      const bookedSlots = new Set();
      if (appointmentsData.appointments) {
        appointmentsData.appointments.forEach(appt => {
          const apptDate = new Date(appt.appointment_time);
          const hour = apptDate.getHours();
          let displayHour = hour % 12 === 0 ? 12 : hour % 12;
          let ampm = hour < 12 ? "AM" : "PM";
          let slotStr = normalizeSlot(`${displayHour}:00 ${ampm}`);
          bookedSlots.add(slotStr);
        });
      }

      if (bookedSlots.has(normalizedSlot)) {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: "This slot is already booked. Please choose another slot." }
        ]);
        return;
      }

      // Parse and book appointment with improved time parsing
      const parseTimeSlot = (timeSlot) => {
        // Handle formats: "5PM", "5 PM", "5:00PM", "5:00 PM", "05:00 PM", etc.
        const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;
        const match = timeSlot.match(timeRegex);
        
        if (!match) {
          throw new Error(`Invalid time format: ${timeSlot}`);
        }
        
        let hour = parseInt(match[1], 10);
        const minute = match[2] ? parseInt(match[2], 10) : 0; // Default to 0 if no minutes provided
        const ampm = match[3].toUpperCase();
        
        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        
        return { hour, minute };
      };
      
      let appointment_time;
      try {
        const { hour, minute } = parseTimeSlot(slot);
        appointment_time = `${dateStr} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
        
        console.log("Parsed time:", { originalSlot: slot, hour, minute, appointment_time });
      } catch (parseError) {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: `Invalid time format. Please use format like "5PM", "5:00PM", or "5:00 PM"` }
        ]);
        return;
      }

      const patient_id = user?.id || 1;
      const bookRes = await fetch("http://localhost:3001/api/doctors/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            patient_id,
            doctor_id: doctorId,
            appointment_time
          }
        }),
      });

      const bookData = await bookRes.json();
      if (bookRes.ok && bookData.context && bookData.context.status === "booked") {
        setChat((prev) => [
          ...prev,
          {
            sender: "bot",
            text: `✅ Appointment booked with Dr. ${doctor.full_name} on ${dateStr} at ${slot}.`,
          },
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "bot", text: bookData.message || bookData.error || "Failed to book appointment." },
        ]);
      }
    } catch (error) {
      console.error("Error in handleDirectBooking:", error);
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Error processing booking. Please try again." }
      ]);
    }
  };

  return (
    <ChatWindow
      messages={chat}
      buttons={buttons}
      onUserInput={handleUserInput}
      onFileUpload={handleFileUpload}
      isProcessing={isAnalyzing}
    />
  );
};

export default SmartTriage;
