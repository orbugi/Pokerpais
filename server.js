const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let tableState = {
    maxBuyin: 500,
    sb: 10,
    pot: 0,
    players: [],
    phase: 'waiting', // waiting, flop, turn, river
    communityCards: []
};

io.on('connection', (socket) => {
    socket.emit('sync_table', tableState);

    socket.on('set_rules', (data) => {
        tableState.maxBuyin = parseInt(data.max);
        tableState.sb = parseInt(data.sb);
        io.emit('sync_table', tableState);
    });

    socket.on('join_game', (player) => {
        if (tableState.players.length < 6) {
            const newPlayer = {
                id: socket.id,
                name: player.name,
                stack: parseInt(player.buyin) - tableState.sb,
                bet: tableState.sb
            };
            tableState.players.push(newPlayer);
            tableState.pot += tableState.sb;
            io.emit('sync_table', tableState);
        }
    });

    socket.on('deal_flop', () => {
        tableState.communityCards = ['Ah', 'Kd', 'Qc']; // פלופ לדוגמה
        tableState.phase = 'flop';
        io.emit('sync_table', tableState);
    });

    socket.on('disconnect', () => {
        tableState.players = tableState.players.filter(p => p.id !== socket.id);
        io.emit('sync_table', tableState);
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Poker Server Running'));
