const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let deck = [];
let gameState = { pot: 0, communityCards: [], phase: 'waiting', currentBet: 0, turnIndex: 0, dealerIndex: 0, sb: 5 };

io.on('connection', (socket) => {
    // כניסה לשולחן עם בחירת סכום כסף (Buy-in)
    socket.on('joinGame', (data) => {
        players.push({ 
            id: socket.id, username: data.name, chips: parseInt(data.buyin), 
            cards: [], status: 'active', betThisRound: 0, 
            role: "", isAdmin: players.length === 0 
        });
        io.emit('updatePlayers', players);
    });

    socket.on('startGame', (cfg) => {
        if (players.length < 2) return;
        gameState.sb = cfg.sb || 5;
        let bb = gameState.sb * 2;
        gameState.phase = 'preflop';
        gameState.communityCards = [];
        gameState.currentBet = bb;
        
        // קביעת תפקידים אוטומטית (S ו-B)
        let sbIdx = (gameState.dealerIndex + 1) % players.length;
        let bbIdx = (gameState.dealerIndex + 2) % players.length;

        players.forEach((p, i) => {
            p.role = (i === sbIdx) ? "S" : (i === bbIdx ? "B" : "");
            if (i === sbIdx) { p.chips -= gameState.sb; p.betThisRound = gameState.sb; }
            if (i === bbIdx) { p.chips -= bb; p.betThisRound = bb; }
            p.cards = ["🂠", "🂠"]; // חלוקה סגורה
        });

        gameState.pot = gameState.sb + bb;
        gameState.turnIndex = (bbIdx + 1) % players.length;
        io.emit('gameUpdate', { players, gameState });
    });
});
server.listen(process.env.PORT || 3000);
