const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = [];
let deck = [];
let gameState = { 
    pot: 0, 
    communityCards: [], 
    status: 'waiting', 
    phase: 'preflop', 
    currentBet: 0,
    turnIndex: 0,
    dealerIndex: 0,
    minBlind: 5 // ניתן לשינוי
};

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let newDeck = [];
    for (let s of suits) for (let v of values) newDeck.push({v, s});
    return newDeck.sort(() => Math.random() - 0.5);
}

function getNextActivePlayer(startIndex) {
    let next = (startIndex + 1) % players.length;
    let count = 0;
    while (players[next].status !== 'active' && count < players.length) {
        next = (next + 1) % players.length;
        count++;
    }
    return next;
}

function startNextPhase() {
    players.forEach(p => { p.hasActed = false; p.betThisRound = 0; p.lastAction = ""; });
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
        gameState.status = 'showdown';
        return io.emit('gameUpdate', { players, gameState });
    }

    // מהפלופ והלאה: הראשון משמאל לדילר (Dealer+1) תמיד מתחיל
    gameState.turnIndex = getNextActivePlayer(gameState.dealerIndex);
    io.emit('gameUpdate', { players, gameState });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        players.push({ 
            id: socket.id, username, chips: 1000, cards: [], 
            status: 'active', isAdmin: players.length === 0, 
            betThisRound: 0, hasActed: false, lastAction: "" 
        });
        io.emit('updatePlayers', players);
    });

    socket.on('startGame', (customBlinds) => {
        if (players.length < 2) return;
        const sb = customBlinds?.sb || 5;
        const bb = sb * 2;
        
        deck = createDeck();
        gameState.status = 'playing';
        gameState.phase = 'preflop';
        gameState.communityCards = [];
        gameState.pot = sb + bb;
        gameState.currentBet = bb;

        const sbIndex = getNextActivePlayer(gameState.dealerIndex);
        const bbIndex = getNextActivePlayer(sbIndex);

        players.forEach((p, idx) => {
            p.cards = [deck.pop(), deck.pop()];
            p.status = 'active';
            p.hasActed = false;
            p.betThisRound = (idx === sbIndex) ? sb : (idx === bbIndex ? bb : 0);
            p.chips -= p.betThisRound;
            p.lastAction = (idx === sbIndex) ? "SB" : (idx === bbIndex ? "BB" : "");
        });

        // בפרה-פלופ: הראשון אחרי ה-BB מדבר (UTG)
        gameState.turnIndex = getNextActivePlayer(bbIndex);
        io.emit('gameUpdate', { players, gameState });
    });

    socket.on('action', (data) => {
        const player = players[gameState.turnIndex];
        if (player.id !== socket.id) return;

        if (data.type === 'fold') {
            player.status = 'folded';
            player.lastAction = "Fold";
        } else {
            const callAmount = gameState.currentBet - player.betThisRound;
            const totalBet = callAmount + (data.raise || 0);
            player.chips -= totalBet;
            player.betThisRound += totalBet;
            gameState.pot += totalBet;
            gameState.currentBet = Math.max(gameState.currentBet, player.betThisRound);
            player.lastAction = data.raise > 0 ? "Raise" : (callAmount > 0 ? "Call" : "Check");
            player.hasActed = true;
        }

        const activePlayers = players.filter(p => p.status === 'active');
        const roundOver = activePlayers.every(p => p.hasActed && p.betThisRound === gameState.currentBet);

        if (roundOver) {
            setTimeout(startNextPhase, 1000);
        } else {
            gameState.turnIndex = getNextActivePlayer(gameState.turnIndex);
            io.emit('gameUpdate', { players, gameState });
        }
    });
});

server.listen(process.env.PORT || 3000);
