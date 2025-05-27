import React, { useState } from "react";
import SmartTriage from "./pages/SmartTriage";
import WellnessChat from "./pages/WellnessChat";
import SignUpLogin from "./pages/SignUpLogin";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("login");

  return (
    <div className="app">
      <header>
        {activeTab !== "login" && (
          <>
            <button
              className={activeTab === "triage" ? "active" : ""}
              onClick={() => setActiveTab("triage")}
            >
              🤖 Smart Triage
            </button>
            <button
              className={activeTab === "wellness" ? "active" : ""}
              onClick={() => setActiveTab("wellness")}
            >
              💪 Wellness Chat
            </button>
            <button
              style={{ float: "right" }}
              onClick={() => setActiveTab("login")}
            >
              Logout
            </button>
          </>
        )}
      </header>
      <main>
        {activeTab === "login" ? (
          <SignUpLogin onLogin={() => setActiveTab("wellness")} />
        ) : activeTab === "triage" ? (
          <SmartTriage />
        ) : (
          <WellnessChat />
        )}
      </main>
    </div>
  );
}

export default App;