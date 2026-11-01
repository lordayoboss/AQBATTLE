const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_BEFORE_DEPLOYING";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100
}));

app.get("/api/status", (req, res) => {
  res.json({
    game: "AQBATTLE",
    status: "online",
    creator: "BELLO QUADRI AYOMIDE"
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Complete all fields." });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3–20 characters." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email." });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const users = readUsers();
    const normalizedEmail = email.toLowerCase().trim();

    if (users.some(u => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: Date.now().toString(),
      username: username.trim(),
      email: normalizedEmail,
      passwordHash,
      coins: 1000,
      diamonds: 0,
      character: "male",
      purchases: [],
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "Account created!",
      token,
      player: publicPlayer(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readUsers();

    const user = users.find(
      u => u.email === String(email || "").toLowerCase().trim()
    );

    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful!",
      token,
      player: publicPlayer(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed." });
  }
});

function publicPlayer(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    coins: user.coins,
    diamonds: user.diamonds,
    character: user.character,
    purchases: user.purchases
  };
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  try {
    const decoded = jwt.verify(token, SECRET);
    const user = readUsers().find(u => u.id === decoded.id);

    if (!user) return res.status(401).json({ error: "Account not found." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Please log in again." });
  }
}

app.get("/api/profile", authenticate, (req, res) => {
  res.json({ player: publicPlayer(req.user) });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Matchmaking: rooms contain 2–10 players.
const waitingPlayers = [];
const playerRooms = new Map();

io.on("connection", socket => {
  socket.on("find-match", () => {
    if (playerRooms.has(socket.id)) return;

    if (!waitingPlayers.includes(socket.id)) {
      waitingPlayers.push(socket.id);
    }

    let available = waitingPlayers
      .filter(id => io.sockets.sockets.has(id))
      .slice(0, 10);

    if (available.length >= 2) {
      available.forEach(id => {
        const index = waitingPlayers.indexOf(id);
        if (index !== -1) waitingPlayers.splice(index, 1);
      });

      const roomId = "AQB-" + Date.now();
      const room = io.sockets.adapter.rooms;

      available.forEach(id => {
        const playerSocket = io.sockets.sockets.get(id);
        if (playerSocket) {
          playerSocket.join(roomId);
          playerRooms.set(id, roomId);
        }
      });

      io.to(roomId).emit("match-found", {
        roomId,
        players: available.length
      });
    } else {
      socket.emit("waiting-for-players");
    }
  });

  socket.on("cancel-match", () => {
    const index = waitingPlayers.indexOf(socket.id);
    if (index !== -1) waitingPlayers.splice(index, 1);
  });

  socket.on("player-move", data => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId || !data || typeof data !== "object") return;

    socket.to(roomId).emit("opponent-move", {
      playerId: socket.id,
      position: data.position,
      rotation: data.rotation
    });
  });

  socket.on("disconnect", () => {
    const index = waitingPlayers.indexOf(socket.id);
    if (index !== -1) waitingPlayers.splice(index, 1);

    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("player-left", { playerId: socket.id });
      playerRooms.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(AQBATTLE server running on port ${PORT});
});
