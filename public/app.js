const PLAYER_KEY = "typingPlayerId";
const EXPIRES_KEY = "typingSessionExpiresAt";

const state = {
  playerId: localStorage.getItem(PLAYER_KEY) || "",
  expiresAt: Number(localStorage.getItem(EXPIRES_KEY) || 0),
  passage: "",
  roundDuration: 60,
  roundTimeLeft: 60,
  startedAt: 0,
  running: false,
  timerHandle: null,
  correctChars: 0,
  typedChars: 0,
  particles: [],
  particleRunning: false,
};

const refs = {
  playerId: document.getElementById("playerId"),
  sessionTimer: document.getElementById("sessionTimer"),
  startBtn: document.getElementById("startBtn"),
  newTextBtn: document.getElementById("newTextBtn"),
  statusText: document.getElementById("statusText"),
  wpmLive: document.getElementById("wpmLive"),
  charsLive: document.getElementById("charsLive"),
  accLive: document.getElementById("accLive"),
  roundTimer: document.getElementById("roundTimer"),
  progressBar: document.getElementById("progressBar"),
  passage: document.getElementById("passage"),
  typingInput: document.getElementById("typingInput"),
  resultPanel: document.getElementById("resultPanel"),
  resultWpm: document.getElementById("resultWpm"),
  resultAcc: document.getElementById("resultAcc"),
  resultTier: document.getElementById("resultTier"),
  bestWpm: document.getElementById("bestWpm"),
  refreshBoardBtn: document.getElementById("refreshBoardBtn"),
  leaderboardList: document.getElementById("leaderboardList"),
  activeSessionsMeta: document.getElementById("activeSessionsMeta"),
  particleCanvas: document.getElementById("particleCanvas"),
  podium1: document.getElementById("podium1"),
  podium2: document.getElementById("podium2"),
  podium3: document.getElementById("podium3"),
};

const particleCtx = refs.particleCanvas.getContext("2d");

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setStatus(text) {
  refs.statusText.textContent = text;
}

function getTier(wpm) {
  if (wpm >= 84) return { name: "Mythic", colors: ["#ffd166", "#ff4f8b", "#ffffff"] };
  if (wpm >= 64) return { name: "Diamond", colors: ["#9a7dff", "#3fe0ff", "#ffffff"] };
  if (wpm >= 48) return { name: "Platinum", colors: ["#3fe0ff", "#6ef7a6", "#ffffff"] };
  if (wpm >= 32) return { name: "Gold", colors: ["#ffd166", "#ff9f43", "#ffffff"] };
  if (wpm >= 18) return { name: "Silver", colors: ["#c4d5e6", "#9ac2d8", "#ffffff"] };
  return { name: "Rookie", colors: ["#8ca7b8", "#3fe0ff", "#ffffff"] };
}

function tierClass(wpm) {
  const tier = getTier(wpm).name.toLowerCase();
  return `podium-${tier}`;
}

function renderPodium(rows) {
  const slots = [refs.podium1, refs.podium2, refs.podium3];
  slots.forEach((slot, idx) => {
    if (!slot) return;
    const row = rows[idx];
    slot.className = "podium-slot";
    if (!row) {
      slot.innerHTML = `<div class='podium-content'><span class='podium-rank'>#${idx + 1}</span><span class='podium-name'>Waiting...</span><span class='podium-speed'>-- WPM</span><span class='tier-badge'>No Tier</span></div>`;
      return;
    }

    const tier = getTier(row.bestWpm).name;
    slot.classList.add("active", tierClass(row.bestWpm));
    slot.innerHTML =
      `<div class='podium-content'>` +
      `<span class='podium-rank'>#${idx + 1}</span>` +
      `<span class='podium-name'>${row.maskedPlayerId}</span>` +
      `<span class='podium-speed'>${row.bestWpm} WPM</span>` +
      `<span class='tier-badge'>${tier}</span>` +
      `</div>`;
  });
}

function resizeParticleCanvas() {
  refs.particleCanvas.width = window.innerWidth;
  refs.particleCanvas.height = window.innerHeight;
}

