const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static('public'));

// Хранилище игр
const games = new Map();

// Генерация кода комнаты
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Генерация карты игрока (11 характеристик)
function generatePlayerCard() {
    const GENDERS = ["Мужчина", "Женщина"];
    const BODY_TYPES = ["Атлетическое", "Худощавое", "Крепкое", "Хрупкое", "Мускулистое"];
    const PERSONALITY = ["Добрый", "Харизматичный", "Замкнутый", "Весёлый", "Серьёзный", "Эгоистичный", "Альтруист", "Оптимист", "Спокойный", "Импульсивный"];
    const PROFESSIONS = ["Инженер", "Врач", "Военный", "Агроном", "Электрик", "Психолог", "Биолог", "Повар", "Строитель", "Механик", "Охотник", "Спасатель", "Пожарный", "Священник", "Фермер", "Сапёр", "Кузнец", "Ветеринар", "Пилот", "Учитель"];
    const HEALTHS = ["Здоров", "Аллергия", "Астматик", "Диабет", "Гипертония", "Мигрень", "Бессонница", "Проблемы со спиной"];
    const HOBBIES = ["Шахматы", "Гитара", "Рыбалка", "Охота", "Кулинария", "Садоводство", "Походы", "Столярка", "Рисование", "Йога", "Стрельба", "Книги"];
    const PHOBIAS = ["Клаустрофобия", "Акрофобия", "Социофобия", "Арахнофобия", "Никтофобия", "Агорафобия", "Гемофобия", "Танатофобия"];
    const BIG_INVENTORY = ["Автомобиль", "Мотоцикл", "Генератор", "Холодильник", "Сейф", "Компьютер", "Велосипед", "Лодка"];
    const BACKPACK = ["Палатка", "Спальник", "Аптечка", "Нож", "Фонарик", "Консервы", "Вода", "Спички", "Верёвка", "Топор", "Радио", "Компас"];
    const EXTRA_INFO = ["Знает языки", "Умеет водить танк", "Был в тюрьме", "Имеет связи", "Скрывает прошлое", "Был миллионером", "Имеет тайник", "Знает секрет бункера"];
    
    const SPECIAL_ABILITIES = {
        "Уборщик": "Может выбросить чужой инвентарь",
        "Вор": "Может украсть предмет",
        "Врач": "Может вылечить болезнь",
        "Инженер": "Может починить оборудование",
        "Повар": "Может удвоить еду",
        "Полицейский": "Может обыскать игрока"
    };
    
    const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
    const age = Math.floor(Math.random() * 54) + 16;
    const profession = PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)];
    const specialAbility = SPECIAL_ABILITIES[profession] || "Нет специальных возможностей";
    
    return {
        genderAge: `${gender}, ${age} лет`,
        bodyType: BODY_TYPES[Math.floor(Math.random() * BODY_TYPES.length)],
        personality: PERSONALITY[Math.floor(Math.random() * PERSONALITY.length)],
        profession: profession,
        health: HEALTHS[Math.floor(Math.random() * HEALTHS.length)],
        hobby: HOBBIES[Math.floor(Math.random() * HOBBIES.length)],
        phobia: PHOBIAS[Math.floor(Math.random() * PHOBIAS.length)],
        bigInventory: BIG_INVENTORY[Math.floor(Math.random() * BIG_INVENTORY.length)],
        backpack: BACKPACK[Math.floor(Math.random() * BACKPACK.length)],
        extraInfo: EXTRA_INFO[Math.floor(Math.random() * EXTRA_INFO.length)],
        specialAbility: specialAbility
    };
}

// Генерация ресурсов бункера
function generateResources() {
    return {
        beds: Math.floor(Math.random() * 8) + 3,
        food: Math.floor(Math.random() * 24) + 6,
        water: Math.floor(Math.random() * 24) + 6,
        medkits: Math.floor(Math.random() * 8) + 1
    };
}

