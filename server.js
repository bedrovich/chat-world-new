const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Раздаём статику из папки dist после сборки (или public для разработки)
app.use(express.static(path.join(__dirname, 'dist')));

const players = {};
const ipToNick = {};
const MAP = { w: 1600, h: 800 };
const PORT = process.env.PORT || 228;

const PET_BOX_POS = { x: 20, y: 600 };

let pets = {};
let nextPetId = 1;

const CHAT_HISTORY_FILE = './chat-history.json';
let chatHistory = [];
fs.writeFileSync(CHAT_HISTORY_FILE, '[]');
try { chatHistory = JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, 'utf8')); } catch(e) {}
function saveChat() { fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory.slice(-50))); }

const tvState = { currentVideoId: null, videoStartTime: 0, isPlaying: true, queue: [] };

let emojiPool = [];
try {
  const emojiPath = path.join(__dirname, 'public', 'emoji-pool.json');
  const emojiData = JSON.parse(fs.readFileSync(emojiPath, 'utf8'));
  emojiPool = emojiData.emojis || ['👾'];
} catch (err) { emojiPool = ['👾']; }

function getRandomEmoji() { return emojiPool[Math.floor(Math.random() * emojiPool.length)]; }
function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
function broadcastTvState() { io.emit('tv_state', { currentVideoId: tvState.currentVideoId, videoStartTime: tvState.videoStartTime, isPlaying: tvState.isPlaying }); }

// Старая функция
function randomRgb() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256)
  };
}

io.on('connection', (socket) => {
  const ip = socket.handshake.address.replace(/^::ffff:/, '');
  console.log(`[CONNECT] ${ip} ${socket.id}`);

  // Восстановление питомцев по IP
  for (const pid in pets) {
    if (pets[pid].ownerIp === ip) {
      pets[pid].ownerId = socket.id;
      pets[pid].state = 'wandering';
      pets[pid].targetX = Math.random() * (MAP.w - 100) + 50;
      pets[pid].targetY = Math.random() * (MAP.h - 100) + 50;
    }
  }

  const saved = ipToNick[ip];
  players[socket.id] = {
    id: socket.id, 
    x: 69, y: 69, 
    color: saved?.color || randomRgb(),
    name: saved?.name || `User_${socket.id.slice(0, 4)}`, mic: false, moving: false,
    emoji: saved?.emoji || getRandomEmoji()
  };
  socket.emit('init', { id: socket.id, players, map: MAP });
  const historyForClient = chatHistory.slice(-50).map(m => ({ ...m, isMe: m.ip === ip }));
  socket.emit('load_chat', historyForClient);
  socket.emit('tv_state', tvState);
  socket.broadcast.emit('playerJoined', players[socket.id]);
  if (!saved?.name) socket.emit('requestNick');

  socket.on('setNick', (nick) => {
    const clean = { name: (nick || '').trim().substring(0, 15), emoji: getRandomEmoji(), color: randomRgb() };
    ipToNick[ip] = clean;
    if (players[socket.id]) {
      players[socket.id].name = clean.name;
      players[socket.id].emoji = clean.emoji;
      players[socket.id].color = clean.color;
      io.emit('playerNameUpdate', { id: socket.id, name: clean.name, emoji: clean.emoji, color: clean.color });
    }
  });

  socket.on('create_pet', (data) => {
    const petId = nextPetId++;
    pets[petId] = {
      id: petId, ownerId: socket.id, ownerIp: ip, type: data.type, gender: data.gender,
      color: data.color, name: data.name || (data.type === 'dog' ? 'Бобик' : 'Мурка'),
      emoji: players[socket.id].emoji, x: PET_BOX_POS.x, y: PET_BOX_POS.y,
      targetX: Math.random() * (MAP.w - 100) + 50, targetY: Math.random() * (MAP.h - 100) + 50,
      state: 'wandering', followUntil: 0, cooldownUntil: 0, canCallAgainAt: 0
    };
    io.emit('pet_created', pets[petId]);
  });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x; players[socket.id].y = data.y;
      players[socket.id].moving = true;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y, moving: true });
    }
  });
  socket.on('stopMove', () => {
    if (players[socket.id]) players[socket.id].moving = false;
    socket.broadcast.emit('playerStopped', { id: socket.id });
  });

  socket.on('chat', (data) => {
    const senderName = players[socket.id]?.name || 'Anon';
    const senderIp = socket.handshake.address.replace(/^::ffff:/, '');
    const msg = data.text.trim();
    chatHistory.push({ id: socket.id, ip: senderIp, name: senderName, text: msg, ts: Date.now() });
    saveChat();
    io.emit('chatMessage', { id: socket.id, name: senderName, text: msg, ts: Date.now() });
    // Вызов питомца по имени
    const msgLower = msg.toLowerCase();
    for (const pid in pets) {
      const pet = pets[pid];
      if (pet.ownerId === socket.id && pet.state === 'wandering' && Date.now() > pet.canCallAgainAt) {
        const petName = pet.name.toLowerCase();
        if (msgLower.includes(petName)) {
          pet.state = 'coming';
          pet.canCallAgainAt = Date.now() + 6000;
          io.emit('pet_speak', { petId: pid, text: pet.type === 'dog' ? 'гав' : 'мяу' });
          break;
        }
      }
    }
  });

  socket.on('tv_add', (data) => {
    const videoId = extractYouTubeId(data.url);
    if (!videoId) { socket.emit('tv_error', '❌ Неверная ссылка'); return; }
    tvState.currentVideoId = videoId;
    tvState.videoStartTime = Date.now();
    tvState.isPlaying = true;
    tvState.queue = [];
    io.emit('tv_video_changed', { videoId, startTime: tvState.videoStartTime });
    broadcastTvState();
  });
  socket.on('tv_stop', () => {
    tvState.currentVideoId = null;
    tvState.videoStartTime = 0;
    tvState.isPlaying = false;
    tvState.queue = [];
    io.emit('tv_video_changed', { videoId: null, startTime: 0 });
    broadcastTvState();
  });
  socket.on('request_tv_state', () => socket.emit('tv_state', tvState));

  socket.on('micToggle', (enabled) => {
    if (players[socket.id]) players[socket.id].mic = enabled;
    io.emit('playerMicUpdate', { id: socket.id, mic: enabled });
  });

  // WebRTC signaling
  socket.on('rtc-offer', (data) => socket.to(data.to).emit('rtc-offer', { from: socket.id, sdp: data.sdp }));
  socket.on('rtc-answer', (data) => socket.to(data.to).emit('rtc-answer', { from: socket.id, sdp: data.sdp }));
  socket.on('rtc-ice', (data) => socket.to(data.to).emit('rtc-ice', { from: socket.id, candidate: data.candidate }));

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

