import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';

export const Game = ({ socket, players, pets, currentPlayerId, onReady }) => {
  const gameRef = useRef(null);
  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#1a1a24',
      scene: [BootScene, WorldScene],
      scale: { mode: Phaser.Scale.RESIZE },
      physics: { default: 'arcade', arcade: { debug: false } },
      roundPixels: true   // ← добавить эту строку

    };
    gameRef.current = new Phaser.Game(config);
    gameRef.current.registry.set('socket', socket);
    gameRef.current.registry.set('playersData', players);
    gameRef.current.registry.set('petsData', pets);
    gameRef.current.registry.set('currentPlayerId', currentPlayerId);
    gameRef.current.registry.set('onGameReady', onReady);
    
    // Регистрируем функцию для управления флагом печати
    gameRef.current.registry.set('setTyping', (callback) => {
      window.__setPhaserTyping = callback;
    });
    
    return () => {
      if (gameRef.current) gameRef.current.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.registry.set('playersData', players);
      gameRef.current.registry.set('petsData', pets);
      gameRef.current.registry.set('currentPlayerId', currentPlayerId);
    }
  }, [players, pets, currentPlayerId]);

  return <div id="game-container" style={{ width: '100%', height: '100%' }} />;
};