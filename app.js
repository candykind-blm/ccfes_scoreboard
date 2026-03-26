require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { getTeams, updateTeamScore, resetAll, updateTeamName } = require('./dataStore');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await getTeams();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load teams', detail: err.message });
  }
});

app.post('/api/teams/:id/score', async (req, res) => {
  const id = Number(req.params.id);
  const { score, delta } = req.body;

  try {
    const updated = await updateTeamScore(id, delta === undefined ? 0 : delta, score);
    io.emit('teams:update', await getTeams());
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/teams/:id/name', async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;

  try {
    const updated = await updateTeamName(id, name);
    io.emit('teams:update', await getTeams());
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/teams/reset-all', async (req, res) => {
  try {
    const teams = await resetAll();
    io.emit('teams:update', teams);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let overlayVisible = true;

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.emit('overlay:visibility', { visible: overlayVisible });

  socket.on('toggle-overlay', (visible) => {
    overlayVisible = Boolean(visible);
    io.emit('overlay:visibility', { visible: overlayVisible });
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Scoreboard server listening on http://localhost:${PORT}`);
});
