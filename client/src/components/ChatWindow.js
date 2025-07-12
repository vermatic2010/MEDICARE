import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

const userIconUrl = "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";
const doctorRobotIconUrl = "icons/doctor.png";

export default function ChatWindow({ messages = [], buttons = [], onUserInput, onFileUpload }) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // Setup Speech Recognition once on mount
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInputText((prev) => (prev ? prev + " " : "") + transcript);
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    if (typeof onUserInput === "function") {
      onUserInput(text);
    }
    setInputText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // FIX: Send the whole button object, not just label
  const handleButtonClick = (btn) => {
    if (typeof onUserInput === "function") {
      onUserInput(btn);
    }
  };

  const handleVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    } else {
      alert("Voice input not supported in this browser.");
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && typeof onFileUpload === "function") {
      onFileUpload(file);
    }
    // Reset file input
    event.target.value = '';
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const renderMarkdown = (text) => {
    const html = marked(text || "");
    return { __html: DOMPurify.sanitize(html) };
  };

  return (
    <div
      style={{
        maxWidth: 480,
        height: 650,
        margin: "auto",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #ddd",
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      {/* Messages Display */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          backgroundColor: "#fafafa",
        }}
      >
        {messages.map((msg, idx) => {
          const displayText =
            typeof msg.text === "string"
              ? msg.text
              : msg.text && typeof msg.text === "object"
              ? JSON.stringify(msg.text)
              : String(msg.text || "");

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                marginBottom: 15,
              }}
            >
              {msg.sender === "bot" && (
                <img
                  src={doctorRobotIconUrl}
                  alt="bot"
                  style={{ width: 36, height: 36, marginRight: 12, flexShrink: 0 }}
                />
              )}
              <div
                style={{
                  maxWidth: "70%",
                  backgroundColor: msg.sender === "user" ? "#007bff" : "#e0e0e0",
                  color: msg.sender === "user" ? "#fff" : "#000",
                  borderRadius: 20,
                  padding: "12px 18px",
                  fontSize: 15,
                  whiteSpace: "pre-wrap",
                }}
              >
                <div dangerouslySetInnerHTML={renderMarkdown(displayText)} />
                {msg.showFileUpload && (
                  <div style={{ marginTop: 15 }}>
                    <button
                      onClick={triggerFileUpload}
                      style={{
                        backgroundColor: "#17a2b8",
                        color: "#fff",
                        border: "none",
                        borderRadius: 20,
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "background-color 0.3s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#138496")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#17a2b8")}
                    >
                      📎 Upload File
                    </button>
                  </div>
                )}
                {msg.image && (
                  <img
                    src={msg.image}
                    alt={displayText}
                    style={{ marginTop: 10, maxWidth: "100%", borderRadius: 8 }}
                  />
                )}
              </div>
              {msg.sender === "user" && (
                <img
                  src={userIconUrl}
                  alt="user"
                  style={{ width: 36, height: 36, marginLeft: 12, flexShrink: 0 }}
                />
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Buttons */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid #ddd",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          backgroundColor: "#f7f7f7",
        }}
      >
        {buttons.map((btn, idx) => (
          <button
            key={idx}
            onClick={() => handleButtonClick(btn)}
            style={{
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: 25,
              cursor: "pointer",
              fontWeight: 600,
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0056b3")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#007bff")}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #ddd",
          padding: "14px 20px",
          backgroundColor: "#fff",
          gap: 12,
        }}
      >
        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          style={{
            flex: 1,
            resize: "none",
            borderRadius: 25,
            border: "1.5px solid #ccc",
            padding: "12px 20px",
            fontSize: 15,
            outline: "none",
          }}
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,.pdf,.txt"
          style={{ display: "none" }}
        />
        <button
          onClick={handleSend}
          style={{
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            cursor: "pointer",
            fontSize: 20,
            fontWeight: "700",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0056b3")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#007bff")}
          aria-label="Send message"
        >
          ➤
        </button>
        <button
          onClick={handleVoiceInput}
          title="Voice input"
          style={{
            backgroundColor: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e7e34")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#28a745")}
          aria-label="Voice input"
        >
          🎤
        </button>
      </div>
    </div>
  );
}