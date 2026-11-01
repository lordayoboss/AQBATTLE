const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const waitingPlayers = [];
const matches = new Map();

let matchNumber = 1;

io.on("connection", function (socket) {
    console.log("Player connected:", socket.id);

    socket.on("find-match", function () {
        if (socket.data.matchId) return;

        if (waitingPlayers.includes(socket.id)) return;

        waitingPlayers.push(socket.id);

        socket.emit(
            "match-status",
            "Searching for players..."
        );

        if (waitingPlayers.length >= 2) {
            const players = waitingPlayers.splice(
                0,
                Math.min(10, waitingPlayers.length)
            );

            const matchId = "match-" + matchNumber;

            matchNumber++;

            matches.set(matchId, players);

            players.forEach(function (playerId) {
                const player = io.sockets.sockets.get(playerId);

                if (!player) return;

                player.data.matchId = matchId;
                player.join(matchId);

                player.emit("match-found", {
                    matchId: matchId,
                    players: players.length
                });
            });

            console.log(
                "Match started: " +
                matchId +
                " Players: " +
                players.length
            );
        }
    });

    socket.on("player-move", function (data) {
        const matchId = socket.data.matchId;

        if (!matchId || !data) return;

        socket.to(matchId).emit("opponent-move", {
            playerId: socket.id,
            x: Number(data.x) || 0,
            z: Number(data.z) || 0
        });
    });

    socket.on("disconnect", function () {
        const index = waitingPlayers.indexOf(socket.id);

        if (index !== -1) {
            waitingPlayers.splice(index, 1);
        }

        const matchId = socket.data.matchId;

        if (matchId) {
            socket.to(matchId).emit("player-left", socket.id);

            const players = matches.get(matchId) || [];

            const remaining = players.filter(function (id) {
                return id !== socket.id;
            });

            if (remaining.length > 0) {
                matches.set(matchId, remaining);
            } else {
                matches.delete(matchId);
            }
        }

        console.log("Player disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, function () {
    console.log(
        "AQBATTLE running at http://localhost:" + PORT
    );
});