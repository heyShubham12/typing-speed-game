const path = require("path");
const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 20 * 60 * 1000;
const IS_DEV = process.env.NODE_ENV !== "production";

const sessions = new Map();

const passages = [
  "India's infrastructure push is increasingly tied to multimodal connectivity under the Gati Shakti approach, where highways, rail freight, ports, and logistics parks are planned as one network instead of separate projects. Policy discussions now focus on reducing turnaround time for cargo, lowering logistics costs for MSMEs, and improving first-mile and last-mile links in smaller towns. Economists note that the quality of coordination between Union ministries, state agencies, and urban local bodies will determine whether headline investment translates into durable productivity gains.",
  "Heat waves and erratic rainfall are forcing Indian cities to redesign climate resilience plans with a stronger neighborhood lens. Current debates include cool roofs in dense settlements, restoration of urban lakes and drains, expansion of tree cover along transit corridors, and ward-level heat action protocols for schools and public health centers. Urban planners argue that adaptation outcomes depend not only on engineering works but also on timely local data, citizen trust, and enforcement capacity during monsoon stress periods.",
  "India's digital public infrastructure model continues to influence policy conversations around inclusive growth, especially where Aadhaar-enabled verification, UPI payments, and account portability reduce friction in service delivery. The next phase of debate is about balancing innovation with safeguards for privacy, consent, and grievance redressal as data-intensive platforms scale across sectors. Researchers emphasize that digital inclusion still requires offline support channels, language accessibility, and strong cyber hygiene so adoption remains broad and trustworthy.",
  "Energy transition in India is moving beyond new renewable capacity to the harder challenge of grid flexibility and reliable peak supply. Analysts are tracking transmission expansion, storage procurement, and better forecasting to integrate variable solar and wind without compromising stability for households and industry. Policymakers also highlight domestic manufacturing for clean-energy components and the role of state discom reforms, because long-term affordability depends on both generation choices and distribution-sector discipline.",
  "Public health priorities in India are increasingly prevention-focused, with attention on disease surveillance, primary care strengthening, and early risk communication in both urban and rural districts. Experts point to the value of integrated data from laboratories, field workers, and local clinics so outbreaks can be identified before hospitals face severe pressure. Health economists add that sustained investment in preventive systems may appear gradual in impact, but it improves workforce resilience and reduces long-run emergency spending.",
  "Education reform conversations in India now center on foundational literacy and numeracy, teacher mentoring, and better use of bilingual learning resources across diverse classrooms. Several states are combining competency-based assessments with targeted remediation so students who fell behind can recover without being pushed through grades unprepared. Practitioners caution that technology can support this effort only when aligned with curriculum goals, regular teacher training, and continuous feedback loops between schools, districts, and families.",
];

app.use(express.json());

if (IS_DEV) {
  app.use((req, res, next) => {
    const isUiAsset =
      req.path === "/" ||
      req.path.endsWith(".html") ||
      req.path.endsWith(".js") ||
      req.path.endsWith(".css");

    if (req.method === "GET" && isUiAsset) {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");
    }
    next();
  });
}

app.use(
  express.static(path.join(__dirname, "public"), {
    etag: !IS_DEV,
    lastModified: !IS_DEV,
    maxAge: IS_DEV ? 0 : "1d",
  })
);

function now() {
  return Date.now();
}

function makeSession() {
  const createdAt = now();
  const expiresAt = createdAt + SESSION_TTL_MS;
  const playerId = `PLY-${uuidv4().slice(0, 8).toUpperCase()}`;
  const session = {
    playerId,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt,
    scores: [],
  };
  sessions.set(playerId, session);
  return session;
}

function getSession(playerId) {
  const session = sessions.get(playerId);
  if (!session) return null;
  if (session.expiresAt <= now()) {
    sessions.delete(playerId);
    return null;
  }
  return session;
}

function touchSession(session) {
  session.lastSeenAt = now();
}

function renewSession(session) {
  touchSession(session);
  session.expiresAt = now() + SESSION_TTL_MS;
}

