import React, { useState } from "react";
import ChatWindow from "../components/ChatWindow";
import axios from "axios";

const WellnessChat = () => {
  const [chat, setChat] = useState([
    {
      sender: "bot",
      text: "Welcome to Wellness Chat! Ask about ⚖️ BMI, 🍎 food, 🧘 yoga, 🩺 BP, or 🌫️ AQI.",
    },
  ]);
  const [bmiStep, setBmiStep] = useState(0);
  const [bpStep, setBpStep] = useState(0);
  const [weight, setWeight] = useState(null);
  const [unitSystem, setUnitSystem] = useState("metric");
  const [pendingTopic, setPendingTopic] = useState(null);

  const buttons = [
    { label: "⚖️ BMI", type: "bmi" },
    { label: "🍎 Food Nutrition", type: "food" },
    { label: "🧘 Yoga", type: "yoga" },
    { label: "🩺 BP Checker", type: "bp" },
    { label: "🌫️ AQI", type: "aqi" },
  ];

  const handleUserInput = async (input) => {
    // Reset all flows on every main button click
    if (typeof input === "object" && input.type) {
      setBmiStep(0);
      setBpStep(0);
      setWeight(null);
      setPendingTopic(null);

      if (input.type === "bmi") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You chose BMI" },
          {
            sender: "bot",
            text:
              "Which units?\n• Type `kg` for kilograms/cm\n• Type `lbs` for pounds/inches",
          },
        ]);
        setBmiStep("choose_unit");
        return;
      }
      if (input.type === "bp") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You chose BP Checker" },
          {
            sender: "bot",
            text: "Please enter your blood pressure as `systolic/diastolic` (e.g., 120/80)",
          },
        ]);
        setBpStep(1);
        return;
      }
      if (input.type === "food") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You chose Food Nutrition" },
          { sender: "bot", text: "🍎 Enter a food item to get nutritional info:" },
        ]);
        setPendingTopic("food");
        return;
      }
      if (input.type === "yoga") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You chose Yoga" },
          { sender: "bot", text: "🧘 Type your health goal (e.g., Yoga for back pain):" },
        ]);
        setPendingTopic("yoga");
        return;
      }
      if (input.type === "aqi") {
        setChat((prev) => [
          ...prev,
          { sender: "user", text: "You chose AQI" },
          { sender: "bot", text: "🌫️ Enter a city to check AQI:" },
        ]);
        setPendingTopic("aqi");
        return;
      }
    }

    // Handle text input (natural language)
    if (typeof input === "string") {
      setChat((prev) => [...prev, { sender: "user", text: input }]);
      const lower = input.toLowerCase();

      // BMI flow (local only)
      if (bmiStep === "choose_unit") {
        const u = input.toLowerCase();
        if (u === "kg" || u === "metric") {
          setUnitSystem("metric");
          setChat((prev) => [...prev, { sender: "bot", text: "Enter your weight in kg:" }]);
          setBmiStep(1);
        } else if (u === "lbs" || u === "imperial") {
          setUnitSystem("imperial");
          setChat((prev) => [...prev, { sender: "bot", text: "Enter your weight in lbs:" }]);
          setBmiStep(1);
        } else {
          setChat((prev) => [...prev, { sender: "bot", text: "❗ Please type `kg` or `lbs`." }]);
        }
        return;
      }
      if (bmiStep === 1) {
        const w = parseFloat(input);
        if (isNaN(w) || w <= 0) {
          setChat((prev) => [...prev, { sender: "bot", text: "❗ Please enter a valid weight." }]);
        } else {
          setWeight(w);
          setChat((prev) => [
            ...prev,
            {
              sender: "bot",
              text: `Got it. Now enter your height in ${unitSystem === "metric" ? "cm" : "inches"}:`,
            },
          ]);
          setBmiStep(2);
        }
        return;
      }
      if (bmiStep === 2) {
        const h = parseFloat(input);
        if (isNaN(h) || h <= 0) {
          setChat((prev) => [...prev, { sender: "bot", text: "❗ Please enter a valid height." }]);
        } else {
          const bmi = calculateBMI(weight, h, unitSystem);
          const analysis = analyzeBMI(bmi);
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: `⚖️ Your BMI is **${bmi.toFixed(1)}**\n${analysis}` },
          ]);
          setBmiStep(0);
          setWeight(null);
        }
        return;
      }

      // BP flow (local only)
      if (bpStep === 1) {
        const match = input.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
        if (!match) {
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "❓ Please enter as `systolic/diastolic` (e.g., 120/80)" },
          ]);
        } else {
          const [_, systolic, diastolic] = match;
          const { category, risks, advice } = analyzeBP(+systolic, +diastolic);
          setChat((prev) => [
            ...prev,
            {
              sender: "bot",
              text: `🩺 Your BP: **${systolic}/${diastolic} mmHg** — **${category}**\n**Risks:**\n${risks.join("\n")}\n**Advice:**\n${advice.join("\n")}`,
            },
          ]);
          setBpStep(0);
        }
        return;
      }

      // Gemini API for Food Nutrition, Yoga, AQI only
      if (pendingTopic === "food" || pendingTopic === "yoga" || pendingTopic === "aqi") {
        try {
          const res = await axios.post("/api/rag-response", {
            type: pendingTopic,
            userInput: input,
          });
          setChat((prev) => [...prev, { sender: "bot", text: res.data.response }]);
        } catch (err) {
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "⚠️ Something went wrong. Please try again." },
          ]);
        }
        setPendingTopic(null);
        return;
      }

      // Fallback
      setChat((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🤔 I'm not sure if I understand this. Please choose one of the buttons below to continue.",
        },
      ]);
    }
  };

  const calculateBMI = (weight, height, units) => {
    if (units === "metric") {
      return weight / ((height / 100) ** 2);
    } else {
      return (weight / (height ** 2)) * 703;
    }
  };

  const analyzeBMI = (bmi) => {
    if (bmi < 18.5) {
      return (
        "**Underweight**\n- Nutritional issues\n- Bone loss\n**Advice:**\n• Eat more protein & carbs\n• Resistance training"
      );
    } else if (bmi < 25) {
      return "**Normal**\n- Healthy range\n**Advice:**\n• Maintain diet & activity";
    } else if (bmi < 30) {
      return (
        "**Overweight**\n- Risk of diabetes & heart disease\n**Advice:**\n• Calorie control\n• Cardio exercise"
      );
    } else {
      return (
        "**Obese**\n- High risk of stroke, diabetes\n**Advice:**\n• Medical guidance\n• Structured weight-loss"
      );
    }
  };

  const analyzeBP = (sys, dia) => {
    let category, risks, advice;
    if (sys < 120 && dia < 80) {
      category = "Normal";
      risks = ["Low risk of cardiovascular issues"];
      advice = ["Keep up your healthy habits"];
    } else if (sys < 130 && dia < 80) {
      category = "Elevated";
      risks = ["Risk of developing hypertension"];
      advice = ["Reduce salt", "Exercise regularly"];
    } else if (sys < 140 || dia < 90) {
      category = "Hypertension Stage 1";
      risks = ["Heart disease", "Kidney strain"];
      advice = ["Limit alcohol", "Monitor BP", "Consult doctor"];
    } else if (sys < 180 && dia < 120) {
      category = "Stage 2 Hypertension";
      risks = ["Organ damage", "Stroke"];
      advice = ["Medication likely", "Medical supervision"];
    } else {
      category = "Hypertensive Crisis";
      risks = ["Emergency: stroke/heart failure"];
      advice = ["Seek immediate medical help"];
    }
    return { category, risks, advice };
  };

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col h-screen">
      <h2 className="text-2xl font-bold mb-4">Wellness Chat</h2>
      <div className="flex-grow overflow-auto border rounded-md p-3 bg-gray-50 shadow-inner">
        <ChatWindow
          messages={chat}
          buttons={buttons}
          onUserInput={handleUserInput}
        />
      </div>
    </div>
  );
};

export default WellnessChat;
/*
🩺 Your BP: 67/34 mmHg — Normal
Risks:
Low risk of cardiovascular issues
Advice:
Keep up your healthy habits
*/