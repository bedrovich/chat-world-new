// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 228;
const MAP = { w: 1600, h: 800 };

// Стейт
let players = {};
let pets = {};
let chatHistory = [];

// Загрузка истории
try {
  if (fs.existsSync('chat_history.json')) {
    chatHistory = JSON.parse(fs.readFileSync('chat_history.json'));
  }
} catch (e) {}

function saveChat() {
  fs.writeFileSync('chat_history.json', JSON.stringify(chatHistory.slice(-50)));
}

io.on('connection', (socket) => {
  const ip = socket.handshake.address.replace(/^::ffff:/, '');
  console.log(`[+] ${ip}`);

  // Инициализация игрока
  players[socket.id] = {
    id: socket.id,
    x: 400, y: 400,
    name: `User_${socket.id.slice(0,4)}`,
    color: '#ffffff',
    emoji: '😀'
  };

  socket.emit('init', { id: socket.id, players, map: MAP });
  socket.emit('chat_history', chatHistory);
  socket.emit('pets_update', pets);

  // Сокеты событий
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });

  socket.on('chat', (data) => {
    const msg = { id: socket.id, name: players[socket.id].name, text: data.text, ts: Date.now() };
    chatHistory.push(msg);
    saveChat();
    io.emit('chatMessage', msg);
  });

  // ... остальные события из твоего старого server.js
});

server.listen(PORT, () => console.log(`Server on ${PORT}`));