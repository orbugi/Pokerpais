const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = [];
let deck = [];
let gameState = { pot: 0, communityCards: [], status: 'waiting', currentTurn: 0, phase: 'preflop' };

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let newDeck = [];
    for (let s of suits) for (let v of values) newDeck.push({v, s});
    return newDeck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        if (players.length < 8) {
            players.push({ id: socket.id, username, chips: 1000, cards: [], status: 'active', isAdmin: players.length === 0 });
            io.emit('updatePlayers', players);
        }
    });

    socket.on('startGame', () => {
        const admin = players.find(p => p.id === socket.id && p.isAdmin);
        if (admin && players.length >= 2) {
            deck = createDeck();
            gameState = { pot: 0, communityCards: [], status: 'playing', currentTurn: 0, phase: 'preflop' };
            players.forEach(p => { p.cards = [deck.pop(), deck.pop()]; p.status = 'active'; });
            io.emit('gameUpdate', { players, gameState });
        }
    });

    socket.on('nextPhase', () => {
        const admin = players.find(p => p.id === socket.id && p.isAdmin);
        if (!admin) return;
        if (gameState.phase === 'preflop') {
            gameState.communityCards.push(deck.pop(), deck.pop(), deck.pop());
            gameState.phase = 'flop';
        } else if (gameState.phase === 'flop' || gameState.phase === 'turn') {
            gameState.communityCards.push(deck.pop());
            gameState.phase = gameState.phase === 'flop' ? 'turn' : 'river';
        }
        io.emit('gameUpdate', { players, gameState });
    });

    socket.on('action', (data) => {
        // כאן נכנסת לוגיקת ההימורים בתורות
        gameState.pot += data.amount || 0;
        gameState.currentTurn = (gameState.currentTurn + 1) % players.length;
        io.emit('gameUpdate', { players, gameState });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);
    });
});

server.listen(process.env.PORT || 3000);
