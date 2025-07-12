import React, { useState } from "react";
import ChatWindow from "../components/ChatWindow";
import axios from "axios";

const WellnessChat = ({ user }) => {
  const [chat, setChat] = useState([
    {
      sender: "bot",
      text: "🌟 Welcome to Wellness Chat with AI! Tell me naturally what you want:\n• 'My weight is 70kg height 175cm' for BMI\n• 'My BP is 120/80' for blood pressure\n• 'Nutrition for apple' for food info (📊 RAG-enhanced!)\n• 'Yoga for back pain' for exercises",
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
  ];

  // Comprehensive Gemini AI-powered intent detection and entity extraction for wellness workflows
  const geminiParseWellnessInput = async (input) => {
    try {
      const response = await fetch("http://localhost:3001/api/ai-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "wellness-intent-extraction",
          userInput: input
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const cleanResponse = data.response.replace(/```json|```/g, '').trim();
        
        try {
          return JSON.parse(cleanResponse);
        } catch (parseError) {
          console.log("Failed to parse Gemini wellness response:", parseError);
          return null;
        }
      }
    } catch (error) {
      console.log("Gemini wellness parsing failed:", error);
    }
    return null;
  };

  const handleUserInput = async (input) => {
    // Always show user message in chat
    if (typeof input === "string") {
      setChat((prev) => [...prev, { sender: "user", text: input }]);
    }

    // Handle text input (natural language) for step-based flows FIRST
    if (typeof input === "string") {
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
          const bmiResult = analyzeBMI(bmi);
          setChat((prev) => [
            ...prev, 
            { sender: "bot", text: `⚖️ Your BMI is **${bmi.toFixed(1)}**\n${bmiResult.analysis}` },
          ]);
          
          // Check if consultation is needed and redirect
          if (bmiResult.needsConsultation) {
            setTimeout(() => {
              setChat((prev) => [
                ...prev,
                { 
                  sender: "bot", 
                  text: "🏥 Let me redirect you to the Smart Triage tab where you can book an appointment with a doctor for proper medical consultation." 
                },
              ]);
              // Redirect to Smart Triage after 2 seconds
              setTimeout(() => {
                if (onNavigate) {
                  onNavigate('triage');
                }
              }, 2000);
            }, 1000);
          }
          
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
          const bpResult = analyzeBP(+systolic, +diastolic);
          setChat((prev) => [
            ...prev,
            {
              sender: "bot",
              text: `🩺 Your BP: **${systolic}/${diastolic} mmHg** — **${bpResult.category}**\nRisks: ${bpResult.risks.join(", ")}\nAdvice: ${bpResult.advice.join(", ")}`,
            },
          ]);
          
          // Check if consultation is needed and redirect
          if (bpResult.needsConsultation) {
            setTimeout(() => {
              setChat((prev) => [
                ...prev,
                { 
                  sender: "bot", 
                  text: "🏥 Let me redirect you to the Smart Triage tab where you can book an appointment with a doctor for immediate medical consultation." 
                },
              ]);
              // Redirect to Smart Triage after 2 seconds
              setTimeout(() => {
                if (onNavigate) {
                  onNavigate('triage');
                }
              }, 2000);
            }, 1000);
          }
          
          setBpStep(0);
        }
        return;
      }

      // Gemini API for Food Nutrition, Yoga only (button flows) - CHECK THIS FIRST
      if (pendingTopic === "food" || pendingTopic === "yoga") {
        try {
          const res = await fetch("http://localhost:3001/api/ai-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: pendingTopic,
              userInput: input,
            }),
          });
          const data = await res.json();
          
          // Format response for RAG-enhanced nutrition
          let responseText = data.response || `No ${pendingTopic} info found.`;
          
          if (pendingTopic === "food" && data.ragEnhanced) {
            responseText += `\n\n🔍 *Enhanced with nutrition database* (${data.contextUsed} sources used)`;
            if (data.relevantContext && data.relevantContext.length > 0) {
              const similarFoods = data.relevantContext
                .filter(ctx => ctx.category && ctx.category !== 'unknown')
                .map(ctx => ctx.category)
                .filter((cat, index, arr) => arr.indexOf(cat) === index) // unique
                .slice(0, 3);
              
              if (similarFoods.length > 0) {
                responseText += `\n📊 Categories: ${similarFoods.join(', ')}`;
              }
            }
          } else if (pendingTopic === "food" && data.fallback) {
            responseText += "\n\n⚠️ *Basic analysis* (nutrition database unavailable)";
          }
          
          setChat((prev) => [...prev, { sender: "bot", text: responseText }]);
        } catch (err) {
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: "⚠️ Something went wrong. Please try again." },
          ]);
        }
        setPendingTopic(null);
        return;
      }
    }

    // Gemini AI-powered intent detection and entity extraction for free text (SECONDARY)
    if (typeof input === "string") {
      // Simple pattern matching fallback for common cases
      const lowerInput = input.toLowerCase();
      
      // BMI calculation patterns
      const bmiPatterns = [
        /(?:my\s+)?weight\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*kg.*?height\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*cm/i,
        /(?:my\s+)?height\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*cm.*?weight\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*kg/i,
        /(\d+(?:\.\d+)?)\s*kg.*?(\d+(?:\.\d+)?)\s*cm/i,
        /(\d+(?:\.\d+)?)\s*cm.*?(\d+(?:\.\d+)?)\s*kg/i
      ];
      
      for (const pattern of bmiPatterns) {
        const match = input.match(pattern);
        if (match) {
          let weight, height;
          
          // Check if weight comes first or height comes first in the pattern
          if (pattern.source.includes('weight.*height')) {
            weight = parseFloat(match[1]);
            height = parseFloat(match[2]);
          } else if (pattern.source.includes('height.*weight')) {
            height = parseFloat(match[1]);
            weight = parseFloat(match[2]);
          } else {
            // For simple patterns like kg...cm or cm...kg, check the units
            if (input.includes('kg') && input.includes('cm')) {
              const kgIndex = input.indexOf('kg');
              const cmIndex = input.indexOf('cm');
              if (kgIndex < cmIndex) {
                // kg comes first, so match[1] is weight, match[2] is height
                weight = parseFloat(match[1]);
                height = parseFloat(match[2]);
              } else {
                // cm comes first, so match[1] is height, match[2] is weight
                height = parseFloat(match[1]);
                weight = parseFloat(match[2]);
              }
            }
          }
          
          if (weight > 0 && height > 0) {
            const bmi = calculateBMI(weight, height, "metric");
            const bmiResult = analyzeBMI(bmi);
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: `⚖️ Your BMI is **${bmi.toFixed(1)}**\n${bmiResult.analysis}` },
            ]);
            
            // Check if consultation is needed and redirect
            if (bmiResult.needsConsultation) {
              setTimeout(() => {
                setChat((prev) => [
                  ...prev,
                  { 
                    sender: "bot", 
                    text: "🏥 Let me redirect you to the Smart Triage tab where you can book an appointment with a doctor for proper medical consultation." 
                  },
                ]);
                // Redirect to Smart Triage after 2 seconds
                setTimeout(() => {
                  if (onNavigate) {
                    onNavigate('triage');
                  }
                }, 2000);
              }, 1000);
            }
            return;
          }
        }
      }
      
      // Blood pressure patterns
      const bpPatterns = [
        /(?:my\s+)?(?:bp|blood\s+pressure)\s+(?:is\s+)?(\d{2,3})\s*\/\s*(\d{2,3})/i,
        /(\d{2,3})\s+over\s+(\d{2,3})/i,
        /(\d{2,3})\s*\/\s*(\d{2,3})/i
      ];
      
      for (const pattern of bpPatterns) {
        const match = input.match(pattern);
        if (match) {
          const systolic = parseInt(match[1]);
          const diastolic = parseInt(match[2]);
          
          if (systolic >= 70 && systolic <= 250 && diastolic >= 40 && diastolic <= 150) {
            const bpResult = analyzeBP(systolic, diastolic);
            setChat((prev) => [
              ...prev,
              { 
                sender: "bot", 
                text: `🩺 Your BP: **${systolic}/${diastolic} mmHg** — **${bpResult.category}**\nRisks: ${bpResult.risks.join(", ")}\nAdvice: ${bpResult.advice.join(", ")}` 
              },
            ]);
            
            // Check if consultation is needed and redirect
            if (bpResult.needsConsultation) {
              setTimeout(() => {
                setChat((prev) => [
                  ...prev,
                  { 
                    sender: "bot", 
                    text: "🏥 Let me redirect you to the Smart Triage tab where you can book an appointment with a doctor for immediate medical consultation." 
                  },
                ]);
                // Redirect to Smart Triage after 2 seconds
                setTimeout(() => {
                  if (onNavigate) {
                    onNavigate('triage');
                  }
                }, 2000);
              }, 1000);
            }
            return;
          }
        }
      }
      
      // Food nutrition patterns
      const foodPatterns = [
        /nutrition\s+(?:of|for|info|list)\s+(.+)/i,
        /(.+)\s+nutrition/i,
        /calories?\s+(?:in|of|for)\s+(.+)/i,
        /(?:what|how)\s+(?:about|much)\s+(.+)/i
      ];
      
      for (const pattern of foodPatterns) {
        const match = input.match(pattern);
        if (match) {
          const foodItem = match[1].trim();
          if (foodItem && foodItem.length > 0) {
            try {
              const res = await fetch("http://localhost:3001/api/ai-response", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "food", userInput: foodItem }),
              });
              const data = await res.json();
              
              // Format response with RAG information
              let responseText = data.response || `No nutrition info found for "${foodItem}".`;
              
              if (data.ragEnhanced) {
                responseText += `\n\n🔍 *Enhanced with nutrition database* (${data.contextUsed} sources used)`;
                if (data.relevantContext && data.relevantContext.length > 0) {
                  const similarFoods = data.relevantContext
                    .filter(ctx => ctx.category && ctx.category !== 'unknown')
                    .map(ctx => ctx.category)
                    .filter((cat, index, arr) => arr.indexOf(cat) === index) // unique
                    .slice(0, 3);
                  
                  if (similarFoods.length > 0) {
                    responseText += `\n📊 Categories: ${similarFoods.join(', ')}`;
                  }
                }
              } else if (data.fallback) {
                responseText += "\n\n⚠️ *Basic analysis* (nutrition database unavailable)";
              }
              
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: responseText },
              ]);
              return;
            } catch (err) {
              console.error("Food API error:", err);
              // Continue to Gemini parsing
            }
          }
        }
      }
      
      // Yoga patterns
      if (/yoga|exercise|stretc|workout/i.test(lowerInput)) {
        try {
          const res = await fetch("http://localhost:3001/api/ai-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "yoga", userInput: input }),
          });
          const data = await res.json();
          setChat((prev) => [
            ...prev,
            { sender: "bot", text: data.response || "No yoga advice found." },
          ]);
          return;
        } catch (err) {
          console.error("Yoga API error:", err);
          // Continue to Gemini parsing
        }
      }
      
      // Try Gemini parsing for more complex cases
      const geminiResult = await geminiParseWellnessInput(input);
      
      if (geminiResult) {
        const { intent, weight: geminiWeight, height: geminiHeight, unit, systolic, diastolic, food_item, goal, city } = geminiResult;

        // --- BMI with Gemini entity extraction ---
        if (intent === "bmi") {
          if (geminiWeight && geminiHeight) {
            const bmi = calculateBMI(geminiWeight, geminiHeight, unit || "metric");
            const bmiResult = analyzeBMI(bmi);
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: `⚖️ Your BMI is **${bmi.toFixed(1)}**\n${bmiResult.analysis}` },
            ]);
            
            // Check if consultation is needed and redirect
            if (bmiResult.needsConsultation) {
              setTimeout(() => {
                setChat((prev) => [
                  ...prev,
                  { 
                    sender: "bot", 
                    text: "🏥 Let me redirect you to the Smart Triage tab where you can book an appointment with a doctor for proper medical consultation." 
                  },
                ]);
                // Redirect to Smart Triage after 2 seconds
                setTimeout(() => {
                  if (onNavigate) {
                    onNavigate('triage');
                  }
                }, 2000);
              }, 1000);
            }
            return;
          } else {
            await handleUserInput({ type: "bmi" });
            return;
          }
        }

        // --- BP with Gemini entity extraction ---
        if (intent === "bp") {
          if (systolic && diastolic) {
            const bpResult = analyzeBP(systolic, diastolic);
            setChat((prev) => [
              ...prev,
              {
                sender: "bot",
                text: `🩺 Your BP: **${systolic}/${diastolic} mmHg** — **${bpResult.category}**\nRisks: ${bpResult.risks.join(", ")}\nAdvice: ${bpResult.advice.join(", ")}`,
              },
            ]);
            
            // Check if consultation is needed and redirect
            if (bpResult.needsConsultation) {
              setTimeout(() => {
                setChat((prev) => [
                  ...prev,
                  { 
                    sender: "bot", 
                    text: "🏥 Let me redirect you to the Smart Triage tab where you can book an appointment with a doctor for immediate medical consultation." 
                  },
                ]);
                // Redirect to Smart Triage after 2 seconds
                setTimeout(() => {
                  if (onNavigate) {
                    onNavigate('triage');
                  }
                }, 2000);
              }, 1000);
            }
            return;
          } else {
            await handleUserInput({ type: "bp" });
            return;
          }
        }

        // --- Food with Gemini entity extraction ---
        if (intent === "food") {
          if (food_item) {
            try {
              const res = await fetch("http://localhost:3001/api/ai-response", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "food", userInput: food_item }),
              });
              const data = await res.json();
              
              // Format response with RAG information
              let responseText = data.response || `No nutrition info found for "${food_item}".`;
              
              if (data.ragEnhanced) {
                responseText += `\n\n🔍 *Enhanced with nutrition database* (${data.contextUsed} sources used)`;
                if (data.relevantContext && data.relevantContext.length > 0) {
                  const similarFoods = data.relevantContext
                    .filter(ctx => ctx.category && ctx.category !== 'unknown')
                    .map(ctx => ctx.category)
                    .filter((cat, index, arr) => arr.indexOf(cat) === index) // unique
                    .slice(0, 3);
                  
                  if (similarFoods.length > 0) {
                    responseText += `\n📊 Categories: ${similarFoods.join(', ')}`;
                  }
                }
              } else if (data.fallback) {
                responseText += "\n\n⚠️ *Basic analysis* (nutrition database unavailable)";
              }
              
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: responseText },
              ]);
            } catch (err) {
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: "⚠️ Something went wrong. Please try again." },
              ]);
            }
            return;
          } else {
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: "🍎 Enter a food item to get nutritional info:" },
            ]);
            return;
          }
        }

        // --- Yoga with Gemini entity extraction ---
        if (intent === "yoga") {
          if (goal) {
            try {
              const res = await fetch("http://localhost:3001/api/ai-response", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "yoga", userInput: goal }),
              });
              const data = await res.json();
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: data.response || `No yoga advice found for "${goal}".` },
              ]);
            } catch (err) {
              setChat((prev) => [
                ...prev,
                { sender: "bot", text: "⚠️ Something went wrong. Please try again." },
              ]);
            }
            return;
          } else {
            setChat((prev) => [
              ...prev,
              { sender: "bot", text: "🧘 Type your health goal (e.g., Yoga for back pain):" },
            ]);
            return;
          }
        }

      }

      // Fallback for unknown or unparsed intent
      setChat((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "🤔 I'm not sure if I understand this. Please try typing something like 'my weight is 70kg height 175cm', 'my BP is 120/80', 'nutrition for apple', or 'yoga for back pain'.",
        },
      ]);
      return;
    }

    // Button click handling (always works)
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
    }

    // Fallback for unrecognized text input
    if (typeof input === "string") {
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
      return {
        analysis: `**Underweight**\nRisks: Nutritional issues, bone loss\nAdvice: Eat more protein & carbs, do resistance training.`,
        needsConsultation: false
      };
    } else if (bmi < 25) {
      return {
        analysis: `**Normal**\nHealthy range.\nAdvice: Maintain diet & activity.`,
        needsConsultation: false
      };
    } else if (bmi < 30) {
      return {
        analysis: `**Overweight**\nRisks: Diabetes, heart disease\nAdvice: Calorie control, cardio exercise.`,
        needsConsultation: false
      };
    } else {
      return {
        analysis: `**Obese**\nRisks: Stroke, diabetes\nAdvice: Seek medical guidance, structured weight-loss.\n\n🚨 **Your BMI indicates obesity. We recommend consulting a doctor immediately.**`,
        needsConsultation: true
      };
    }
  };

  const analyzeBP = (sys, dia) => {
    let category, risks, advice, needsConsultation = false;
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
      needsConsultation = true;
    } else {
      category = "Hypertensive Crisis";
      risks = ["Emergency: stroke/heart failure"];
      advice = ["Seek immediate medical help"];
      needsConsultation = true;
    }
    
    if (needsConsultation) {
      advice.push("🚨 **Your blood pressure is in a dangerous range. We recommend consulting a doctor immediately.**");
    }
    
    return { category, risks, advice, needsConsultation };
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
