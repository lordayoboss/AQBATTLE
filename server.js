
import { createServer } from "node:http";
import { Server } from "socket.io";
import crypto from "node:crypto";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e5
});

const CONFIG = {
  PORT: process.env.PORT || 3000,
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  TICK_RATE: 20,
  COUNTDOWN: 10,
  PLAYER_HEALTH: 100,
  PLAYER_SPEED: 7,
  MAP_LIMIT: 90,
  START_ZONE: 85,
  MIN_ZONE: 12,
  ZONE_SHRINK: 0.12,
  BULLET_DAMAGE: 35,
  FIRE_COOLDOWN: 250,
  MAX_SHOT_DISTANCE: 120
};

const rooms = new Map();
const players = new Map();
const lastEvents = new Map();

const randomId = () =>
  crypto.randomBytes(4).toString("hex").toUpperCase();

const clamp = (n, min, max) =>
  Math.max(min, Math.min(max, n));

function createRoom(mode = "Battle Royale") {
  let id = randomId();

  while (rooms.has(id)) id = randomId();

  const room = {
    id,
    mode,
    status: "waiting",
    host: null,
    players: new Map(),
    countdown: CONFIG.COUNTDOWN,
    zoneRadius: CONFIG.START_ZONE,
    startTime: null,
    winner: null
  };

  rooms.set(id, room);
  return room;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    z: player.z,
    rotation: player.rotation,
    health: player.health,
    alive: player.alive,
    kills: player.kills,
    ready: player.ready
  };
}

function roomSnapshot(room) {
  return {
    roomId: room.id,
    mode: room.mode,
    status: room.status,
    zoneRadius: room.zoneRadius,
    players: [...room.players.values()].map(publicPlayer),
    winner: room.winner
  };
}

function broadcastRoom(room) {
  io.to(room.id).emit("room:update", roomSnapshot(room));
}

function notifyError(socket, message) {
  socket.emit("game:error", { message });
}

function getPlayer(socket) {
  return players.get(socket.id);
}

function getRoom(socket) {
  const player = getPlayer(socket);
  return player ? rooms.get(player.roomId) : null;
}

function removePlayer(socket) {
  const player = players.get(socket.id);
  if (!player) return;

  const room = rooms.get(player.roomId);

  players.delete(socket.id);
  lastEvents.delete(socket.id);
  socket.leave(player.roomId);

  if (!room) return;

  room.players.delete(socket.id);

  if (room.host === socket.id) {
    room.host = room.players.keys().next().value || null;
  }

  if (room.players.size === 0) {
    rooms.delete(room.id);
    return;
  }

  checkWinner(room);
  broadcastRoom(room);

  io.to(room.id).emit("player:left", {
    playerId: socket.id,
    name: player.name
  });
}

function joinRoom(socket, room, name) {
  if (players.has(socket.id)) {
    notifyError(socket, "You are already in a match.");
    return false;
  }

  if (room.status !== "waiting") {
    notifyError(socket, "This match has already started.");
    return false;
  }

  if (room.players.size >= CONFIG.MAX_PLAYERS) {
    notifyError(socket, "Room is full.");
    return false;
  }

  const angle = Math.random() * Math.PI * 2;
  const distance = 10 + Math.random() * 15;

  const player = {
    id: socket.id,
    name: name.slice(0, 18),
    roomId: room.id,
    x: Math.cos(angle) * distance,
    y: 0,
    z: Math.sin(angle) * distance,
    rotation: 0,
    health: CONFIG.PLAYER_HEALTH,
    alive: true,
    kills: 0,
    ready: false,
    lastShot: 0,
    lastMove: Date.now()
  };

  players.set(socket.id, player);
  room.players.set(socket.id, player);

  if (!room.host) room.host = socket.id;

  socket.join(room.id);

  socket.emit("room:joined", {
    roomId: room.id,
    playerId: socket.id,
    isHost: room.host === socket.id,
    snapshot: roomSnapshot(room)
  });

  socket.to(room.id).emit("player:joined", publicPlayer(player));

  broadcastRoom(room);
  return true;
}

