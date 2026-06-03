import React from 'react';

export const Coords = ({ players, currentPlayerId }) => {
  const me = players[currentPlayerId];
  if (!me) return null;
  return <div id="cords" style={{ position: 'absolute', top: 15, left: 15, color: '#888', background: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: 6, fontSize: 12, zIndex: 100 }}>X: {Math.floor(me.x)} | Y: {Math.floor(me.y)}</div>;
};