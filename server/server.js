const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../client/dist')));

// --- КОНФИГ ---
const MAP = { w: 1600, h: 800 };
const PORT = process.env.PORT || 228;
const PET_BOX_POS = { x: 20, y: 600 };
const TV_POS = { x: 400, y: -80 };

// --- СТЕЙТ ---
const players = {};
const pets = {};
const chatHistory = [];
const tvState = { currentVideoId: null, videoStartTime: 0, isPlaying: true, queue: [] };
let nextPetId = 1;

// --- УТИЛИТЫ ---
function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// 🔥 ЗАГРУЗКА ЭМОДЗИ ИЗ ФАЙЛА
let emojiPool = [];
try {
    // Читаем именно твой файл с подчеркиванием
    const emojiPath = path.join(__dirname, 'emoji-pool.json');
    const emojiData = JSON.parse(fs.readFileSync(emojiPath, 'utf8'));

    // Если файл это массив [...] или объект { "emojis": [...] }
    if (Array.isArray(emojiData)) {
        emojiPool = emojiData;
    } else if (emojiData.emojis && Array.isArray(emojiData.emojis)) {
        emojiPool = emojiData.emojis;
    } else {
        throw new Error("Неверный формат JSON");
    }

    console.log(`🎨 Загружено ${emojiPool.length} эмодзи из файла`);
} catch (err) {
    console.warn(`⚠️ Ошибка чтения emoji_pool.json: ${err.message}. Используем запасной вариант.`);
    // Фоллбэк, если файл вдруг пропадет, чтобы сервер не упал
    emojiPool = ['😀','😎','🔥','👾','🐱','🐶','🦊','🐼','🐨','🦁'];
}

function getRandomEmoji() {
    return emojiPool[Math.floor(Math.random() * emojiPool.length)];
}

function getRandomColor() {
  return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
}

function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11}).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- СОКЕТЫ ---
io.on('connection', (socket) => {
  const ip = socket.handshake.address.replace(/^::ffff:/, '');
  const clientUUID = socket.handshake.query.uuid || generateUUID();
  
  console.log(`[+] ${ip} | UUID: ${clientUUID}`);

  // Проверяем, есть ли сохранённый ник для этого UUID
  const saved = playersByUUID[clientUUID] || playersByIP[ip];
  
  players[socket.id] = {
    id: socket.id,
    uuid: clientUUID,
    ip,
    x: Math.random() * (MAP.w - 100) + 50,
    y: Math.random() * (MAP.h - 100) + 50,
    color: saved?.color || getRandomColor(),
    name: saved?.name || `User_${clientUUID.slice(0, 6)}`,
    emoji: saved?.emoji || getRandomEmoji(),
    mic: false,
    moving: false
  };

  // Сохраняем привязку
  playersByUUID[clientUUID] = {
    name: players[socket.id].name,
    emoji: players[socket.id].emoji,
    color: players[socket.id].color
  };
  playersByIP[ip] = playersByUUID[clientUUID];

  // Отправляем инициализацию
  socket.emit('init', { 
    id: socket.id, 
    players: Object.values(players), 
    pets, 
    map: MAP,
    uuid: clientUUID // <-- Отправляем UUID клиенту для сохранения
  });
  
  socket.emit('chatHistory', chatHistory.slice(-50));
  socket.emit('tv_state', tvState);
  socket.broadcast.emit('playerJoined', players[socket.id]);

  if (!saved?.name) socket.emit('requestNick');

  // --- СОБЫТИЯ ---
  socket.on('setNick', (data) => {
    const cleanName = (data.name || '').trim().substring(0, 15);
    if (!cleanName) return;
    
    const player = players[socket.id];
    if (!player) return;
    
    player.name = cleanName;
    player.emoji = data.emoji || getRandomEmoji();
    player.color = data.color || player.color;
    
    // Сохраняем в персистент
    playersByUUID[player.uuid] = { name: player.name, emoji: player.emoji, color: player.color };
    playersByIP[player.ip] = playersByUUID[player.uuid];
    
    io.emit('playerNameUpdate', { id: socket.id, name: player.name, emoji: player.emoji, color: player.color });
  });

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = Math.max(20, Math.min(MAP.w - 20, data.x));
    p.y = Math.max(20, Math.min(MAP.h - 20, data.y));
    p.moving = true;
    socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y });
  });

  socket.on('stopMove', () => {
    if (players[socket.id]) {
      players[socket.id].moving = false;
      socket.broadcast.emit('playerStopped', { id: socket.id });
    }
  });

  socket.on('chat', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const msg = { id: socket.id, uuid: p.uuid, name: p.name, text: data.text, ts: Date.now() };
    chatHistory.push(msg);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit('chatMessage', msg);

    // Логика вызова питомца
    const msgLower = data.text.toLowerCase().trim();
    for (const pid in pets) {
      const pet = pets[pid];
      if (pet.ownerId === socket.id && pet.state === 'wandering' && Date.now() > pet.canCallAgainAt) {
        const petNameLower = pet.name.toLowerCase();
        // Проверка: точное совпадение ИЛИ имя как отдельное слово
        const isExact = msgLower === petNameLower;
        const hasWordBoundary = new RegExp(`(^|[^а-яёa-z0-9])${petNameLower}([^а-яёa-z0-9]|$)`, 'i').test(msgLower);
        
        if (isExact || hasWordBoundary) {
          pet.state = 'coming';
          pet.canCallAgainAt = Date.now() + 6000; // 3с follow + 3с отдых
          io.emit('pet_speak', { petId: pid, text: pet.type === 'dog' ? 'гав' : 'мяу' });
          break;
        }
      }
    }
  });

  socket.on('create_pet', (data) => {
    const owner = players[socket.id];
    if (!owner) return;
    
    const petId = nextPetId++;
    pets[petId] = {
      id: petId,
      ownerId: socket.id,
      ownerUuid: owner.uuid,
      type: data.type || 'dog',
      gender: data.gender || 'male',
      color: data.color || getRandomColor(),
      name: data.name?.trim() || (data.type === 'dog' ? 'Бобик' : 'Мурка'),
      emoji: owner.emoji,
      x: PET_BOX_POS.x + (Math.random() * 20 - 10),
      y: PET_BOX_POS.y + (Math.random() * 20 - 10),
      targetX: Math.random() * (MAP.w - 100) + 50,
      targetY: Math.random() * (MAP.h - 100) + 50,
      state: 'wandering',
      followUntil: 0,
      cooldownUntil: 0,
      canCallAgainAt: 0
    };
    io.emit('pet_created', pets[petId]);
  });

  // TV события
  socket.on('tv_add', (data) => {
    const videoId = extractYouTubeId(data.url);
    if (!videoId) {
      socket.emit('tv_error', '❌ Неверная ссылка');
      return;
    }
    tvState.currentVideoId = videoId;
    tvState.videoStartTime = Date.now();
    tvState.isPlaying = true;
    io.emit('tv_video_changed', { videoId, startTime: tvState.videoStartTime });
    io.emit('tv_state_update', tvState);
  });

  socket.on('tv_stop', () => {
    tvState.currentVideoId = null;
    tvState.videoStartTime = 0;
    tvState.isPlaying = false;
    io.emit('tv_video_changed', { videoId: null, startTime: 0 });
    io.emit('tv_state_update', tvState);
  });

  socket.on('tv_sync_time', (data) => {
    if (tvState.currentVideoId === data.videoId) {
      tvState.videoStartTime = Date.now() - data.currentTime * 1000;
    }
  });

  socket.on('micToggle', (enabled) => {
    if (players[socket.id]) {
      players[socket.id].mic = enabled;
      io.emit('playerMicUpdate', { id: socket.id, mic: enabled });
    }
  });

  // WebRTC signaling (без изменений)
  socket.on('rtc-offer', (d) => socket.to(d.to).emit('rtc-offer', { from: socket.id, sdp: d.sdp }));
  socket.on('rtc-answer', (d) => socket.to(d.to).emit('rtc-answer', { from: socket.id, sdp: d.sdp }));
  socket.on('rtc-ice', (d) => socket.to(d.to).emit('rtc-ice', { from: socket.id, candidate: d.candidate }));

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      players[socket.id].moving = false;
      socket.broadcast.emit('playerStopped', { id: socket.id });
      // Не удаляем сразу, чтобы питомцы не теряли хозяина при кратком обрыве
      setTimeout(() => {
        if (!players[socket.id]?.reconnected) {
          delete players[socket.id];
          io.emit('playerLeft', socket.id);
        }
      }, 5000);
    }
  });
});