/* =================================
   MATCHMAKING
================================= */

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  socket.emit("server:welcome", {
    message: "Welcome to AQBATTLE!",
    maxPlayers: CONFIG.MAX_PLAYERS
  });

  socket.on("room:create", data => {
    if (getPlayer(socket)) {
      notifyError(socket, "Leave your current match first.");
      return;
    }

    const mode = ["Battle Royale", "Clash Squad", "Training"]
      .includes(data?.mode) ? data.mode : "Battle Royale";

    const name = typeof data?.name === "string"
      ? data.name.trim().slice(0, 18)
      : "AQ PLAYER";

    if (!name) {
      notifyError(socket, "Enter a player name.");
      return;
    }

    const room = createRoom(mode);
    joinRoom(socket, room, name);
  });

  socket.on("room:join", data => {
    if (getPlayer(socket)) {
      notifyError(socket, "Leave your current match first.");
      return;
    }

    const roomId = String(data?.roomId || "").toUpperCase();
    const room = rooms.get(roomId);

    if (!room) {
      notifyError(socket, "Room not found.");
      return;
    }

    const name = typeof data?.name === "string"
      ? data.name.trim().slice(0, 18)
      : "AQ PLAYER";

    if (!name) {
      notifyError(socket, "Enter a player name.");
      return;
    }

    joinRoom(socket, room, name);
  });

  socket.on("match:find", data => {
    if (getPlayer(socket)) {
      notifyError(socket, "Already in a match.");
      return;
    }

    const mode = ["Battle Royale", "Clash Squad", "Training"]
      .includes(data?.mode) ? data.mode : "Battle Royale";

    const name = typeof data?.name === "string"
      ? data.name.trim().slice(0, 18)
      : "AQ PLAYER";

    if (!name) {
      notifyError(socket, "Enter a player name.");
      return;
    }

    let room = [...rooms.values()].find(r =>
      r.mode === mode &&
      r.status === "waiting" &&
      r.players.size < CONFIG.MAX_PLAYERS
    );

    if (!room) room = createRoom(mode);

    joinRoom(socket, room, name);
  });

  socket.on("room:leave", () => {
    removePlayer(socket);
  });

  /* =================================
     READY AND MATCH START
  ================================= */

  socket.on("player:ready", () => {
    const player = getPlayer(socket);
    const room = getRoom(socket);

    if (!player || !room || room.status !== "waiting") return;

    player.ready = true;
    broadcastRoom(room);
  });

  socket.on("match:start", () => {
    const room = getRoom(socket);

    if (!room || room.status !== "waiting") return;

    if (room.host !== socket.id) {
      notifyError(socket, "Only the room host can start the match.");
      return;
    }

    if (room.players.size < CONFIG.MIN_PLAYERS &&
        room.mode !== "Training") {
      notifyError(socket, "At least 2 players are needed.");
      return;
    }

    startCountdown(room);
  });

  function startCountdown(room) {
    if (room.status !== "waiting") return;

    room.status = "countdown";
    room.countdown = CONFIG.COUNTDOWN;

    broadcastRoom(room);

    const timer = setInterval(() => {
      if (!rooms.has(room.id) || room.status !== "countdown") {
        clearInterval(timer);
        return;
      }

      room.countdown--;

      io.to(room.id).emit("match:countdown", {
        seconds: room.countdown
      });

      if (room.countdown <= 0) {
        clearInterval(timer);
        startMatch(room);
      }
    }, 1000);
  }

  function startMatch(room) {
    if (!rooms.has(room.id)) return;

    room.status = "playing";
    room.startTime = Date.now();
    room.zoneRadius = CONFIG.START_ZONE;
    room.winner = null;

    for (const player of room.players.values()) {
      player.health = CONFIG.PLAYER_HEALTH;
      player.alive = true;
      player.kills = 0;
      player.ready = true;
      player.lastShot = 0;
    }

    io.to(room.id).emit("match:started", roomSnapshot(room));
    broadcastRoom(room);
  }

  /* =================================
     PLAYER MOVEMENT
  ================================= */

  socket.on("player:move", data => {
    const player = getPlayer(socket);
    const room = getRoom(socket);

    if (!player || !room || room.status !== "playing" ||
        !player.alive) return;

    if (!data || typeof data !== "object") return;

    const now = Date.now();
    const elapsed = Math.min((now - player.lastMove) / 1000, 0.1);

    const x = Number(data.x);
    const z = Number(data.z);
    const rotation = Number(data.rotation);

    if (![x, z, rotation].every(Number.isFinite)) return;

    if (Math.abs(x) > 1 || Math.abs(z) > 1) return;

    const magnitude = Math.hypot(x, z);
    if (magnitude > 1.01) return;

    const nx = magnitude > 1 ? x / magnitude : x;
    const nz = magnitude > 1 ? z / magnitude : z;

    player.x = clamp(
      player.x + nx * CONFIG.PLAYER_SPEED * elapsed,
      -CONFIG.MAP_LIMIT,
      CONFIG.MAP_LIMIT
    );

    player.z = clamp(
      player.z + nz * CONFIG.PLAYER_SPEED * elapsed,
      -CONFIG.MAP_LIMIT,
      CONFIG.MAP_LIMIT
    );

    player.rotation = clamp(rotation, -Math.PI * 10, Math.PI * 10);
    player.lastMove = now;
  });

  /* =================================
     SHOOTING AND DAMAGE
  ================================= */

  socket.on("player:shoot", data => {
    const shooter = getPlayer(socket);
    const room = getRoom(socket);

    if (!shooter || !room || room.status !== "playing" ||
        !shooter.alive) return;

    if (!data || typeof data !== "object") return;

    const now = Date.now();

    if (now - shooter.lastShot < CONFIG.FIRE_COOLDOWN) return;

    const dx = Number(data.dx);
    const dz = Number(data.dz);

    if (![dx, dz].every(Number.isFinite)) return;

    const length = Math.hypot(dx, dz);

    if (length < 0.9 || length > 1.1) return;

    shooter.lastShot = now;

    const dirX = dx / length;
    const dirZ = dz / length;

    let target = null;
    let closestDistance = CONFIG.MAX_SHOT_DISTANCE;
    let targetDistance = 0;

    for (const enemy of room.players.values()) {
      if (!enemy.alive || enemy.id === shooter.id) continue;

      const vx = enemy.x - shooter.x;
      const vz = enemy.z - shooter.z;

      const along = vx * dirX + vz * dirZ;

      if (along <= 0 || along > CONFIG.MAX_SHOT_DISTANCE) continue;

      const perpendicular = Math.abs(
        vx * dirZ - vz * dirX
      );

      if (perpendicular > 1.5) continue;

      if (along < closestDistance) {
        closestDistance = along;
        target = enemy;
        targetDistance = along;
      }
    }

    if (target) {
      target.health = Math.max(
        0,
        target.health - CONFIG.BULLET_DAMAGE
      );

      io.to(room.id).emit("combat:hit", {
        shooterId: shooter.id,
        targetId: target.id,
        damage: CONFIG.BULLET_DAMAGE,
        distance: targetDistance,
        health: target.health
      });

      if (target.health <= 0) {
        target.alive = false;
        shooter.kills++;

        io.to(room.id).emit("player:eliminated", {
          playerId: target.id,
          killerId: shooter.id,
          killerName: shooter.name
        });

        checkWinner(room);
      }
    }

    broadcastRoom(room);
  });

  /* =================================
     PLAYER DISCONNECT
  ================================= */

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    removePlayer(socket);
  });
});

