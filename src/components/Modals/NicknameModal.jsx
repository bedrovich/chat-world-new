
import React, { useState, useEffect } from 'react';

export const NicknameModal = ({ isOpen, socket, onClose }) => {
  const [nick, setNick] = useState('');
  
  useEffect(() => {
    window.__setPhaserTyping?.(isOpen);
  }, [isOpen]);
  
  if (!isOpen) return null;
  const submit = () => {
    if (nick.trim()) {
      socket.emit('setNick', nick);
      onClose();
    }
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Никнейм:</h3>
        <input type="text" value={nick} onChange={e => setNick(e.target.value)} placeholder="Введите ник" maxLength={15} autoFocus />
        <button onClick={submit}>Войти</button>
      </div>
    </div>
  );
};