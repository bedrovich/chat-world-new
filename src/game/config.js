// src/game/config.js
export const MAP = { w: 1600, h: 800 };
export const TV_POS = { x: 400, y: -80 };
export const TV_SIZE = { w: 500, h: 300 };
export const PET_BOX_POS = { x: 20, y: 600 };
export const PET_BOX_SIZE = { w: 160, h: 100 };

// Визуальные отступы для игрока
export const PLAYER = {
  bodySize: { w: 50, h: 60 },
  headSize: { w: 40, h: 40 },
  bodyOffsetY: 8,
  headOffsetY: -24,
  nameOffsetY: -56,
  emojiOffsetY: -19,
  emojiFontSize: 26,
  emojiPadding: { top: 4, left: 2 }, 
  nameFontSize: 14
};

// Визуальные отступы для питомца
export const PET = {
  spriteSize: { w: 80, h: 60 },
  nameOffsetY: -32,
  emojiOffsetX: 27,
  emojiOffsetY: -3,
  emojiFontSize: 16,
  emojiPadding: { top: 4, left: 0 },
  nameFontSize: 14,

  flipThreshold: 1.5
};

// Общие настройки
export const BUBBLE = {
  offsetY: -60,
  duration: 3000
};

export const MOVEMENT = {
  speed: 4,
  diagonalFactor: 0.707
};