/* =================================
   SAFE ZONE AND GAME LOOP
================================= */

function checkWinner(room) {
  if (room.status !== "playing") return;

  const alive = [...room.players.values()]
    .filter(player => player.alive);

  if (alive.length <= 1 && room.players.size >= 2) {
    room.status = "ended";
    room.winner = alive.length === 1
      ? alive[0].id
      : null;

    io.to(room.id).emit("match:ended", {
      winner: room.winner,
      winnerName: alive[0]?.name || null,
      results: [...room.players.values()].map(publicPlayer)
    });
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status !== "playing") continue;

    room.zoneRadius = Math.max(
      CONFIG.MIN_ZONE,
      room.zoneRadius - CONFIG.ZONE_SHRINK / CONFIG.TICK_RATE
    );

    for (const player of room.players.values()) {
      if (!player.alive) continue;

      const distance = Math.hypot(player.x, player.z);

      if (distance > room.zoneRadius) {
        player.health = Math.max(0, player.health - 2);

        if (player.health <= 0) {
          player.alive = false;

          io.to(room.id).emit("player:eliminated", {
            playerId: player.id,
            killerId: null,
            killerName: "SAFE ZONE"
          });
        }
      }
    }

    checkWinner(room);

    io.to(room.id).emit("world:state", {
      zoneRadius: room.zoneRadius,
      players: [...room.players.values()].map(publicPlayer)
    });
  }
}, 1000 / CONFIG.TICK_RATE);

/* =================================
   SERVER STATUS
================================= */

httpServer.listen(CONFIG.PORT, "0.0.0.0", () => {
  console.log("--------------------------------");
  console.log("       AQBATTLE SERVER");
  console.log("--------------------------------");
  console.log("Server running on port:", CONFIG.PORT);
  console.log("Maximum players:", CONFIG.MAX_PLAYERS);
  console.log("Multiplayer: ENABLED");
  console.log("--------------------------------");
});
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected to AQBATTLE server!");

  socket.emit("match:find", {
    name: "AQ PLAYER",
    mode: "Battle Royale"
  });
});

socket.on("room:joined", data => {
  console.log("Joined AQBATTLE room:", data.roomId);
});

socket.on("match:started", data => {
  console.log("BATTLE STARTED!", data);
});

socket.on("world:state", data => {
  console.log("Players online:", data.players);
});

socket.on("game:error", data => {
  console.log("Game error:", data.message);
});
