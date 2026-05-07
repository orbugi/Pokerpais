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
    maxBuyin: 500,
    sb: 10,
    phase: 'waiting'
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
        game.maxBuyin = parseInt(data.max);
        game.sb = parseInt(data.sb);
        game.deck = createDeck();
        game.community = game.deck.splice(0, 5);
        game.phase = 'preflop';
        game.pot = 0;
        game.players = []; // איפוס שחקנים לתחילת משחק חדש
        io.emit('sync', game);
    });

    socket.on('join', (data) => {
        const pCards = [game.deck.pop(), game.deck.pop()];
        const newPlayer = {
            id: socket.id,
            name: data.name,
            stack: parseInt(data.buyin) - game.sb,
            bet: game.sb,
            cards: pCards // הקלפים נשמרים כאן
        };
        game.players.push(newPlayer);
        game.pot += game.sb;
        io.emit('sync', game);
    });

    socket.on('action', (data) => {
        let p = game.players.find(pl => pl.id === socket.id);
        if (!p) return;
        if (data.type === 'call') {
            const amount = game.sb; // הימור בסיסי לצורך הבדיקה
            p.stack -= amount;
            p.bet += amount;
            game.pot += amount;
        } else if (data.type === 'fold') {
            p.cards = [];
        }
        io.emit('sync', game);
    });

    socket.on('next_phase', () => {
        const phases = ['preflop', 'flop', 'turn', 'river'];
        let curr = phases.indexOf(game.phase);
        game.phase = phases[curr + 1] || 'preflop';
        io.emit('sync', game);
    });
});

http.listen(process.env.PORT || 3000);