// Движение питомцев (как в оригинале)
function updatePetsMovement(speed) {
  const now = Date.now();
  for (const id in pets) {
    const pet = pets[id];
    const owner = players[pet.ownerId];
    let targetX, targetY;
    const moveSpeed = pet.state === 'wandering' ? speed : 5;
    if (pet.state === 'coming' && owner) {
      targetX = owner.x + (Math.random() * 80 - 40);
      targetY = owner.y + 40;
      if (Math.hypot(targetX - pet.x, targetY - pet.y) < 15) {
        pet.state = 'following';
        pet.followUntil = now + 500;
      }
    } else if (pet.state === 'following' && owner) {
      targetX = owner.x + (Math.random() * 80 - 40);
      targetY = owner.y + 40;
      if (now >= pet.followUntil) { pet.state = 'cooldown'; pet.cooldownUntil = now + 2000; }
    } else if (pet.state === 'cooldown') {
      targetX = pet.x; targetY = pet.y;
      if (now >= pet.cooldownUntil) { pet.state = 'wandering'; pet.targetX = Math.random() * (MAP.w - 100) + 50; pet.targetY = Math.random() * (MAP.h - 100) + 50; }
    } else {
      targetX = pet.targetX; targetY = pet.targetY;
    }
    const dx = targetX - pet.x, dy = targetY - pet.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      const angle = Math.atan2(dy, dx);
      pet.x += Math.cos(angle) * moveSpeed;
      pet.y += Math.sin(angle) * moveSpeed;
    } else if (pet.state === 'wandering') {
      pet.targetX = Math.random() * (MAP.w - 100) + 50;
      pet.targetY = Math.random() * (MAP.h - 100) + 50;
    }
    pet.x = Math.max(30, Math.min(MAP.w - 30, pet.x));
    pet.y = Math.max(30, Math.min(MAP.h - 30, pet.y));
  }
  io.emit('pets_update', pets);
}
setInterval(() => updatePetsMovement(2.5), 1000/60);

server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));