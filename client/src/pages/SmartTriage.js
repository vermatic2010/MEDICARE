import React, { useState } from "react";
import ChatWindow from "../components/ChatWindow";

const SmartTriage = () => {
  const [chat, setChat] = useState([
    {
      sender: "bot",
      text: "Welcome to Smart Triage! Use buttons below to start symptom checker, upload prescription, or book appointment.",
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [awaitingSymptoms, setAwaitingSymptoms] = useState(false);

  const buttons = [
    { label: "🩺 Symptom Checker", type: "symptom_checker" },
    { label: "📄 Upload Prescription", type: "upload_prescription" },
    { label: "📅 Book Appointment", type: "book_appointment" },
  ];

  const analyzeSymptoms = async (symptoms) => {
    try {
      setIsAnalyzing(true);
      setAwaitingSymptoms(false);
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Analyzing your symptoms...", isLoading: true },
      ]);

      const response = await fetch("http://localhost:3001/api/rag-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "symptom", userInput: symptoms }),
      });

      if (!response.ok) throw new Error("Failed to analyze symptoms");

      const data = await response.json();
      setChat((prev) => [
        ...prev.filter((msg) => !msg.isLoading),
        { sender: "bot", text: `Here's my analysis:\n\n${data.response.replace(/\n/g, "\n")}` },
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

  const explainPrescription = async (prescriptionText) => {
    try {
      setIsAnalyzing(true);
      setChat((prev) => [
        ...prev,
        { sender: "bot", text: "Explaining your prescription...", isLoading: true },
      ]);
      const response = await fetch("http://localhost:3001/api/rag-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  const handleUserInput = async (input) => {
    // Button click handling with user-friendly messages
    if (typeof input === "object" && input.type) {
      if (input.type === "symptom_checker") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You selected Symptom Checker" },
          { sender: "bot", text: "Please describe your symptoms (e.g., 'headache, fever, cough for 3 days')" },
        ]);
        setAwaitingSymptoms(true);
        return;
      }
      if (input.type === "upload_prescription") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You selected Upload Prescription" },
        ]);
        // Show file picker and handle file upload
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg";
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          setChat((prev) => [
            ...prev,
            { sender: "user", text: `You uploaded: ${file.name}` },
            { sender: "bot", text: "Analyzing your prescription..." },
          ]);
          if (file.type === "text/plain") {
            // Handle .txt files in browser
            const text = await file.text();
            await explainPrescription(text);
          } else {
            // For images, pdf, doc, docx: send file to backend for OCR/extraction
            const formData = new FormData();
            formData.append("file", file);
            try {
              const response = await fetch("http://localhost:3001/api/rag-response", {
                method: "POST",
                body: formData,
              });
              const data = await response.json();
              if (data.text) {
                await explainPrescription(data.text);
              } else if (data.response) {
                setChat((prev) => [
                  ...prev,
                  { sender: "bot", text: data.response },
                ]);
              } else {
                setChat((prev) => [
                  ...prev,
                  { sender: "bot", text: "Sorry, could not extract text from the file." },
                ]);
              }
            } catch (err) {
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: "Sorry, could not extract text from the file." },
              ]);
            }
          }
        };
        fileInput.click();
        return;
      }
      if (input.type === "book_appointment") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You selected Book Appointment" },
          {
            sender: "bot",
            text: "To book an appointment, please provide:\n1. Your name\n2. Phone number\n3. Preferred doctor\n4. Preferred date/time",
          },
        ]);
        return;
      }
    }

    setChat((prev) => [...prev, { sender: "user", text: input }]);

    // If awaiting symptoms, analyze directly
    if (awaitingSymptoms) {
      await analyzeSymptoms(input);
      return;
    }

    // --- Symptom keyword detection ---
    const symptomKeywords = [
      "fever", "cough", "cold", "headache", "pain", "sore throat", "vomit", "nausea", "diarrhea", "chills", "fatigue", "rash", "dizzy", "breath", "congestion"
    ];
    const lower = typeof input === "string" ? input.toLowerCase() : "";
    if (symptomKeywords.some((kw) => lower.includes(kw))) {
      await analyzeSymptoms(input);
      return;
    }

    setChat((prev) => [
      ...prev,
      { sender: "bot", text: "How can I help you today? Please use the buttons below or describe your symptoms." },
    ]);
  };

  return (
    <ChatWindow
      messages={chat}
      buttons={buttons}
      onUserInput={handleUserInput}
      isProcessing={isAnalyzing}
    />
  );
};

export default SmartTriage;