io.on('connection', (socket) => {
    // שליחת חוקי השולחן ברגע שמישהו מתחבר
    socket.emit('rules_updated', { max: global.maxBuyin || 500, sb: global.sb || 5 });

    socket.on('set_rules', (data) => {
        global.maxBuyin = data.max;
        global.sb = data.sb;
        io.emit('rules_updated', data); // זה מה שמעדכן את כל השחקנים בשידור חי
    });

    socket.on('deal_cards', () => {
        io.emit('cards_dealt', { flop: ['As', 'Kd', 'Qh'] }); // כאן הקלפים נפתחים
    });
});