function activeLeaderboard(limit = 20) {
  const current = now();
  const rows = [];

  sessions.forEach((session, playerId) => {
    if (session.expiresAt <= current) return;
    const bestWpm = Math.max(...session.scores.map((s) => s.wpm), 0);
    const attempts = session.scores.length;
    rows.push({
      playerId,
      maskedPlayerId: `${playerId.slice(0, 8)}...${playerId.slice(-2)}`,
      bestWpm,
      attempts,
      expiresInSec: Math.max(0, Math.floor((session.expiresAt - current) / 1000)),
      lastScoreAt: session.scores[session.scores.length - 1]?.createdAt || session.createdAt,
    });
  });

  return rows
    .sort((a, b) => {
      if (b.bestWpm !== a.bestWpm) return b.bestWpm - a.bestWpm;
      if (b.attempts !== a.attempts) return b.attempts - a.attempts;
      return b.lastScoreAt - a.lastScoreAt;
    })
    .slice(0, limit);
}

app.post("/api/session/new", (req, res) => {
  const session = makeSession();
  res.json({
    playerId: session.playerId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    ttlMs: SESSION_TTL_MS,
  });
});

app.post("/api/session/renew", (req, res) => {
  const playerId = String(req.body.playerId || "");
  const session = getSession(playerId);
  if (!session) {
    return res.status(404).json({ error: "Session expired or invalid." });
  }

  renewSession(session);
  return res.json({
    playerId: session.playerId,
    expiresAt: session.expiresAt,
    ttlMs: SESSION_TTL_MS,
  });
});

app.get("/api/session/:playerId", (req, res) => {
  const playerId = String(req.params.playerId || "");
  const session = getSession(playerId);
  if (!session) {
    return res.status(404).json({ error: "Session expired or invalid." });
  }

  touchSession(session);
  return res.json({
    playerId: session.playerId,
    expiresAt: session.expiresAt,
    ttlMs: SESSION_TTL_MS,
  });
});

app.get("/api/passage", (req, res) => {
  const index = Math.floor(Math.random() * passages.length);
  res.json({ passage: passages[index] });
});

app.get("/api/leaderboard/active", (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)));
  res.json({
    leaderboard: activeLeaderboard(limit),
    activeSessions: sessions.size,
    generatedAt: now(),
  });
});

app.post("/api/score", (req, res) => {
  const playerId = String(req.body.playerId || "");
  const wpm = Number(req.body.wpm || 0);
  const accuracy = Number(req.body.accuracy || 0);
  const durationSeconds = Number(req.body.durationSeconds || 0);

  const session = getSession(playerId);
  if (!session) {
    return res.status(404).json({ error: "Session expired or invalid." });
  }

  const score = {
    wpm: Number.isFinite(wpm) ? Math.max(0, Math.round(wpm)) : 0,
    accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.min(100, Number(accuracy.toFixed(2)))) : 0,
    durationSeconds: Number.isFinite(durationSeconds) ? Math.max(0, Math.round(durationSeconds)) : 0,
    createdAt: now(),
  };

  session.scores.push(score);
  if (session.scores.length > 20) {
    session.scores = session.scores.slice(-20);
  }

  touchSession(session);
  return res.json({
    ok: true,
    score,
    bestWpm: Math.max(...session.scores.map((s) => s.wpm), 0),
    attempts: session.scores.length,
  });
});

setInterval(() => {
  const cutoff = now();
  sessions.forEach((session, playerId) => {
    if (session.expiresAt <= cutoff) {
      sessions.delete(playerId);
    }
  });
}, 60 * 1000);

function startServer(port) {
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Typing game server listening on http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE" && IS_DEV) {
      const nextPort = Number(port) + 1;
      // eslint-disable-next-line no-console
      console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    if (err && err.code === "EADDRINUSE") {
      // eslint-disable-next-line no-console
      console.error(`Port ${port} is in use. Set PORT to a free value and restart.`);
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.error("Server failed to start:", err);
    process.exit(1);
  });
}

startServer(Number(PORT));