function spawnBurst(tier) {
  const count = tier.name === "Mythic" ? 130 : tier.name === "Diamond" ? 110 : tier.name === "Platinum" ? 90 : 70;
  const centerX = window.innerWidth * 0.5;
  const centerY = window.innerHeight * 0.35;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 5;
    const life = 700 + Math.random() * 700;
    state.particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      gravity: 0.03 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
      color: tier.colors[Math.floor(Math.random() * tier.colors.length)],
      alpha: 1,
      life,
      bornAt: performance.now(),
    });
  }

  if (!state.particleRunning) {
    state.particleRunning = true;
    requestAnimationFrame(runParticles);
  }
}

function runParticles(nowMs) {
  particleCtx.clearRect(0, 0, refs.particleCanvas.width, refs.particleCanvas.height);

  state.particles = state.particles.filter((p) => {
    const age = nowMs - p.bornAt;
    if (age > p.life) return false;
    p.alpha = Math.max(0, 1 - age / p.life);
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;

    particleCtx.globalAlpha = p.alpha;
    particleCtx.fillStyle = p.color;
    particleCtx.beginPath();
    particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    particleCtx.fill();
    return true;
  });

  particleCtx.globalAlpha = 1;

  if (state.particles.length > 0) {
    requestAnimationFrame(runParticles);
  } else {
    state.particleRunning = false;
  }
}

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateSessionTimer() {
  const ms = Math.max(0, state.expiresAt - Date.now());
  refs.sessionTimer.textContent = formatSeconds(Math.floor(ms / 1000));
}

function renderLeaderboard(data) {
  const rows = data.leaderboard || [];
  refs.activeSessionsMeta.textContent = `Active sessions: ${data.activeSessions || 0}`;
  renderPodium(rows);

  if (!rows.length) {
    refs.leaderboardList.innerHTML = "<div class='status'>No scores yet. Finish a round to appear here.</div>";
    return;
  }

  refs.leaderboardList.innerHTML = rows
    .map(
      (row, idx) =>
        `<div class='leader-row'><span>${idx + 1}</span><strong>${row.maskedPlayerId}</strong><span>${row.bestWpm} WPM</span><span>${row.attempts} run(s)</span></div>`
    )
    .join("");
}

async function loadActiveLeaderboard() {
  try {
    const data = await api("/api/leaderboard/active?limit=15", { method: "GET" });
    renderLeaderboard(data);
  } catch (err) {
    refs.activeSessionsMeta.textContent = `Leaderboard unavailable: ${err.message}`;
  }
}

function saveSession() {
  localStorage.setItem(PLAYER_KEY, state.playerId);
  localStorage.setItem(EXPIRES_KEY, String(state.expiresAt));
}

async function ensureSession() {
  try {
    if (state.playerId) {
      const data = await api(`/api/session/${encodeURIComponent(state.playerId)}`, { method: "GET" });
      state.playerId = data.playerId;
      state.expiresAt = data.expiresAt;
      saveSession();
      refs.playerId.textContent = state.playerId;
      return;
    }
  } catch {
    // Expired/invalid: create a fresh session.
  }

  const data = await api("/api/session/new", { method: "POST" });
  state.playerId = data.playerId;
  state.expiresAt = data.expiresAt;
  saveSession();
  refs.playerId.textContent = state.playerId;
}

async function renewSession() {
  if (!state.playerId) return ensureSession();
  try {
    const data = await api("/api/session/renew", {
      method: "POST",
      body: JSON.stringify({ playerId: state.playerId }),
    });
    state.playerId = data.playerId;
    state.expiresAt = data.expiresAt;
    saveSession();
    refs.playerId.textContent = state.playerId;
  } catch {
    await ensureSession();
    setStatus("Session renewed with a new player ID.");
  }
}

async function loadPassage() {
  const data = await api("/api/passage", { method: "GET" });
  state.passage = String(data.passage || "");
  renderPassage("");
}

function renderPassage(input) {
  const typed = input || "";
  const chars = state.passage.split("");
  refs.passage.innerHTML = chars
    .map((char, index) => {
      let cls = "char";
      if (index < typed.length) {
        cls += typed[index] === char ? " correct" : " incorrect";
      } else if (index === typed.length && state.running) {
        cls += " current";
      }
      const safe = char === " " ? " " : char;
      return `<span class='${cls}'>${safe}</span>`;
    })
    .join("");
}

