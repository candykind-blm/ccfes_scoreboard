const fs = require('fs').promises;
const path = require('path');
const DATA_FILE = path.resolve(__dirname, 'data', 'teams.json');
const BACKUP_FILE = path.resolve(__dirname, 'data', 'teams.bak.json');

async function loadTeams() {
  try {
    const buf = await fs.readFile(DATA_FILE, 'utf8');
    const teams = JSON.parse(buf);
    if (!Array.isArray(teams)) throw new Error('teams.json is not array');
    return teams;
  } catch (err) {
    if (err.code === 'ENOENT') {
      await ensureDefault();
      return loadTeams();
    }
    console.error('[dataStore] loadTeams error', err);
    try {
      const buf = await fs.readFile(BACKUP_FILE, 'utf8');
      const teams = JSON.parse(buf);
      return teams;
    } catch (e2) {
      throw err;
    }
  }
}

async function ensureDefault() {
  const defaultTeams = [...Array(10).keys()].map((i) => ({
    id: i + 1,
    name: `チーム${i + 1}`,
    score: 0,
  }));
  await saveTeams(defaultTeams);
}

async function saveTeams(teams) {
  const tmpFile = DATA_FILE + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(teams, null, 2), 'utf8');
  await fs.rename(DATA_FILE, BACKUP_FILE).catch(() => {});
  await fs.rename(tmpFile, DATA_FILE);
}

async function getTeams() {
  return loadTeams();
}

async function updateTeamScore(id, delta, optScore) {
  const teams = await loadTeams();
  const index = teams.findIndex((t) => t.id === id);
  if (index < 0) throw new Error('team not found');
  if (typeof optScore === 'number') {
    teams[index].score = optScore;
  } else {
    teams[index].score = Number(teams[index].score || 0) + Number(delta || 0);
  }
  if (!Number.isInteger(teams[index].score)) {
    throw new Error('score must be integer');
  }
  await saveTeams(teams);
  return teams[index];
}

async function resetAll() {
  const teams = await loadTeams();
  teams.forEach((t) => (t.score = 0));
  await saveTeams(teams);
  return teams;
}

async function updateTeamName(id, name) {
  if (!name || !name.trim()) {
    throw new Error('team name is required');
  }

  const teams = await loadTeams();
  const index = teams.findIndex((t) => t.id === id);
  if (index < 0) throw new Error('team not found');

  teams[index].name = name.trim();
  await saveTeams(teams);
  return teams[index];
}

module.exports = { getTeams, updateTeamScore, resetAll, updateTeamName };
