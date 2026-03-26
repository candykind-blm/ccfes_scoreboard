// Socket.io初期化 + フォールバック
let socket = null;
let usePolling = false;
let lastTeamsData = null;

try {
  if (typeof io !== 'undefined') {
    socket = io();
  } else {
    usePolling = true;
  }
} catch (err) {
  console.warn('Socket.io unavailable, using fallback polling', err);
  usePolling = true;
}

// Socket.ioが接続できなかった場合のフォールバック処理
if (socket) {
  socket.on('connect_error', () => {
    console.warn('Socket.io connection failed, switching to polling');
    usePolling = true;
  });
}

async function getTeams() {
  const res = await fetch('/api/teams');
  return res.ok ? res.json() : [];
}

async function setScore(id, payload) {
  const res = await fetch(`/api/teams/${id}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function resetAll() {
  const res = await fetch('/api/teams/reset-all', { method: 'POST' });
  return res.json();
}

function padScore(score) {
  // 全体方針: 余計な0を付けない
  return String(score);
}

function renderTeams(teams, root, isOverlay = false) {
  root.innerHTML = '';
  teams.forEach((team) => {
    const cell = document.createElement('div');
    cell.className = isOverlay ? 'team-card overlay-item' : 'team-card';

    const name = document.createElement('div');
    name.className = 'team-name';
    name.textContent = team.name;

    const scoreBox = document.createElement('div');
    scoreBox.className = 'team-score';
    scoreBox.textContent = padScore(team.score);

    cell.append(name, scoreBox);

    if (!isOverlay) {
      const nameEditWrapper = document.createElement('div');
      nameEditWrapper.style.display = 'flex';
      nameEditWrapper.style.gap = '6px';
      nameEditWrapper.style.marginTop = '6px';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = team.name;
      nameInput.style.flex = '1';
      nameInput.style.padding = '8px';
      nameInput.style.border = '1px solid #bbc4d8';
      nameInput.style.borderRadius = '8px';

      const nameSave = document.createElement('button');
      nameSave.textContent = '名前変更';
      nameSave.className = 'primary';
      nameSave.style.flex = '0 0 auto';
      nameSave.onclick = async () => {
        const newName = (nameInput.value || '').trim();
        if (!newName) {
          alert('チーム名を入力してください。');
          return;
        }
        await fetch(`/api/teams/${team.id}/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });
      };

      nameEditWrapper.append(nameInput, nameSave);
      cell.append(nameEditWrapper);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const deltaActions = document.createElement('div');
      deltaActions.className = 'action-group';
      const deltaTitle = document.createElement('div');
      deltaTitle.className = 'action-group-title';
      deltaTitle.textContent = '加算／減算';
      deltaActions.append(deltaTitle);

      const deltaButtonsRow = document.createElement('div');
      deltaButtonsRow.className = 'action-row';
      const add100 = document.createElement('button');
      add100.textContent = '+100';
      add100.onclick = async () => await setScore(team.id, { delta: 100 });

      const add500 = document.createElement('button');
      add500.textContent = '+500';
      add500.onclick = async () => await setScore(team.id, { delta: 500 });

      const add1000 = document.createElement('button');
      add1000.textContent = '+1000';
      add1000.onclick = async () => await setScore(team.id, { delta: 1000 });

      deltaButtonsRow.append(add100, add500, add1000);

      const deltaInputRow = document.createElement('div');
      deltaInputRow.className = 'action-row';
      const deltaInput = document.createElement('input');
      deltaInput.type = 'number';
      deltaInput.value = 0;
      deltaInput.placeholder = '例: 50 または -20';
      deltaInput.title = '指定した数値を現在の得点に加算/減算します';

      const applyDelta = document.createElement('button');
      applyDelta.textContent = '加算/減算反映';
      applyDelta.className = 'primary';
      applyDelta.onclick = async () => {
        const delta = Number(deltaInput.value);
        if (!Number.isFinite(delta) || delta === 0) return;
        await setScore(team.id, { delta });
        deltaInput.value = 0;
      };

      deltaInputRow.append(deltaInput, applyDelta);
      deltaActions.append(deltaButtonsRow, deltaInputRow);

      const setActions = document.createElement('div');
      setActions.className = 'action-group';
      const setTitle = document.createElement('div');
      setTitle.className = 'action-group-title';
      setTitle.textContent = '合計（直接設定）';
      setActions.append(setTitle);

      const setRow = document.createElement('div');
      setRow.className = 'action-row';

      const setInput = document.createElement('input');
      setInput.type = 'number';
      setInput.value = team.score;
      setInput.placeholder = '例: 1500';
      setInput.title = 'この値に完全に置き換えます';

      const setButton = document.createElement('button');
      setButton.textContent = '合計設定';
      setButton.className = 'primary';
      setButton.onclick = async () => {
        const score = Number(setInput.value);
        if (!Number.isFinite(score)) return;
        await setScore(team.id, { score });
      };

      const resetButton = document.createElement('button');
      resetButton.textContent = '0 に戻す';
      resetButton.className = 'fail';
      resetButton.onclick = async () => await setScore(team.id, { score: 0 });

      setRow.append(setInput, setButton, resetButton);
      setActions.append(setRow);
      actions.append(deltaActions, setActions);
      cell.append(actions);
    }

    root.append(cell);
  });
}

