import React, { useState } from "react";
import SmartTriage from "./pages/SmartTriage";
import WellnessChat from "./pages/WellnessChat";
import SignUpLogin from "./pages/SignUpLogin";
import VideoCallPage from "./pages/VideoCallPage";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("login");
  const [userRole, setUserRole] = useState("patient"); // Track logged-in user role
  const [user, setUser] = useState(null); // Track logged-in user data

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
              className={activeTab === "video-call" ? "active" : ""}
              onClick={() => setActiveTab("video-call")}
            >
              � Telehealth
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
          <SignUpLogin
            onLogin={(role, userData) => {
              setUserRole(role);
              setUser(userData); // Store complete user data
              setActiveTab("wellness");
            }}
          />
        ) : activeTab === "triage" ? (
          <SmartTriage role={userRole} user={user} onNavigate={setActiveTab} />
        ) : activeTab === "video-call" ? (
          <VideoCallPage role={userRole} user={user} onNavigate={setActiveTab} />
        ) : (
          <WellnessChat user={user} onNavigate={setActiveTab} />
        )}
      </main>
    </div>
  );
}

export default App;