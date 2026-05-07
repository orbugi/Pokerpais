const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let gameState = { 
    pot: 0, communityCards: [], phase: 'waiting', 
    currentBet: 0, turnIndex: 0, dealerIndex: 0, 
    sb: 5, bb: 10, maxBuyin: 500 
};

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        // בדיקת מקסימום כניסה שהאדמין קבע
        if (data.buyin > gameState.maxBuyin) {
            socket.emit('error', `המקסימום לכניסה הוא ${gameState.maxBuyin}`);
            return;
        }
        players.push({ 
            id: socket.id, username: data.name, chips: parseInt(data.buyin), 
            cards: [], status: 'active', betThisRound: 0, 
            lastAction: "", isAdmin: players.length === 0 
        });
        io.emit('updatePlayers', players);
    });

    socket.on('adminUpdate', (cfg) => {
        gameState.maxBuyin = cfg.maxBuyin;
        gameState.sb = cfg.sb;
        gameState.bb = cfg.sb * 2; // תמיד כפול
        io.emit('configUpdated', gameState);
    });

    socket.on('startGame', () => {
        if (players.length < 2) return;
        // לוגיקת חלוקה וגביית SB/BB אוטומטית בכיוון השעון
        let sbIdx = (gameState.dealerIndex + 1) % players.length;
        let bbIdx = (gameState.dealerIndex + 2) % players.length;

        players.forEach((p, i) => {
            p.status = 'active'; p.betThisRound = 0;
            if (i === sbIdx) { p.chips -= gameState.sb; p.betThisRound = gameState.sb; }
            if (i === bbIdx) { p.chips -= gameState.bb; p.betThisRound = gameState.bb; }
        });

        gameState.pot = gameState.sb + gameState.bb;
        gameState.currentBet = gameState.bb;
        gameState.turnIndex = (bbIdx + 1) % players.length; // הראשון אחרי הבליינד מתחיל
        io.emit('gameUpdate', { players, gameState });
    });
});
server.listen(process.env.PORT || 3000);
