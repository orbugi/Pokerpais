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
    currentBet: 0, turnIndex: 0, dealerIndex: 0, sb: 5 
};

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let d = [];
    for (let s of suits) for (let v of values) d.push({v, s});
    return d.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        if (players.length >= 8) return;
        players.push({ 
            id: socket.id, username: name, chips: 1000, cards: [], 
            status: 'active', betThisRound: 0, hasActed: false, 
            lastAction: "", isAdmin: players.length === 0 
        });
        io.emit('updatePlayers', players);
    });

    socket.on('startGame', (cfg) => {
        if (players.length < 2) return;
        
        // אתחול נתונים
        gameState.sb = cfg.sb || 5;
        let bb = gameState.sb * 2;
        deck = createDeck();
        gameState.phase = 'preflop';
        gameState.communityCards = [];
        gameState.currentBet = bb;
        
        // הגדרת SB ו-BB (כיוון השעון מהדילר)
        let sbIdx = (gameState.dealerIndex + 1) % players.length;
        let bbIdx = (gameState.dealerIndex + 2) % players.length;

        players.forEach((p, i) => {
            p.cards = [deck.pop(), deck.pop()];
            p.status = 'active';
            p.hasActed = false;
            p.betThisRound = 0;
            p.lastAction = "";

            if (i === sbIdx) {
                p.chips -= gameState.sb;
                p.betThisRound = gameState.sb;
                p.lastAction = "SB: " + gameState.sb;
            } else if (i === bbIdx) {
                p.chips -= bb;
                p.betThisRound = bb;
                p.lastAction = "BB: " + bb;
            }
        });

        gameState.pot = gameState.sb + bb;
        // התור מתחיל מהשחקן שאחרי ה-Big Blind בפרה-פלופ
        gameState.turnIndex = (bbIdx + 1) % players.length;
        
        io.emit('gameUpdate', { players, gameState });
    });

    socket.on('action', (act) => {
        let p = players[gameState.turnIndex];
        if (!p || p.id !== socket.id) return;

        if (act.type === 'fold') {
            p.status = 'folded';
            p.lastAction = "Fold";
        } else {
            let call = gameState.currentBet - p.betThisRound;
            let raise = act.raise || 0;
            let total = call + raise;
            
            p.chips -= total;
            p.betThisRound += total;
            gameState.pot += total;
            gameState.currentBet = Math.max(gameState.currentBet, p.betThisRound);
            p.lastAction = raise > 0 ? "Raise" : (call > 0 ? "Call" : "Check");
        }
        p.hasActed = true;

        // לוגיקה למעבר שלב או העברת תור... (מושמט לקיצור, זהה לקוד הקודם)
        gameState.turnIndex = (gameState.turnIndex + 1) % players.length;
        while(players[gameState.turnIndex].status === 'folded') {
            gameState.turnIndex = (gameState.turnIndex + 1) % players.length;
        }
        io.emit('gameUpdate', { players, gameState });
    });
});

server.listen(process.env.PORT || 3000);