// Список характеристик
const CHARACTERISTICS = [
    { key: "genderAge", label: "ПОЛ, ВОЗРАСТ", icon: "👤" },
    { key: "bodyType", label: "ТЕЛОСЛОЖЕНИЕ", icon: "💪" },
    { key: "personality", label: "ХАРАКТЕР", icon: "🧠" },
    { key: "profession", label: "ПРОФЕССИЯ", icon: "🔧" },
    { key: "health", label: "ЗДОРОВЬЕ", icon: "❤️" },
    { key: "hobby", label: "ХОББИ", icon: "⭐" },
    { key: "phobia", label: "ФОБИЯ", icon: "😨" },
    { key: "bigInventory", label: "КРУПНЫЙ ИНВЕНТАРЬ", icon: "🚗" },
    { key: "backpack", label: "РЮКЗАК", icon: "🎒" },
    { key: "extraInfo", label: "ДОП. СВЕДЕНИЕ", icon: "📜" },
    { key: "specialAbility", label: "СПЕЦВОЗМОЖНОСТЬ", icon: "✨" }
];

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    
    // Создание комнаты
    socket.on('create_room', (data, callback) => {
        const { playerName, maxPlayers } = data;
        const roomCode = generateRoomCode();
        const playerId = socket.id;
        
        const situations = ["Ядерная зима", "Зомби-апокалипсис", "Падение астероида", "Эпидемия", "ИИ восстал", "Солнечная вспышка", "Наводнение", "Радиация", "Гражданская война"];
        const bunkers = ["Военный бункер", "Научный комплекс", "Заброшенная шахта", "Секретная база", "Био-купол", "Арктическая станция", "Бункер миллиардера", "Подводная лодка"];
        
        const game = {
            roomCode: roomCode,
            maxPlayers: maxPlayers,
            players: [{
                id: playerId,
                name: playerName,
                isHost: true,
                number: 1,
                eliminated: false,
                revealed: false,
                voted: false,
                card: generatePlayerCard(),
                revealedChars: Object.fromEntries(CHARACTERISTICS.map(c => [c.key, false]))
            }],
            phase: "waiting",
            currentTurn: 0,
            situation: situations[Math.floor(Math.random() * situations.length)],
            bunker: bunkers[Math.floor(Math.random() * bunkers.length)],
            resources: generateResources(),
            votes: {}
        };
        
        games.set(roomCode, game);
        socket.join(roomCode);
        
        callback({ success: true, roomCode: roomCode, playerId: playerId });
        
        io.to(roomCode).emit('game_update', game);
    });
    
    // Присоединение к комнате
    socket.on('join_room', (data, callback) => {
        const { roomCode, playerName } = data;
        const game = games.get(roomCode);
        
        if (!game) {
            callback({ success: false, error: "Комната не найдена" });
            return;
        }
        
        if (game.players.length >= game.maxPlayers) {
            callback({ success: false, error: "Комната полна" });
            return;
        }
        
        if (game.phase !== "waiting") {
            callback({ success: false, error: "Игра уже началась" });
            return;
        }
        
        const playerId = socket.id;
        game.players.push({
            id: playerId,
            name: playerName,
            isHost: false,
            number: game.players.length + 1,
            eliminated: false,
            revealed: false,
            voted: false,
            card: generatePlayerCard(),
            revealedChars: Object.fromEntries(CHARACTERISTICS.map(c => [c.key, false]))
        });
        
        socket.join(roomCode);
        games.set(roomCode, game);
        
        callback({ success: true, playerId: playerId });
        
        io.to(roomCode).emit('game_update', game);
    });
    
    // Начало игры
    socket.on('start_game', (data) => {
        const { roomCode } = data;
        const game = games.get(roomCode);
        
        if (!game) return;
        
        game.phase = "revealing";
        game.currentTurn = 0;
        game.votes = {};
        
        game.players.forEach(p => {
            p.revealed = false;
            p.voted = false;
        });
        
        games.set(roomCode, game);
        io.to(roomCode).emit('game_update', game);
    });
    
    // Раскрытие характеристики
    socket.on('reveal_char', (data) => {
        const { roomCode, charKey } = data;
        const game = games.get(roomCode);
        
        if (!game) return;
        
        const currentPlayer = game.players[game.currentTurn];
        
        if (currentPlayer && currentPlayer.id === socket.id && !currentPlayer.eliminated) {
            currentPlayer.revealedChars[charKey] = true;
            
            // Проверяем, все ли характеристики раскрыты
            const allRevealed = CHARACTERISTICS.every(c => currentPlayer.revealedChars[c.key]);
            
            if (allRevealed) {
                currentPlayer.revealed = true;
            }
            
            // Переход к следующему игроку
            let nextTurn = game.currentTurn + 1;
            while (nextTurn < game.players.length && game.players[nextTurn].eliminated) {
                nextTurn++;
            }
            
            if (nextTurn >= game.players.length) {
                game.phase = "voting";
                game.votes = {};
                game.players.forEach(p => {
                    if (!p.eliminated) p.voted = false;
                });
            } else {
                game.currentTurn = nextTurn;
            }
            
            games.set(roomCode, game);
            io.to(roomCode).emit('game_update', game);
        }
    });
    
    // Голосование
    socket.on('vote', (data) => {
        const { roomCode, votedPlayerId } = data;
        const game = games.get(roomCode);
        
        if (!game) return;
        
        const voter = game.players.find(p => p.id === socket.id);
        
        if (voter && !voter.eliminated && !voter.voted && game.phase === "voting") {
            game.votes[socket.id] = votedPlayerId;
            voter.voted = true;
            
            games.set(roomCode, game);
            io.to(roomCode).emit('game_update', game);
        }
    });
    
    // Завершение голосования (только для хоста)
    socket.on('resolve_vote', (data) => {
        const { roomCode } = data;
        const game = games.get(roomCode);
        
        if (!game) return;
        
        const host = game.players.find(p => p.isHost);
        if (host.id !== socket.id) return;
        
        // Подсчёт голосов
        const voteCount = {};
        for (let [, votedId] of Object.entries(game.votes)) {
            voteCount[votedId] = (voteCount[votedId] || 0) + 1;
        }
        
        let maxVotes = 0;
        let eliminatedId = null;
        for (let [id, count] of Object.entries(voteCount)) {
            if (count > maxVotes) {
                maxVotes = count;
                eliminatedId = id;
            }
        }
        
        const eliminated = game.players.find(p => p.id === eliminatedId);
        if (eliminated) {
            eliminated.eliminated = true;
        }
        
        const activePlayers = game.players.filter(p => !p.eliminated);
        
        if (activePlayers.length <= 2) {
            game.phase = "game_over";
        } else {
            const situations = ["Ядерная зима", "Зомби-апокалипсис", "Падение астероида", "Эпидемия", "ИИ восстал", "Солнечная вспышка", "Наводнение", "Радиация"];
            const bunkers = ["Военный бункер", "Научный комплекс", "Заброшенная шахта", "Секретная база", "Био-купол", "Арктическая станция"];
            
            game.phase = "revealing";
            game.currentTurn = 0;
            game.votes = {};
            game.situation = situations[Math.floor(Math.random() * situations.length)];
            game.bunker = bunkers[Math.floor(Math.random() * bunkers.length)];
            game.resources = generateResources();
            
            game.players.forEach(p => {
                if (!p.eliminated) {
                    p.revealed = false;
                    p.voted = false;
                    for (let key of CHARACTERISTICS.map(c => c.key)) {
                        p.revealedChars[key] = false;
                    }
                }
            });
            
            while (game.currentTurn < game.players.length && game.players[game.currentTurn].eliminated) {
                game.currentTurn++;
            }
        }
        
        games.set(roomCode, game);
        io.to(roomCode).emit('game_update', game);
    });
    
    // Отключение игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        
        for (let [roomCode, game] of games.entries()) {
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                
                if (game.players.length === 0) {
                    games.delete(roomCode);
                } else {
                    games.set(roomCode, game);
                    io.to(roomCode).emit('game_update', game);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
