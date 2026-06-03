import React from 'react';

export const MicButton = ({ micEnabled, onToggle }) => {
  return (
    <button id="mic-btn" className={micEnabled ? 'active' : ''} onClick={onToggle}>
      🎤
    </button>
  );
};