function liveMetrics(input) {
  const typed = input.length;
  const correct = input.split("").filter((c, i) => c === state.passage[i]).length;
  state.correctChars = correct;
  state.typedChars = typed;

  const elapsedSec = Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000));
  const wpm = Math.round((correct / 5 / elapsedSec) * 60);
  const acc = typed === 0 ? 100 : (correct / typed) * 100;

  refs.wpmLive.textContent = String(Math.max(0, wpm));
  refs.charsLive.textContent = String(correct);
  refs.accLive.textContent = `${acc.toFixed(1)}%`;
}

function resetRoundUi() {
  refs.typingInput.value = "";
  refs.wpmLive.textContent = "0";
  refs.charsLive.textContent = "0";
  refs.accLive.textContent = "100%";
  refs.progressBar.style.width = "0%";
  refs.resultPanel.classList.remove("show");
  renderPassage("");
}

async function startRound() {
  await renewSession();
  state.roundDuration = 60;
  state.roundTimeLeft = state.roundDuration;
  state.startedAt = Date.now();
  state.running = true;

  resetRoundUi();
  refs.typingInput.disabled = false;
  refs.typingInput.focus();
  refs.roundTimer.textContent = String(state.roundTimeLeft);
  setStatus("Round live. Type as fast and accurately as possible.");

  clearInterval(state.timerHandle);
  state.timerHandle = setInterval(() => {
    state.roundTimeLeft -= 1;
    refs.roundTimer.textContent = String(Math.max(0, state.roundTimeLeft));

    const progress = ((state.roundDuration - state.roundTimeLeft) / state.roundDuration) * 100;
    refs.progressBar.style.width = `${Math.min(100, Math.max(0, progress)).toFixed(1)}%`;

    if (state.roundTimeLeft <= 0) {
      finishRound();
    }
  }, 1000);
}

async function finishRound() {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timerHandle);
  refs.typingInput.disabled = true;

  const elapsedSec = Math.max(1, state.roundDuration - Math.max(0, state.roundTimeLeft));
  const wpm = Math.round((state.correctChars / 5 / elapsedSec) * 60);
  const acc = state.typedChars === 0 ? 0 : (state.correctChars / state.typedChars) * 100;

  refs.resultWpm.textContent = String(Math.max(0, wpm));
  refs.resultAcc.textContent = `${Math.max(0, acc).toFixed(1)}%`;
  const tier = getTier(wpm);
  refs.resultTier.textContent = tier.name;
  refs.resultPanel.classList.add("show");
  spawnBurst(tier);

  setStatus("Round finished. Start a new one to beat your score.");

  try {
    const result = await api("/api/score", {
      method: "POST",
      body: JSON.stringify({
        playerId: state.playerId,
        wpm,
        accuracy: acc,
        durationSeconds: elapsedSec,
      }),
    });
    refs.bestWpm.textContent = String(result.bestWpm || wpm);
    await loadActiveLeaderboard();
  } catch (err) {
    refs.bestWpm.textContent = String(wpm);
    setStatus(`Score saved locally only: ${err.message}`);
  }
}

refs.startBtn.addEventListener("click", () => {
  startRound();
});

refs.newTextBtn.addEventListener("click", async () => {
  await loadPassage();
  setStatus("New passage loaded.");
});

refs.refreshBoardBtn.addEventListener("click", () => {
  loadActiveLeaderboard();
});

refs.typingInput.addEventListener("input", (e) => {
  const value = e.target.value;
  renderPassage(value);
  if (!state.running) return;

  liveMetrics(value);
  if (value.length >= state.passage.length) {
    finishRound();
  }
});

setInterval(async () => {
  updateSessionTimer();

  const remaining = state.expiresAt - Date.now();
  if (remaining <= 0) {
    await ensureSession();
    setStatus("Session expired. New player ID assigned.");
    await loadActiveLeaderboard();
  } else if (remaining < 90 * 1000) {
    await renewSession();
  }
}, 1000);

setInterval(() => {
  loadActiveLeaderboard();
}, 15000);

window.addEventListener("resize", resizeParticleCanvas);

(async function init() {
  resizeParticleCanvas();
  await ensureSession();
  await loadPassage();
  await loadActiveLeaderboard();
  updateSessionTimer();
  refs.roundTimer.textContent = String(state.roundDuration);
  refs.typingInput.disabled = true;
  setStatus("Ready. 60-second challenge is set. Hit Start Round.");
})();
