import React, { useState, useEffect } from 'react';
import '../styles/Chat.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function Chat({ userId, rideId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'driver',
      text: 'Oi! Vou chegar em 5 minutos',
      timestamp: new Date(Date.now() - 10 * 60000),
      read: true
    },
    {
      id: 2,
      sender: 'user',
      text: 'Perfeito! Estou na porta',
      timestamp: new Date(Date.now() - 8 * 60000),
      read: true
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const message = {
        id: messages.length + 1,
        sender: 'user',
        text: newMessage,
        timestamp: new Date(),
        read: false
      };

      setMessages([...messages, message]);
      setNewMessage('');

      // Simular resposta do motorista
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          sender: 'driver',
          text: 'Ok, entendi!',
          timestamp: new Date(),
          read: false
        }]);
      }, 1000);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>💬 Chat da Corrida</h3>
        <span className="ride-id">#{rideId}</span>
      </div>

      <div className="messages-list">
        {messages.map(message => (
          <div
            key={message.id}
            className={`message-item ${message.sender}`}
          >
            <div className="message-content">
              <p>{message.text}</p>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          placeholder="Digite sua mensagem..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !newMessage.trim()}>
          {loading ? '...' : '📤'}
        </button>
      </form>
    </div>
  );
}

export default Chat;
