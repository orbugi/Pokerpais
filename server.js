const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let game = {
    players: [],
    deck: [],
    community: [],
    pot: 0,
    turnIndex: 0,
    phase: 'preflop', // preflop, flop, turn, river
    maxBuyin: 500,
    sb: 10
};

function createDeck() {
    const suits = ['h', 'd', 's', 'c'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let deck = [];
    for(let s of suits) for(let v of values) deck.push(v + s);
    return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.emit('sync', game);

    socket.on('admin_init', (data) => {
        game.maxBuyin = data.max;
        game.sb = data.sb;
        game.deck = createDeck();
        game.community = game.deck.splice(0, 5);
        io.emit('sync', game);
    });

    socket.on('join', (data) => {
        if (game.players.length < 6) {
            const pCards = [game.deck.pop(), game.deck.pop()];
            game.players.push({
                id: socket.id,
                name: data.name,
                stack: data.buyin - game.sb,
                bet: game.sb,
                cards: pCards
            });
            game.pot += game.sb;
            io.emit('sync', game);
        }
    });

    socket.on('action', (data) => {
        // כאן נכנסת הלוגיקה של הימור/צ'ק/פולד
        let p = game.players.find(pl => pl.id === socket.id);
        if (data.type === 'call') {
            p.stack -= data.amount;
            p.bet += data.amount;
            game.pot += data.amount;
        }
        // מעבר שלב אוטומטי
        game.turnIndex = (game.turnIndex + 1) % game.players.length;
        io.emit('sync', game);
    });

    socket.on('next_phase', () => {
        const phases = ['preflop', 'flop', 'turn', 'river'];
        game.phase = phases[phases.indexOf(game.phase) + 1] || 'preflop';
        io.emit('sync', game);
    });

    socket.on('disconnect', () => {
        game.players = game.players.filter(p => p.id !== socket.id);
        io.emit('sync', game);
    });
});

http.listen(process.env.PORT || 3000);
