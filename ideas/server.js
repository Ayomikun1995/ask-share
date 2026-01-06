const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Simple file-based persistence (synchronous for brevity)
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { ideas: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// ensure db exists
if (!fs.existsSync(DB_FILE)) saveDB({ ideas: [] });

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  // send the current ideas
  const db = loadDB();
  socket.emit('initial-ideas', db.ideas);

  // store user info on socket
  socket.on('join', ({ name, profession }) => {
    socket.data.name = name || 'Anonymous';
    socket.data.profession = profession || 'Unknown';
    console.log(`${socket.data.name} (${socket.data.profession}) joined`);
  });

  // when client posts a new idea
  socket.on('post-idea', (payload) => {
    const db = loadDB();
    const idea = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      title: (payload.title || '').slice(0, 200),
      body: (payload.body || '').slice(0, 2000),
      author: socket.data.name || 'Anonymous',
      profession: socket.data.profession || 'Unknown',
      audience: payload.audience || 'All', // 'All' or a specific profession
      createdAt: new Date().toISOString(),
      likes: 0
    };
    db.ideas.unshift(idea); // newest first
    saveDB(db);

    // broadcast to everyone
    io.emit('idea', idea);
    console.log('new idea by', idea.author, 'audience:', idea.audience);
  });

  // simple like event
  socket.on('like-idea', (ideaId) => {
    const db = loadDB();
    const item = db.ideas.find(i => i.id === ideaId);
    if (item) {
      item.likes = (item.likes || 0) + 1;
      saveDB(db);
      io.emit('idea-like', { id: ideaId, likes: item.likes });
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Idea Exchange server listening at http://localhost:${PORT}`);
});