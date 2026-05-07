const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// משתנים לשמירת חוקי המשחק
let currentMax = 500;
let currentSB = 10;
let players = [];

io.on('connection', (socket) => {
    // 1. ברגע שמישהו מתחבר, המנוע שולח לו את החוקים הנוכחיים
    socket.emit('rules_updated', { max: currentMax, sb: currentSB });

    // 2. כשהאדמין לוחץ על "נעל חוקים", המנוע מעדכן את כולם
    socket.on('set_rules', (data) => {
        currentMax = data.max;
        currentSB = data.sb;
        io.emit('rules_updated', data);
    });

    // 3. כשהאדמין לוחץ על "חלק יד", המנוע שולח פקודה לפתוח קלפים
    socket.on('deal_cards', () => {
        io.emit('cards_dealt', { 
            flop: ['Ah', 'Kd', 'Qc'], // דוגמה לקלפים
            pot: 0 
        });
    });

    socket.on('disconnect', () => {
        console.log('שחקן התנתק');
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('השרת רץ על פורט ' + PORT);
});
