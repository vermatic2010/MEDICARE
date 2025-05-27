// client/src/components/ChatMessage.js
import React from 'react';
import './ChatMessage.css';

const ChatMessage = ({ from, text }) => {
  const iconUrl = from === 'bot'
    ? 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png' // doctor robot icon
    : 'https://cdn-icons-png.flaticon.com/512/4712/4712105.png'; // user icon

  return (
    <div className={`chat-message ${from}`}>
      <img src={iconUrl} alt="icon" className="icon" />
      <div className="text">{text}</div>
    </div>
  );
};

export default ChatMessage;