// --- ИГРОВОЙ ЦИКЛ ---
function updatePetsMovement() {
  const now = Date.now();
  for (const id in pets) {
    const pet = pets[id];
    const owner = players[pet.ownerId];
    let targetX = pet.targetX, targetY = pet.targetY;
    const speed = pet.state === 'wandering' ? 1.5 : 3;

    if (pet.state === 'coming' && owner) {
      targetX = owner.x; targetY = owner.y;
      if (Math.hypot(targetX - pet.x, targetY - pet.y) < 20) {
        pet.state = 'following';
        pet.followUntil = now + 3000;
      }
    } else if (pet.state === 'following' && owner) {
      targetX = owner.x; targetY = owner.y;
      if (now >= pet.followUntil) {
        pet.state = 'cooldown';
        pet.cooldownUntil = now + 3000;
      }
    } else if (pet.state === 'cooldown') {
      if (now >= pet.cooldownUntil) {
        pet.state = 'wandering';
        pet.targetX = Math.random() * (MAP.w - 100) + 50;
        pet.targetY = Math.random() * (MAP.h - 100) + 50;
      }
    }

    const dx = targetX - pet.x, dy = targetY - pet.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const angle = Math.atan2(dy, dx);
      pet.x += Math.cos(angle) * speed;
      pet.y += Math.sin(angle) * speed;
    } else if (pet.state === 'wandering') {
      pet.targetX = Math.random() * (MAP.w - 100) + 50;
      pet.targetY = Math.random() * (MAP.h - 100) + 50;
    }

    pet.x = Math.max(30, Math.min(MAP.w - 30, pet.x));
    pet.y = Math.max(30, Math.min(MAP.h - 30, pet.y));
  }
  io.emit('pets_update', pets);
}
setInterval(updatePetsMovement, 50);

// --- ЗАПУСК ---
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

// Хранилища для персистентности
const playersByUUID = {};
const playersByIP = {};