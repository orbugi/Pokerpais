const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = [];
let gameState = { pot: 0, communityCards: [], status: 'waiting' };

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        const newPlayer = { id: socket.id, username, chips: 1000, cards: [] };
        players.push(newPlayer);
        io.emit('updatePlayers', players);
    });

    socket.on('placeBet', (amount) => {
        gameState.pot += amount;
        io.emit('updateGameState', gameState);
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
