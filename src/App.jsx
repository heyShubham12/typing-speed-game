import { useEffect } from "react";

const PLAYER_KEY = "typingPlayerId";
const EXPIRES_KEY = "typingSessionExpiresAt";
const LOCAL_SCORES_KEY = "typingLocalScores";
const SESSION_TTL_MS = 20 * 60 * 1000;

const LOCAL_PASSAGES = [
  "India's digital public infrastructure has changed how citizens access payments and services. For typists, this passage is perfect for rhythm training because it mixes long policy words with short connectors, forcing you to balance accuracy and speed under time pressure.",
  "Metro expansion in major Indian cities has highlighted the importance of integrated mobility where buses, walking networks, and rail systems work together. Practice this text to improve consistency across punctuation, capitals, and natural pauses while maintaining steady WPM.",
  "India's renewable energy transition now depends not only on generation capacity but also on transmission planning and storage reliability. Use this paragraph to train endurance over longer sentences and improve correction habits when mistakes appear mid-word.",
  "Foundational literacy and numeracy initiatives across states are focusing on classroom support, assessment quality, and teacher mentoring. This passage helps you practice clean finger movement through repeated academic terms while keeping line-level concentration.",
];

export default function App() {
  useEffect(() => {
    const state = {
      playerId: localStorage.getItem(PLAYER_KEY) || "",
      expiresAt: Number(localStorage.getItem(EXPIRES_KEY) || 0),
      offlineMode: false,
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

    function maskPlayerId(playerId) {
      return `${playerId.slice(0, 8)}...${playerId.slice(-2)}`;
    }

    function loadLocalScores() {
      try {
        const raw = localStorage.getItem(LOCAL_SCORES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function saveLocalScores(scores) {
      localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
    }

    function ensureOfflineSession() {
      if (!state.playerId) {
        state.playerId = `PLY-LOCAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      }
      state.expiresAt = Date.now() + SESSION_TTL_MS;
      saveSession();
      refs.playerId.textContent = state.playerId;
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
      if (state.offlineMode) {
        const rows = loadLocalScores()
          .sort((a, b) => {
            if (b.bestWpm !== a.bestWpm) return b.bestWpm - a.bestWpm;
            if (b.attempts !== a.attempts) return b.attempts - a.attempts;
            return b.lastScoreAt - a.lastScoreAt;
          })
          .slice(0, 15)
          .map((row) => ({
            maskedPlayerId: maskPlayerId(row.playerId),
            bestWpm: row.bestWpm,
            attempts: row.attempts,
          }));

        renderLeaderboard({
          leaderboard: rows,
          activeSessions: rows.length,
        });
        return;
      }

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
      if (state.offlineMode) {
        ensureOfflineSession();
        return;
      }

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

      try {
        const data = await api("/api/session/new", { method: "POST" });
        state.playerId = data.playerId;
        state.expiresAt = data.expiresAt;
        saveSession();
        refs.playerId.textContent = state.playerId;
      } catch {
        state.offlineMode = true;
        ensureOfflineSession();
      }
    }

    async function renewSession() {
      if (state.offlineMode) {
        ensureOfflineSession();
        return;
      }

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
        if (!state.offlineMode) {
          setStatus("Session renewed with a new player ID.");
        }
      }
    }

    async function loadPassage() {
      if (state.offlineMode) {
        const index = Math.floor(Math.random() * LOCAL_PASSAGES.length);
        state.passage = LOCAL_PASSAGES[index];
        renderPassage("");
        return;
      }

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

      if (state.offlineMode) {
        const scores = loadLocalScores();
        const existing = scores.find((row) => row.playerId === state.playerId);
        if (existing) {
          existing.bestWpm = Math.max(existing.bestWpm, wpm);
          existing.attempts += 1;
          existing.lastScoreAt = Date.now();
        } else {
          scores.push({
            playerId: state.playerId,
            bestWpm: wpm,
            attempts: 1,
            lastScoreAt: Date.now(),
          });
        }
        saveLocalScores(scores);
        const best = scores.find((row) => row.playerId === state.playerId)?.bestWpm || wpm;
        refs.bestWpm.textContent = String(best);
        await loadActiveLeaderboard();
        return;
      }

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

    const onStart = () => {
      startRound();
    };

    const onNewText = async () => {
      await loadPassage();
      setStatus("New passage loaded.");
    };

    const onRefresh = () => {
      loadActiveLeaderboard();
    };

    const onInput = (e) => {
      const value = e.target.value;
      renderPassage(value);
      if (!state.running) return;

      liveMetrics(value);
      if (value.length >= state.passage.length) {
        finishRound();
      }
    };

    refs.startBtn.addEventListener("click", onStart);
    refs.newTextBtn.addEventListener("click", onNewText);
    refs.refreshBoardBtn.addEventListener("click", onRefresh);
    refs.typingInput.addEventListener("input", onInput);

    const sessionInterval = setInterval(async () => {
      try {
        updateSessionTimer();

        const remaining = state.expiresAt - Date.now();
        if (remaining <= 0) {
          await ensureSession();
          setStatus("Session expired. New player ID assigned.");
          await loadActiveLeaderboard();
        } else if (remaining < 90 * 1000) {
          await renewSession();
        }
      } catch {
        state.offlineMode = true;
        ensureOfflineSession();
      }
    }, 1000);

    const leaderboardInterval = setInterval(() => {
      loadActiveLeaderboard();
    }, 15000);

    window.addEventListener("resize", resizeParticleCanvas);

    (async function init() {
      try {
        resizeParticleCanvas();
        await ensureSession();
        await loadPassage();
        await loadActiveLeaderboard();
        updateSessionTimer();
        refs.roundTimer.textContent = String(state.roundDuration);
        refs.typingInput.disabled = true;
        if (state.offlineMode) {
          setStatus("Offline mode active. Typing game is running with local session data.");
        } else {
          setStatus("Ready. 60-second challenge is set. Hit Start Round.");
        }
      } catch {
        state.offlineMode = true;
        ensureOfflineSession();
        await loadPassage();
        await loadActiveLeaderboard();
        updateSessionTimer();
        refs.roundTimer.textContent = String(state.roundDuration);
        refs.typingInput.disabled = true;
        setStatus("Offline mode active. Typing game is running with local session data.");
      }
    })();

    return () => {
      clearInterval(state.timerHandle);
      clearInterval(sessionInterval);
      clearInterval(leaderboardInterval);
      window.removeEventListener("resize", resizeParticleCanvas);
      refs.startBtn.removeEventListener("click", onStart);
      refs.newTextBtn.removeEventListener("click", onNewText);
      refs.refreshBoardBtn.removeEventListener("click", onRefresh);
      refs.typingInput.removeEventListener("input", onInput);
    };
  }, []);

  return (
    <>
      <div className="noise"></div>
      <div className="orb orb-a"></div>
      <div className="orb orb-b"></div>

      <header className="topbar">
        <div>
          <p className="eyebrow">React Powered Arena</p>
          <h1>Typing Speed Game</h1>
          <p className="tagline">Race the clock, stack your WPM, and climb the active board.</p>
        </div>
        <div className="session-pill">
          <div>
            <span className="muted">Player ID</span> <strong id="playerId">-</strong>
          </div>
          <div>
            <span className="muted">Session</span> <strong id="sessionTimer">--:--</strong>
          </div>
        </div>
      </header>

      <section className="accent-cards">
        <article className="accent-card">60s fixed challenge mode</article>
        <article className="accent-card">WPM and accuracy tracking</article>
        <article className="accent-card">Live podium and particles</article>
      </section>

      <main className="layout">
        <section className="panel controls">
          <h2>Round Setup</h2>
          <div className="row">
            <label>Mode</label>
            <div className="status">Fixed 60-second challenge with long current-affairs passages.</div>
          </div>
          <div className="button-row">
            <button id="startBtn">Start Round</button>
            <button id="newTextBtn" className="ghost">
              New Text
            </button>
          </div>
          <p id="statusText" className="status">
            Ready to type.
          </p>
        </section>

        <section className="panel stats">
          <h2>Live Stats</h2>
          <div className="stat-grid">
            <div className="stat">
              <span>WPM</span>
              <strong id="wpmLive">0</strong>
            </div>
            <div className="stat">
              <span>Correct Chars</span>
              <strong id="charsLive">0</strong>
            </div>
            <div className="stat">
              <span>Accuracy</span>
              <strong id="accLive">100%</strong>
            </div>
            <div className="stat">
              <span>Time Left</span>
              <strong id="roundTimer">60</strong>
            </div>
          </div>
          <div className="progress-wrap">
            <div id="progressBar" className="progress"></div>
          </div>
        </section>

        <section className="panel typing-panel">
          <h2>Typing Area</h2>
          <div id="passage" className="passage"></div>
          <textarea id="typingInput" placeholder="Start the round, then type here..." disabled></textarea>
        </section>

        <section className="panel result-panel" id="resultPanel">
          <h2>Round Result</h2>
          <p className="result-main">
            WPM: <strong id="resultWpm">0</strong>
          </p>
          <p>
            Accuracy: <strong id="resultAcc">0%</strong>
          </p>
          <p>
            Tier: <strong id="resultTier">Rookie</strong>
          </p>
          <p>
            Best this session: <strong id="bestWpm">0</strong> WPM
          </p>
        </section>

        <section className="panel">
          <div className="leader-head">
            <h2>Active Session Leaderboard</h2>
            <button id="refreshBoardBtn" className="ghost">
              Refresh
            </button>
          </div>
          <div id="activeSessionsMeta" className="status">
            Loading active sessions...
          </div>
          <div id="leaderboardList" className="leader-list"></div>
        </section>
      </main>

      <section className="podium-strip" id="podiumStrip">
        <article className="podium-slot" id="podium1"></article>
        <article className="podium-slot" id="podium2"></article>
        <article className="podium-slot" id="podium3"></article>
      </section>

      <canvas id="particleCanvas" className="particle-canvas"></canvas>
    </>
  );
}
