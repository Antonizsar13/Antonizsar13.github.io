document.addEventListener('DOMContentLoaded', function() {
    let db;

    // Открытие базы данных
    function openDatabase() {
        const request = indexedDB.open('minesweeper', 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            const objectStore = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        };

        request.onsuccess = function(event) {
            db = event.target.result;
        };

        request.onerror = function(event) {
            console.error('Error opening IndexedDB:', event.target.error);
        };
    }

    openDatabase();

    let width, height, mines, gameBoard, cells, gameStatus, gameOver = false, playerName;
    let gameSaved = false; // Флаг для проверки, была ли игра сохранена

    // Привязка кнопки старта игры
    const startBtn = document.getElementById('startBtn');
    startBtn.addEventListener('click', startNewGame);

    const viewPastGamesBtn = document.getElementById('view-past-games');
    viewPastGamesBtn.addEventListener('click', loadPastGames);

    const clearDbBtn = document.getElementById('clear-db');
    clearDbBtn.addEventListener('click', clearDatabase); // Событие для кнопки очистки базы

    function startNewGame() {
        playerName = document.getElementById('player-name').value.trim();
        if (!playerName) {
            alert('Please enter your name before starting the game.');
            return;
        }

        width = parseInt(document.getElementById('size').value);
        height = width;
        mines = parseInt(document.getElementById('mines').value);

        gameBoard = document.getElementById('game-board');
        gameStatus = document.getElementById('game-status');
        gameOver = false;
        gameSaved = false;

        gameBoard.innerHTML = '';
        gameStatus.textContent = '';

        cells = [];
        const allCells = width * height;
        const minePositions = generateMines(allCells, mines);

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.index = i * width + j;
                gameBoard.appendChild(cell);
                cells.push(cell);

                cell.addEventListener('click', () => {
                    if (gameOver) return;
                    handleCellClick(cell, minePositions);
                });
            }
        }

        // Настройки отображения поля
        gameBoard.style.gridTemplateColumns = `repeat(${width}, 40px)`;
        gameBoard.style.gridTemplateRows = `repeat(${height}, 40px)`;

        document.querySelector('.game-container').style.display = 'block';
    }

    function generateMines(totalCells, mineCount) {
        const minePositions = new Set();
        while (minePositions.size < mineCount) {
            minePositions.add(Math.floor(Math.random() * totalCells));
        }
        return minePositions;
    }

    function handleCellClick(cell, minePositions) {
        const index = parseInt(cell.dataset.index);

        if (minePositions.has(index)) {
            cell.classList.add('revealed', 'mine');
            gameOver = true;
            gameStatus.textContent = 'Game Over!';
            if (!gameSaved) {
                saveGame(false);  
                gameSaved = true; 
            }
            return;
        }

        revealCell(cell, minePositions);
    }

    function revealCell(cell, minePositions) {
        const index = parseInt(cell.dataset.index);
        if (cell.classList.contains('revealed')) return;

        cell.classList.add('revealed');
        const adjacentMines = countAdjacentMines(index, minePositions);

        if (adjacentMines > 0) {
            cell.textContent = adjacentMines;
        } else {
            revealAdjacentCells(index, minePositions);
        }

        
        if (checkForWin(minePositions) && !gameSaved) {
            gameStatus.textContent = 'You Win!';
            gameOver = true;
            saveGame(true);
            gameSaved = true;
        }
    }

    function revealAdjacentCells(index, minePositions) {
    const neighbors = [
        -1, 1, -width, width,
        -width - 1, -width + 1, width - 1, width + 1
    ];

    neighbors.forEach(offset => {
        const neighborIndex = index + offset;

        // Проверка, находится ли сосед в пределах поля:
        // Убедимся, что сосед не выходит за границы поля
        if (neighborIndex < 0 || neighborIndex >= width * height) return;

        // Не проверяем соседей за границами строк
        if ((index % width === 0 && offset === -1) || // Левый край
            ((index + 1) % width === 0 && offset === 1)) { // Правый край
            return;
        }

        const neighborCell = cells[neighborIndex];
        if (!neighborCell.classList.contains('revealed') && !minePositions.has(neighborIndex)) {
            revealCell(neighborCell, minePositions);
        }
    });
}

function countAdjacentMines(index, minePositions) {
    const neighbors = [
        -1, 1, -width, width,
        -width - 1, -width + 1, width - 1, width + 1
    ];
    let mineCount = 0;

    neighbors.forEach(offset => {
        const neighborIndex = index + offset;

        if (neighborIndex < 0 || neighborIndex >= width * height) return;

        if ((index % width === 0 && offset === -1) || 
            ((index + 1) % width === 0 && offset === 1)) { 
            return;
        }

        if (minePositions.has(neighborIndex)) mineCount++;
    });

    return mineCount;
}



    function checkForWin(minePositions) {
        return cells.every(cell => {
            const index = parseInt(cell.dataset.index);
            return minePositions.has(index) || cell.classList.contains('revealed');
        });
    }

    // Сохранение игры
    function saveGame(winStatus) {
        const gameData = {
            playerName: playerName,
            size: `${width}x${height}`,
            mines: mines,
            winStatus: winStatus ? 'Won' : 'Lost',
            timestamp: new Date().toISOString(),
        };

        const transaction = db.transaction(['games'], 'readwrite');
        const objectStore = transaction.objectStore('games');
        const request = objectStore.add(gameData);

        request.onsuccess = function(event) {
            console.log('Game saved with ID:', event.target.result);
        };

        request.onerror = function(event) {
            console.error('Error saving game:', event.target.error);
        };
    }

    // Загрузка прошлых игр
    function loadPastGames() {
        const transaction = db.transaction(['games'], 'readonly');
        const objectStore = transaction.objectStore('games');
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const games = event.target.result;
            const gameList = document.getElementById('game-list');
            gameList.innerHTML = '';

            games.forEach(game => {
                const listItem = document.createElement('li');
                const timestamp = new Date(game.timestamp).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
                listItem.textContent = `Player: ${game.playerName} - Game on ${timestamp} - Size: ${game.size} - Mines: ${game.mines} - Result: ${game.winStatus}`;
                gameList.appendChild(listItem);
            });
        };

        request.onerror = function(event) {
            console.error('Error loading games:', event.target.error);
        };
    }

    // Функция для очистки базы данных
    function clearDatabase() {
        const request = indexedDB.deleteDatabase('minesweeper');
        
        request.onsuccess = function() {
            console.log('Database cleared');
            alert('Database cleared!');
            loadPastGames();  // Обновляем список игр после очистки
        };

        request.onerror = function(event) {
            console.error('Error clearing database:', event.target.error);
            alert('Error clearing database');
        };
    }
});