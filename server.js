const io = require('socket.io')(server);
let tableConfig = { maxBuyin: null, sb: null, bb: null, started: false };
let players = [];

io.on('connection', (socket) => {
    // הגדרת השולחן על ידי האדמין בלבד
    socket.on('setup_table', (data) => {
        tableConfig = { maxBuyin: data.max, sb: data.sb, bb: data.sb * 2, started: true };
        io.emit('table_ready', tableConfig);
    });

    socket.on('join_request', (user) => {
        // אכיפה קשיחה: שחקן לא יכול להיכנס אם הוא חורג מהחוקים שלך
        if (user.buyin > tableConfig.maxBuyin) {
            socket.emit('error_msg', 'הסכום גבוה מהמקסימום שנקבע לשולחן זה');
            return;
        }
        players.push({ 
            id: socket.id, name: user.name, 
            bank: user.buyin, // הכסף בראש
            bet: 0, // צ'יפים על השולחן
            isAdmin: players.length === 0 
        });
        io.emit('player_list', players);
    });
});
