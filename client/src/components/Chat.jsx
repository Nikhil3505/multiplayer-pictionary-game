import React, { useEffect, useState, useRef } from 'react';

function Chat({ socket, roomId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleChat = (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: 'chat' }]);
    };

    const handleSystem = (msg) => {
      setMessages((prev) => [...prev, { ...msg, isSystem: true }]);
    };

    socket.on('chat_message', handleChat);
    socket.on('system_message', handleSystem);

    return () => {
      socket.off('chat_message', handleChat);
      socket.off('system_message', handleSystem);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      socket.emit('send_message', { roomId, message: inputValue });
      setInputValue('');
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-area">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.isSystem ? 'system ' + msg.type : ''}`}>
            {msg.isSystem ? (
                <span>{msg.text}</span>
            ) : (
                <span><strong>{msg.username}: </strong>{msg.text}</span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your guess here..."
          maxLength={100}
        />
      </form>
    </div>
  );
}

export default Chat;
