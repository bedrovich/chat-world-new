
import React, { useState, useEffect } from 'react';

export const PetModal = ({ isOpen, socket, onClose }) => {
  const [type, setType] = useState('dog');
  const [gender, setGender] = useState('♂️');
  const [color, setColor] = useState('#FFFFFF');
  const [name, setName] = useState('');

  useEffect(() => {
  window.__setPhaserTyping?.(!isOpen);
}, [isOpen]);

  if (!isOpen) return null;

  const create = () => {
    if (!name.trim()) return alert('Введите имя питомца!');
    socket.emit('create_pet', { type, gender, color, name });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>🐾 Создать питомца</h3>
        <div style={{ margin: '10px 0' }}>
          <label>Тип:</label>
          <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
            <option value="dog">🐕 Собака</option>
            <option value="cat">🐈 Кошка</option>
          </select>
        </div>
        <div style={{ margin: '10px 0' }}>
          <label>Пол:</label>
          <select value={gender} onChange={e => setGender(e.target.value)} style={{ width: '100%' }}>
            <option value="♂️">♂ Мальчик</option>
            <option value="♀️">♀ Девочка</option>
          </select>
        </div>
        <div style={{ margin: '10px 0' }}>
          <label>Цвет:</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: '40px' }} />
        </div>
        <div style={{ margin: '10px 0' }}>
          <label>Имя:</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={15} style={{ width: '100%' }} />
        </div>
        <button onClick={create} style={{ width: '100%', padding: '10px', background: '#4f8cff', color: 'white', border: 'none', borderRadius: '8px' }}>✨ Создать</button>
      </div>
    </div>
  );
};