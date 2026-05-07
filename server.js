const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let deck = [];
let gameState = { 
    pot: 0, communityCards: [], phase: 'preflop', 
    currentBet: 0, turnIndex: 0, dealerIndex: 0, sbAmount: 5 
};

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let d = [];
    for (let s of suits) for (let v of values) d.push({v, s});
    return d.sort(() => Math.random() - 0.5);
}

function getNextPlayer(idx) {
    let next = (idx + 1) % players.length;
    while (players[next].status !== 'active') next = (next + 1) % players.length;
    return next;
}

function proceed() {
    // איפוס הימורים לסיבוב הבא
    players.forEach(p => { p.betThisRound = 0; p.hasActed = false; p.lastAction = ""; });
    gameState.currentBet = 0;

    if (gameState.phase === 'preflop') {
        gameState.communityCards.push(deck.pop(), deck.pop(), deck.pop());
        gameState.phase = 'flop';
    } else if (gameState.phase === 'flop') {
        gameState.communityCards.push(deck.pop());
        gameState.phase = 'turn';
    } else if (gameState.phase === 'turn') {
        gameState.communityCards.push(deck.pop());
        gameState.phase = 'river';
    } else {
        // כאן יבוא חישוב המנצח (Showdown)
        return;
    }
    // מהפלופ והלאה - הראשון אחרי הדילר מדבר
    gameState.turnIndex = getNextPlayer(gameState.dealerIndex);
    io.emit('gameUpdate', { players, gameState });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        players.push({ id: socket.id, username: name, chips: 1000, cards: [], status: 'active', betThisRound: 0, hasActed: false, lastAction: "", isAdmin: players.length === 0 });
        io.emit('updatePlayers', players);
    });

    socket.on('startGame', (cfg) => {
        if (players.length < 2) return;
        gameState.sbAmount = cfg.sb || 5;
        let bb = gameState.sbAmount * 2;
        deck = createDeck();
        gameState.phase = 'preflop';
        gameState.communityCards = [];
        gameState.currentBet = bb;
        
        let sbIdx = getNextPlayer(gameState.dealerIndex);
        let bbIdx = getNextPlayer(sbIdx);

        players.forEach((p, i) => {
            p.cards = [deck.pop(), deck.pop()];
            p.status = 'active';
            p.hasActed = false;
            if (i === sbIdx) { p.chips -= gameState.sbAmount; p.betThisRound = gameState.sbAmount; p.lastAction = "SB"; }
            else if (i === bbIdx) { p.chips -= bb; p.betThisRound = bb; p.lastAction = "BB"; }
        });

        gameState.pot = gameState.sbAmount + bb;
        gameState.turnIndex = getNextPlayer(bbIdx); // UTG מתחיל בפרה-פלופ
        io.emit('gameUpdate', { players, gameState });
    });

    socket.on('action', (act) => {
        let p = players[gameState.turnIndex];
        if (p.id !== socket.id) return;

        p.hasActed = true;
        if (act.type === 'fold') { p.status = 'folded'; p.lastAction = "Fold"; }
        else {
            let call = gameState.currentBet - p.betThisRound;
            let total = call + (act.raise || 0);
            p.chips -= total; p.betThisRound += total; gameState.pot += total;
            gameState.currentBet = Math.max(gameState.currentBet, p.betThisRound);
            p.lastAction = act.raise > 0 ? "Raise" : (call > 0 ? "Call" : "Check");
        }

        let active = players.filter(ps => ps.status === 'active');
        if (active.every(ps => ps.hasActed && ps.betThisRound === gameState.currentBet)) {
            setTimeout(proceed, 1000);
        } else {
            gameState.turnIndex = getNextPlayer(gameState.turnIndex);
            io.emit('gameUpdate', { players, gameState });
        }
    });
});
server.listen(process.env.PORT || 3000);
