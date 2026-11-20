const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map();
const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
const CHARACTER_PRESETS = {
  racer: { label: 'Racer', accent: '#ef4444' },
  cyber: { label: 'Cyber', accent: '#3b82f6' },
  turbo: { label: 'Turbo', accent: '#22c55e' },
  nitro: { label: 'Nitro', accent: '#eab308' },
};
const VALID_BUTTONS = new Set(['up', 'down', 'left', 'right', 'action', 'dash']);

function generateRoomCode() {
  const num = Math.floor(100 + Math.random() * 900);
  return `PS-${num}`;
}

io.on('connection', (socket) => {
  console.log('Terhubung:', socket.id);

  socket.on('create_room', (callback) => {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    rooms.set(code, {
      hostId: socket.id,
      players: [],
      status: 'lobby',
      roundId: 1,
    });

    socket.join(code);
    socket.data.role = 'host';
    socket.data.roomCode = code;

    console.log(`Room dibuat: ${code}`);
    if (callback) callback({ roomCode: code });
  });

  socket.on('join_room', ({ roomCode, nickname, character }, callback) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);

    if (!room) {
      return callback?.({ ok: false, message: 'Room tidak ditemukan! Cek lagi kodenya.' });
    }
    if (room.players.length >= 4) {
      return callback?.({ ok: false, message: 'Room sudah penuh (maksimal 4 pemain).' });
    }

    // Hindari duplikasi slot jika socket yang sama join ulang
    room.players = room.players.filter((p) => p.id !== socket.id);

    const usedSlots = new Set(room.players.map((p) => p.slot));
    let slot = 1;
    while (usedSlots.has(slot) && slot <= 4) {
      slot++;
    }

    const charKey = CHARACTER_PRESETS[character] ? character : null;
    const preset = charKey ? CHARACTER_PRESETS[charKey] : null;
    const color = preset?.accent || PLAYER_COLORS[(slot - 1) % PLAYER_COLORS.length];

    const player = {
      id: socket.id,
      name: (nickname || '').trim().slice(0, 14) || `Player ${slot}`,
      color,
      slot,
      character: charKey || ['racer', 'cyber', 'turbo', 'nitro'][(slot - 1) % 4],
    };

    room.players.push(player);
    socket.join(cleanCode);
    socket.data.role = 'player';
    socket.data.roomCode = cleanCode;

    io.to(room.hostId).emit('players_updated', room.players);

    console.log(`${player.name} (${player.character}, Slot ${slot}) masuk ke ${cleanCode}`);
    callback?.({ ok: true, player, roomCode: cleanCode });
  });

  socket.on('game_state_change', ({ roomCode, status }) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room || room.hostId !== socket.id) return;
    if (!['lobby', 'playing', 'finished'].includes(status)) return;
    room.status = status;
    io.to(cleanCode).emit('room_status', status);
  });

  socket.on('reset_round', ({ roomCode }) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room || room.hostId !== socket.id) return;
    room.status = 'lobby';
    room.roundId += 1;
    io.to(cleanCode).emit('room_status', 'lobby');
    io.to(room.hostId).emit('round_reset', { roundId: room.roundId });
  });

  socket.on('controller_input', ({ roomCode, button, pressed }) => {
    if (!VALID_BUTTONS.has(button)) return;
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) return;

    io.to(room.hostId).emit('player_input', {
      playerId: socket.id,
      button,
      pressed: Boolean(pressed),
    });
  });

  socket.on('disconnect', () => {
    const { role, roomCode } = socket.data || {};
    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);

    if (role === 'host') {
      io.to(roomCode).emit('host_disconnected');
      rooms.delete(roomCode);
      console.log(`Room ditutup: ${roomCode}`);
    } else if (role === 'player') {
      room.players = room.players.filter((p) => p.id !== socket.id);
      io.to(room.hostId).emit('players_updated', room.players);
      console.log(`Player keluar dari ${roomCode}`);
    }
  });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Pocket Console jalan di port ${PORT}`);
});