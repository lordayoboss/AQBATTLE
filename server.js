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
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.warn("WARNING: Set JWT_SECRET before production use.");
}

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]");
}

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
    const cleanEmail = email.toLowerCase().trim();

    if (users.some(u => u.email === cleanEmail)) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const user = {
      id: require("crypto").randomUUID(),
      username: username.trim(),
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      coins: 1000,
      diamonds: 0,
      character: "male",
      purchases: [],
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    const token = jwt.sign(
      { id: user.id },
      SECRET || "development-only-secret",
      { expiresIn: "7d" }
    );

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
    const user = readUsers().find(
      u => u.email === String(email || "").toLowerCase().trim()
    );

    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = jwt.sign(
      { id: user.id },
      SECRET || "development-only-secret",
      { expiresIn: "7d" }
    );

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

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    const decoded = jwt.verify(
      token,
      SECRET || "development-only-secret"
    );

    const user = readUsers().find(u => u.id === decoded.id);

    if (!user) {
      return res.status(401).json({ error: "Account not found." });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Please log in again." });
  }
}

app.get("/api/profile", authenticate, (req, res) => {
  res.json({ player: publicPlayer(req.user) });
});

// Save male/female selection.
app.post("/api/character", authenticate, (req, res) => {
  const { character } = req.body;

  if (!["male", "female"].includes(character)) {
    return res.status(400).json({ error: "Invalid character." });
  }

  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);

  user.character = character;
  saveUsers(users);

  res.json({ player: publicPlayer(user) });
});

// Purchase and save character skins.
const skinPrices = {
  "Army Soldier": 0,
  "Shadow Warrior": 250,
  "Fire Warrior": 400,
  "Cyber Soldier": 600,
  "Golden Warrior": 900
};

app.post("/api/shop/buy", authenticate, (req, res) => {
  const { item } = req.body;
  const price = skinPrices[item];

  if (price === undefined) {
    return res.status(400).json({ error: "Unknown shop item." });
  }

  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);

  if (user.purchases.includes(item)) {
    return res.json({ message: "Already owned.", player: publicPlayer(user) });
  }

  if (user.coins < price) {
    return res.status(400).json({ error: "Not enough coins." });
  }

  user.coins -= price;
  user.purchases.push(item);
  saveUsers(users);

  res.json({
    message: "Purchase successful!",
    player: publicPlayer(user)
  });
});

// Basic matchmaking, maximum 10 players per match.
const waitingPlayers = [];
const playerRooms = new Map();

io.on("connection", socket => {
  socket.on("find-match", () => {
    if (playerRooms.has(socket.id)) return;

    if (!waitingPlayers.includes(socket.id)) {
      waitingPlayers.push(socket.id);
    }

    const available = waitingPlayers
      .filter(id => io.sockets.sockets.has(id))
      .slice(0, 10);

    if (available.length < 2) {
      socket.emit("waiting-for-players");
      return;
    }

    available.forEach(id => {
      const index = waitingPlayers.indexOf(id);
      if (index !== -1) waitingPlayers.splice(index, 1);
    });

    const roomId = "AQB-" + require("crypto").randomUUID();

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
  });

  socket.on("cancel-match", () => {
    const index = waitingPlayers.indexOf(socket.id);
    if (index !== -1) waitingPlayers.splice(index, 1);
  });

  socket.on("disconnect", () => {
    const index = waitingPlayers.indexOf(socket.id);
    if (index !== -1) waitingPlayers.splice(index, 1);

    const roomId = playerRooms.get(socket.id);

    if (roomId) {
      socket.to(roomId).emit("player-left", {
        playerId: socket.id
      });
      playerRooms.delete(socket.id);
    }
  });
});

// Unknown API routes return JSON errors.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

// Send the game homepage for other browser routes.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(AQBATTLE running on port ${PORT});
  console.log("MADE BY BELLO QUADRI AYOMIDE");
});