async function initAdmin() {
  const root = document.getElementById('admin-grid');
  const resetButton = document.getElementById('reset');
  const overlayToggleButton = document.getElementById('overlay-toggle');

  let overlayVisible = true;
  const updateOverlayButtonText = () => {
    overlayToggleButton.textContent = overlayVisible ? 'オーバーレイを隠す' : 'オーバーレイを表示';
    overlayToggleButton.classList.toggle('overlay-on', overlayVisible);
    overlayToggleButton.classList.toggle('overlay-off', !overlayVisible);
    const statusEl = document.getElementById('overlay-status');
    if (!statusEl) return;
    statusEl.textContent = overlayVisible ? 'オーバーレイ: 表示中' : 'オーバーレイ: 非表示';
    statusEl.classList.toggle('visible', overlayVisible);
    statusEl.classList.toggle('hidden', !overlayVisible);
  };

  const teams = await getTeams();
  renderTeams(teams, root, false);

  resetButton.onclick = async () => {
    if (!confirm('本当に全チームの得点をリセットしますか？')) return;
    await resetAll();
  };

  overlayToggleButton.onclick = async () => {
    overlayVisible = !overlayVisible;
    if (socket) {
      socket.emit('toggle-overlay', overlayVisible);
    }
    updateOverlayButtonText();
  };

  if (socket) {
    socket.on('overlay:visibility', ({ visible }) => {
      overlayVisible = visible;
      updateOverlayButtonText();
    });

    socket.on('teams:update', (teams) => renderTeams(teams, root, false));
  }

  // ポーリングフォールバック
  if (usePolling) {
    const pollAdmin = setInterval(async () => {
      const teams = await getTeams();
      if (JSON.stringify(teams) !== JSON.stringify(lastTeamsData)) {
        renderTeams(teams, root, false);
        lastTeamsData = teams;
      }
    }, 1000); // 1秒ごとにポーリング
  }

  updateOverlayButtonText();
}

async function initOverlay() {
  const root = document.getElementById('overlay-grid');
  const teams = await getTeams();
  renderTeams(teams, root, true);

  const setOverlayVisibility = (visible) => {
    if (visible) {
      document.body.classList.remove('overlay-hidden');
    } else {
      document.body.classList.add('overlay-hidden');
    }
  };

  if (socket) {
    socket.on('teams:update', (teams) => renderTeams(teams, root, true));
    socket.on('overlay:visibility', ({ visible }) => setOverlayVisibility(visible));
  }

  // ポーリングフォールバック
  if (usePolling) {
    const pollOverlay = setInterval(async () => {
      const teams = await getTeams();
      if (JSON.stringify(teams) !== JSON.stringify(lastTeamsData)) {
        renderTeams(teams, root, true);
        lastTeamsData = teams;
      }
    }, 1000); // 1秒ごとにポーリング
  }
}

if (document.getElementById('admin-grid')) {
  initAdmin();
}
if (document.getElementById('overlay-grid')) {
  initOverlay();
}
