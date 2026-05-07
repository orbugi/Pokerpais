const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let gameData = {
    maxBuyin: 500,
    sb: 10,
    pot: 0,
    players: [],
    communityCards: [],
    phase: 'waiting'
};

io.on('connection', (socket) => {
    // שליחת מצב שולחן עדכני ברגע החיבור
    socket.emit('update_table', gameData);

    socket.on('admin_config', (data) => {
        gameData.maxBuyin = parseInt(data.max);
        gameData.sb = parseInt(data.sb);
        io.emit('update_table', gameData); // עדכון לכולם בזמן אמת
    });

    socket.on('player_join', (data) => {
        if (gameData.players.length < 6) {
            const player = {
                id: socket.id,
                name: data.name,
                stack: parseInt(data.buyin) - gameData.sb,
                bet: gameData.sb
            };
            gameData.players.push(player);
            gameData.pot += gameData.sb;
            io.emit('update_table', gameData);
        }
    });

    socket.on('deal_cards', (phase) => {
        const deck = ['A♠', 'K♦', 'Q♣', 'J♥', '10♠']; // לוגיקה פשוטה לחלוקה
        if (phase === 'flop') gameData.communityCards = deck.slice(0, 3);
        gameData.phase = phase;
        io.emit('update_table', gameData);
    });

    socket.on('disconnect', () => {
        gameData.players = gameData.players.filter(p => p.id !== socket.id);
        io.emit('update_table', gameData);
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Server Active'));
