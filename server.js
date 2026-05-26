const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Хранилище данных
let onlinePlayers = new Map(); // ID сокета -> данные игрока
let allRegisteredPlayers = new Map(); // Ник -> данные игрока
let matchmakingQueue = [];
let activeGames = [];

// Статические файлы
app.use(express.static('public'));

// WebSocket подключение
io.on('connection', (socket) => {
    console.log('🔌 Новое подключение:', socket.id);

    // РЕГИСТРАЦИЯ ИГРОКА
    socket.on('register', (data) => {
        const { nickname } = data;
        
        // Проверка на уникальность ника
        if (allRegisteredPlayers.has(nickname)) {
            const existingPlayer = allRegisteredPlayers.get(nickname);
            existingPlayer.socketId = socket.id;
            existingPlayer.online = true;
            existingPlayer.status = 'online';
            existingPlayer.lastSeen = Date.now();
            
            onlinePlayers.set(socket.id, existingPlayer);
            
            socket.emit('registered', {
                success: true,
                player: existingPlayer
            });
        } else {
            const newPlayer = {
                socketId: socket.id,
                nickname: nickname,
                trophies: Math.floor(Math.random() * 3000) + 1000,
                online: true,
                status: 'online',
                wins: 0,
                losses: 0,
                joinedAt: Date.now(),
                lastSeen: Date.now()
            };
            
            allRegisteredPlayers.set(nickname, newPlayer);
            onlinePlayers.set(socket.id, newPlayer);
            
            socket.emit('registered', {
                success: true,
                player: newPlayer
            });
        }
        
        // Отправляем обновленный список всем
        broadcastOnlineStats();
    });

    // ПОИСК БОЯ
    socket.on('findMatch', () => {
        const player = onlinePlayers.get(socket.id);
        if (!player) return;

        player.status = 'searching';
        matchmakingQueue.push({
            socketId: socket.id,
            player: player
        });

        console.log(`🔍 ${player.nickname} ищет бой. В очереди: ${matchmakingQueue.length}`);

        // Если набралось 6 игроков - создаем игру
        if (matchmakingQueue.length >= 6) {
            const gamePlayers = matchmakingQueue.splice(0, 6);
            const gameId = 'game_' + Date.now();
            
            activeGames.push({
                id: gameId,
                players: gamePlayers,
                startedAt: Date.now()
            });

            // Уведомляем игроков
            gamePlayers.forEach(gp => {
                gp.player.status = 'in-game';
                io.to(gp.socketId).emit('matchFound', {
                    gameId: gameId,
                    players: gamePlayers.map(p => p.player.nickname)
                });
            });

            console.log(`🎮 Создана игра ${gameId} с ${gamePlayers.length} игроками`);

            // Через 2 минуты завершаем игру
            setTimeout(() => {
                endGame(gameId);
            }, 120000);
        }

        broadcastOnlineStats();
    });

    // ОТМЕНА ПОИСКА
    socket.on('cancelSearch', () => {
        matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);
        const player = onlinePlayers.get(socket.id);
        if (player) {
            player.status = 'online';
        }
        broadcastOnlineStats();
    });

    // ПОЛУЧИТЬ СПИСОК БОЙЦОВ
    socket.on('getBrawlers', () => {
        socket.emit('brawlersList', getBrawlers());
    });

    // ОТКЛЮЧЕНИЕ
    socket.on('disconnect', () => {
        const player = onlinePlayers.get(socket.id);
        if (player) {
            console.log('❌ Отключение:', player.nickname);
            player.online = false;
            player.status = 'offline';
            player.lastSeen = Date.now();
            onlinePlayers.delete(socket.id);
            
            // Удаляем из очереди поиска
            matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);
        }
        broadcastOnlineStats();
    });
});

// ЗАВЕРШЕНИЕ ИГРЫ
function endGame(gameId) {
    const gameIndex = activeGames.findIndex(g => g.id === gameId);
    if (gameIndex === -1) return;

    const game = activeGames[gameIndex];
    
    // Случайно определяем победителей
    game.players.forEach(gp => {
        const player = onlinePlayers.get(gp.socketId);
        if (player) {
            const won = Math.random() > 0.5;
            if (won) {
                player.wins++;
                player.trophies += 8;
            } else {
                player.losses++;
                player.trophies = Math.max(0, player.trophies - 3);
            }
            player.status = 'online';
            
            io.to(gp.socketId).emit('gameEnded', {
                won: won,
                trophies: player.trophies
            });
        }
    });

    activeGames.splice(gameIndex, 1);
    console.log(`✅ Игра ${gameId} завершена`);
    broadcastOnlineStats();
}

// ОТПРАВКА СТАТИСТИКИ ВСЕМ
function broadcastOnlineStats() {
    const stats = {
        online: onlinePlayers.size,
        searching: matchmakingQueue.length,
        inGame: activeGames.reduce((sum, game) => sum + game.players.length, 0),
        totalPlayers: allRegisteredPlayers.size,
        players: Array.from(onlinePlayers.values())
            .sort((a, b) => b.trophies - a.trophies)
            .slice(0, 20),
        activeGames: activeGames.length
    };
    
    io.emit('onlineStats', stats);
}

// СПИСОК БОЙЦОВ
function getBrawlers() {
    return [
        { id: 1, name: 'Шелли', rarity: 'common', hp: 3600, damage: 300, img: '🔫', color: '#32cd32' },
        { id: 2, name: 'Кольт', rarity: 'common', hp: 2400, damage: 360, img: '🎯', color: '#32cd32' },
        { id: 3, name: 'Ниту', rarity: 'common', hp: 3000, damage: 820, img: '🐻', color: '#32cd32' },
        { id: 4, name: 'Булл', rarity: 'common', hp: 5000, damage: 440, img: '🐂', color: '#32cd32' },
        { id: 5, name: 'Эль Примо', rarity: 'rare', hp: 7000, damage: 360, img: '💪', color: '#1e90ff' },
        { id: 6, name: 'Барли', rarity: 'rare', hp: 2400, damage: 800, img: '🍺', color: '#1e90ff' },
        { id: 7, name: 'Рико', rarity: 'rare', hp: 2400, damage: 440, img: '🤖', color: '#1e90ff' },
        { id: 8, name: 'Дина', rarity: 'rare', hp: 2800, damage: 1040, img: '💣', color: '#1e90ff' },
        { id: 9, name: 'Поко', rarity: 'super-rare', hp: 3600, damage: 800, img: '🎸', color: '#9370db' },
        { id: 10, name: 'Роза', rarity: 'super-rare', hp: 6200, damage: 440, img: '🌹', color: '#9370db' },
        { id: 11, name: 'Джесси', rarity: 'super-rare', hp: 3400, damage: 840, img: '🔧', color: '#9370db' },
        { id: 12, name: 'Спайк', rarity: 'legendary', hp: 2800, damage: 520, img: '🌵', color: '#ffd700' },
        { id: 13, name: 'Ворон', rarity: 'legendary', hp: 3000, damage: 400, img: '🦅', color: '#ffd700' },
        { id: 14, name: 'Леон', rarity: 'legendary', hp: 3200, damage: 440, img: '🦎', color: '#ffd700' },
    ];
}

// Обновление статистики каждые 3 секунды
setInterval(() => {
    broadcastOnlineStats();
}, 3000);

// ЗАПУСК СЕРВЕРА
http.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
