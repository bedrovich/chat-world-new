// src/components/Chat/ChatBox.jsx
import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatBox.module.css';

export const ChatBox = ({ socket, currentPlayerId, players }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const msgEndRef = useRef(null);

  useEffect(() => {
    const onChat = (msg) => {
      const isMe = msg.id === currentPlayerId;
      setMessages(prev => [...prev, { ...msg, isMe }]);
    };
    const onLoad = (history) => {
  const enriched = history.map(msg => ({
    ...msg,
    isMe: msg.isMe !== undefined ? msg.isMe : (msg.id === currentPlayerId)
  }));
  setMessages(enriched);
};
    socket.on('chatMessage', onChat);
    socket.on('load_chat', onLoad);
    return () => {
      socket.off('chatMessage', onChat);
      socket.off('load_chat', onLoad);
    };
  }, [socket, currentPlayerId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Глобальные обработчики для фокуса
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          inputRef.current.blur();
        }
      }
      if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active === inputRef.current) {
          // Отправляем и снимаем фокус
          e.preventDefault();
          send();
          inputRef.current.blur();
        } else {
          // Ставим фокус на чат, только если нет фокуса ни на каком другом инпуте
          const anyInputFocused = document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
          if (!anyInputFocused) {
            e.preventDefault();
            inputRef.current.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [input]);

  const send = () => {
    if (input.trim()) {
      socket.emit('chat', { text: input });
      setInput('');
    }
  };

  return (
    <div className={styles.chatBox}>
      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={m.isMe ? styles.self : styles.other}>
            <b>{m.name}{m.isMe && ' (Вы)'}:</b> {m.text}
          </div>
        ))}
        <div ref={msgEndRef} />
      </div>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Сообщение... (Enter для отправки, Esc снять фокус)"
          maxLength={100}
        />
        <button onClick={send}>➤</button>
      </div>
    </div>
  );
};