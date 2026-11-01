const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "https://iridescent-meerkat-6368fb.netlify.app",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, "public")));

let waitingPlayers = [];
let nextMatchId = 1;
const matches = new Map();

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("find-match", () => {
        if (socket.data.matchId) return;
        if (waitingPlayers.includes(socket.id)) return;

        waitingPlayers.push(socket.id);
        socket.emit("match-status", "Searching for players...");

        if (waitingPlayers.length >= 2) {
            const players = waitingPlayers.splice(
                0,
                Math.min(10, waitingPlayers.length)
            );

            const matchId = "match-" + nextMatchId++;
            matches.set(matchId, players);

            players.forEach((playerId) => {
                const player = io.sockets.sockets.get(playerId);
                if (!player) return;

                player.data.matchId = matchId;
                player.join(matchId);

                player.emit("match-found", {
                    matchId,
                    players: players.length
                });
            });

            console.log("Started " + matchId);
        }
    });

    socket.on("player-move", (data) => {
        const matchId = socket.data.matchId;
        if (!matchId || !data) return;

        socket.to(matchId).emit("opponent-move", {
            playerId: socket.id,
            x: Number(data.x) || 0,
            z: Number(data.z) || 0
        });
    });

    socket.on("disconnect", () => {
        waitingPlayers = waitingPlayers.filter(
            id => id !== socket.id
        );

        const matchId = socket.data.matchId;

        if (matchId) {
            socket.to(matchId).emit("player-left", socket.id);

            const remaining = (matches.get(matchId) || [])
                .filter(id => id !== socket.id);

            if (remaining.length) {
                matches.set(matchId, remaining);
            } else {
                matches.delete(matchId);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("AQBATTLE server running on port " + PORT);
});
