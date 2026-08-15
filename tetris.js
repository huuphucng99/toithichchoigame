/**
 * RetroPulse Arcade - Tetris Game
 */

const SHAPES = {
    'I': [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    'J': [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'L': [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'O': [
        [1, 1],
        [1, 1]
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ],
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ]
};

const COLORS = {
    'I': '#00f0ff', // Cyan
    'J': '#0055ff', // Blue
    'L': '#ff5e00', // Orange
    'O': '#ffd700', // Yellow
    'S': '#39ff14', // Green
    'Z': '#ff007f', // Pink/Red
    'T': '#9d00ff'  // Purple
};

class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('tetrisCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.canvasNext = document.getElementById('canvasNext');
        this.ctxNext = this.canvasNext.getContext('2d');

        this.canvasHold = document.getElementById('canvasHold');
        this.ctxHold = this.canvasHold.getContext('2d');

        this.cols = 10;
        this.rows = 20;
        this.blockSize = this.canvas.width / this.cols; // 30px per block

        // Game State variables
        this.board = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.hasHeldThisTurn = false;

        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000; // ms per drop tick

        this.isPlaying = false;
        this.isPaused = false;

        this.gameLoopId = null;
        this.lastTime = 0;
        this.accumulatedTime = 0;

        // Visual Line clear particles
        this.particles = [];

        // Elements
        this.overlay = document.getElementById('tetrisOverlay');
        this.overlayTitle = document.getElementById('tetrisOverlayTitle');
        this.overlayScore = document.getElementById('tetrisOverlayScore');
        this.overlayBtn = document.getElementById('tetrisOverlayBtn');
        this.playPauseBtn = document.getElementById('tetrisPlayPauseBtn');
        this.resetBtn = document.getElementById('tetrisResetBtn');
        this.playText = document.getElementById('tetrisPlayText');

        // Score panels
        this.scoreLabel = document.getElementById('tetrisScore');
        this.highScoreLabel = document.getElementById('tetrisHighScore');
        this.levelLabel = document.getElementById('tetrisLevel');
        this.linesLabel = document.getElementById('tetrisLines');

        this.handleKeyDownBound = this.handleKeyDown.bind(this);

        this.initEventListeners();
    }

    init() {
        this.reset();
        this.updateStatsUI();
        this.showOverlay("MATRIX TETRIS", "Click to deploy blocks", "START");

        window.addEventListener('keydown', this.handleKeyDownBound);
    }

    destroy() {
        this.stopLoop();
        window.removeEventListener('keydown', this.handleKeyDownBound);
        this.isPlaying = false;
        this.isPaused = false;
    }

    reset() {
        // Build empty board matrix
        this.board = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
        
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.hasHeldThisTurn = false;
        this.particles = [];
        this.isPaused = false;

        this.updateStatsUI();
        this.clearPreviewCanvases();
    }

    clearPreviewCanvases() {
        this.ctxNext.clearRect(0, 0, this.canvasNext.width, this.canvasNext.height);
        this.ctxHold.clearRect(0, 0, this.canvasHold.width, this.canvasHold.height);
    }

    start() {
        if (!this.isPlaying) {
            this.reset();
            this.isPlaying = true;
            this.isPaused = false;
            
            // Populate initial pieces
            this.nextPiece = this.generatePiece();
            this.spawnPiece();
        } else if (this.isPaused) {
            this.isPaused = false;
        }

        this.hideOverlay();
        this.updateButtonsUI();

        // Start loops
        this.stopLoop();
        this.lastTime = performance.now();
        this.accumulatedTime = 0;
        this.gameLoopId = requestAnimationFrame(this.gameTick.bind(this));

        synth.playSuccess();
        showNotification("Tetris cyber grid loaded.");
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPaused = true;
        this.updateButtonsUI();
        this.showOverlay("PAUSED", `Score: ${this.score}`, "RESUME");
        synth.playTick();
    }

    togglePause() {
        if (this.isPaused || !this.isPlaying) {
            this.start();
        } else {
            this.pause();
        }
    }

    gameOver() {
        this.isPlaying = false;
        this.stopLoop();
        this.updateButtonsUI();

        synth.playGameOver();

        // Save score
        ScoreSystem.saveScore('tetris', this.score, `${this.lines} Lines`);
        this.updateStatsUI();

        this.showOverlay("GRID OVERFLOW", `Score: ${this.score}`, "PLAY AGAIN");
        showNotification("Tetris matrix overflowed.");
    }

    stopLoop() {
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    gameTick(timestamp) {
        if (!this.isPlaying || this.isPaused) return;

        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.accumulatedTime += delta;

        // Standard drop time check
        if (this.accumulatedTime >= this.dropInterval) {
            this.moveDown();
            this.accumulatedTime -= this.dropInterval;
        }

        this.draw();

        this.gameLoopId = requestAnimationFrame(this.gameTick.bind(this));
    }

    // Piece Spawning & Control
    generatePiece() {
        const types = ['I', 'J', 'L', 'O', 'S', 'Z', 'T'];
        const type = types[Math.floor(Math.random() * types.length)];
        return {
            type: type,
            shape: SHAPES[type],
            color: COLORS[type],
            x: 0,
            y: 0
        };
    }

    spawnPiece() {
        this.currentPiece = this.nextPiece;
        
        // Spawn coordinates centering
        this.currentPiece.y = 0;
        this.currentPiece.x = Math.floor((this.cols - this.currentPiece.shape[0].length) / 2);

        this.nextPiece = this.generatePiece();
        this.hasHeldThisTurn = false;

        // Check spawn collisions (Immediately triggers Game Over)
        if (this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.gameOver();
            return;
        }

        // Draw preview blocks
        this.drawPreview(this.ctxNext, this.nextPiece);
        this.drawHoldPreview();
    }

    hold() {
        if (!this.isPlaying || this.isPaused || this.hasHeldThisTurn) return;

        synth.playRotate();

        if (this.holdPiece === null) {
            this.holdPiece = {
                type: this.currentPiece.type,
                shape: SHAPES[this.currentPiece.type],
                color: COLORS[this.currentPiece.type]
            };
            this.spawnPiece();
        } else {
            const temp = {
                type: this.currentPiece.type,
                shape: SHAPES[this.currentPiece.type],
                color: COLORS[this.currentPiece.type]
            };
            this.currentPiece = {
                type: this.holdPiece.type,
                shape: SHAPES[this.holdPiece.type],
                color: COLORS[this.holdPiece.type],
                x: Math.floor((this.cols - SHAPES[this.holdPiece.type][0].length) / 2),
                y: 0
            };
            this.holdPiece = temp;
        }

        this.hasHeldThisTurn = true;
        this.drawHoldPreview();
    }

    checkCollision(shape, xOffset, yOffset) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] !== 0) {
                    const nextX = xOffset + c;
                    const nextY = yOffset + r;

                    // Bounds boundaries check
                    if (nextX < 0 || nextX >= this.cols || nextY >= this.rows) {
                        return true;
                    }

                    // Existing block overlap check
                    if (nextY >= 0 && this.board[nextY][nextX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Controls
    moveLeft() {
        if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x - 1, this.currentPiece.y)) {
            this.currentPiece.x -= 1;
            synth.playTick();
            return true;
        }
        return false;
    }

    moveRight() {
        if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x + 1, this.currentPiece.y)) {
            this.currentPiece.x += 1;
            synth.playTick();
            return true;
        }
        return false;
    }

    moveDown() {
        if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y += 1;
            return true;
        }
        
        // If collision at bottom: Lock piece
        this.lockPiece();
        return false;
    }

    hardDrop() {
        let cellsMoved = 0;
        while (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y += 1;
            cellsMoved++;
        }
        
        synth.playDrop();
        this.lockPiece();
    }

    rotate() {
        const shape = this.currentPiece.shape;
        const n = shape.length;
        
        // Create rotated matrix
        const rotated = Array.from({ length: n }, () => Array(n).fill(0));
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                rotated[c][n - 1 - r] = shape[r][c];
            }
        }

        // Basic wall kick check (check position shifts if rotated piece overlaps walls)
        const kicks = [0, -1, 1, -2, 2];
        for (let i = 0; i < kicks.length; i++) {
            const offset = kicks[i];
            if (!this.checkCollision(rotated, this.currentPiece.x + offset, this.currentPiece.y)) {
                this.currentPiece.shape = rotated;
                this.currentPiece.x += offset;
                synth.playRotate();
                return;
            }
        }
    }

    lockPiece() {
        const shape = this.currentPiece.shape;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] !== 0) {
                    const boardY = this.currentPiece.y + r;
                    const boardX = this.currentPiece.x + c;

                    // If parts of the piece locked outside top board index: Game Over
                    if (boardY < 0) {
                        this.gameOver();
                        return;
                    }
                    this.board[boardY][boardX] = this.currentPiece.color;
                }
            }
        }

        // Check full rows clear
        this.checkLineClears();
        this.spawnPiece();
    }

    checkLineClears() {
        let clearedCount = 0;
        const rowsToClear = [];

        for (let r = 0; r < this.rows; r++) {
            if (this.board[r].every(val => val !== 0)) {
                rowsToClear.push(r);
                clearedCount++;
            }
        }

        if (clearedCount > 0) {
            // Trigger particle blast on lines
            rowsToClear.forEach(r => {
                this.createLineExplosion(r);
            });

            // Splice cleared lines & unshift empty ones
            rowsToClear.forEach(r => {
                this.board.splice(r, 1);
                this.board.unshift(Array(this.cols).fill(0));
            });

            // Standard scoring multiplier
            const pointsTable = [0, 100, 300, 500, 800];
            const earned = pointsTable[Math.min(clearedCount, 4)] * this.level;
            this.score += earned;
            this.lines += clearedCount;

            // Audio cues depending on efficiency
            if (clearedCount >= 4) {
                synth.playSuccess();
                showNotification("MATRIX TETRIS BLAST CLEAR! x4");
            } else {
                synth.playScore();
            }

            // Progression level updates (every 10 lines cleared)
            const oldLevel = this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            if (this.level > oldLevel) {
                this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
                synth.playSuccess();
                showNotification(`LEVEL SYSTEM INCREMENTED: Level ${this.level}`);
            }

            this.updateStatsUI();
        }
    }

    // Visual Explosions for Line Clears
    createLineExplosion(rowY) {
        const cy = rowY * this.blockSize + this.blockSize / 2;
        for (let c = 0; c < this.cols; c++) {
            const cx = c * this.blockSize + this.blockSize / 2;
            const sourceColor = this.board[rowY][c];
            
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const velocity = 2 + Math.random() * 4;
                this.particles.push({
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * velocity,
                    vy: Math.sin(angle) * velocity,
                    radius: 2 + Math.random() * 3,
                    color: sourceColor || 'var(--orange)',
                    alpha: 1,
                    decay: 0.03 + Math.random() * 0.03
                });
            }
        }
    }

    // Ghost Piece Projection
    getGhostY() {
        let ghostY = this.currentPiece.y;
        while (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x, ghostY + 1)) {
            ghostY++;
        }
        return ghostY;
    }

    // Drawing loops
    draw() {
        // Clear main canvas
        this.ctx.fillStyle = '#020108';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Light background grid lines
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)';
        this.ctx.lineWidth = 1;
        for (let r = 0; r <= this.rows; r++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, r * this.blockSize);
            this.ctx.lineTo(this.canvas.width, r * this.blockSize);
            this.ctx.stroke();
        }
        for (let c = 0; c <= this.cols; c++) {
            this.ctx.beginPath();
            this.ctx.moveTo(c * this.blockSize, 0);
            this.ctx.lineTo(c * this.blockSize, this.canvas.height);
            this.ctx.stroke();
        }

        // Draw Board blocks
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c] !== 0) {
                    this.drawBlock(this.ctx, c, r, this.board[r][c]);
                }
            }
        }

        // Draw Current Piece
        if (this.currentPiece) {
            // Draw Ghost Piece projection first
            const ghostY = this.getGhostY();
            const shape = this.currentPiece.shape;

            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c] !== 0) {
                        this.drawGhostBlock(this.ctx, this.currentPiece.x + c, ghostY + r, this.currentPiece.color);
                    }
                }
            }

            // Draw real piece blocks
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c] !== 0) {
                        this.drawBlock(this.ctx, this.currentPiece.x + c, this.currentPiece.y + r, this.currentPiece.color);
                    }
                }
            }
        }

        // Update and Render clear particles
        this.updateAndDrawParticles();
    }

    drawBlock(ctx, x, y, color, customBlockSize = null) {
        const size = customBlockSize || this.blockSize;
        const px = x * size;
        const py = y * size;
        const margin = 2;

        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fillRect(px + margin, py + margin, size - margin * 2, size - margin * 2);

        // Highlight bevel overlay for 3D retro arcade styling
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(px + margin, py + margin, size - margin * 2, 3); // top highlights
        ctx.fillRect(px + margin, py + margin, 3, size - margin * 2); // left highlights
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(px + size - margin - 3, py + margin, 3, size - margin * 2); // right shadow
        ctx.fillRect(px + margin, py + size - margin - 3, size - margin * 2, 3); // bottom shadow
        
        ctx.restore();
    }

    drawGhostBlock(ctx, x, y, color) {
        const margin = 2;
        const px = x * this.blockSize;
        const py = y * this.blockSize;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]); // dashed outline representation
        ctx.strokeRect(px + margin + 1, py + margin + 1, this.blockSize - margin * 2 - 2, this.blockSize - margin * 2 - 2);
        ctx.restore();
    }

    // Previews queues renders
    drawPreview(ctx, piece) {
        ctx.clearRect(0, 0, 80, 80);
        if (!piece) return;

        const shape = piece.shape;
        const n = shape.length;
        
        // Calculate offsets to center piece in 80x80 canvas
        const size = 15; // custom mini block size
        const px = (80 - n * size) / 2;
        const py = (80 - n * size) / 2;

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (shape[r][c] !== 0) {
                    ctx.save();
                    ctx.fillStyle = piece.color;
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = piece.color;
                    ctx.fillRect(px + c * size + 1, py + r * size + 1, size - 2, size - 2);
                    ctx.restore();
                }
            }
        }
    }

    drawHoldPreview() {
        this.drawPreview(this.ctxHold, this.holdPiece);
    }

    updateAndDrawParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            } else {
                this.ctx.save();
                this.ctx.globalAlpha = p.alpha;
                this.ctx.shadowBlur = 6;
                this.ctx.shadowColor = p.color;
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }
        }
    }

    handleKeyDown(e) {
        if (Router.currentScreen !== 'tetris') return;

        const key = e.key.toLowerCase();
        
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
            e.preventDefault();
        }

        if (!this.isPlaying || this.isPaused) {
            if (key === 'p') this.togglePause();
            return;
        }

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.moveLeft();
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.moveRight();
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.moveDown();
                synth.playTick();
                break;
            case 'ArrowUp':
            case 'x':
            case 'X':
                this.rotate();
                break;
            case 'z':
            case 'Z':
                // CCW rotation fallback helper
                this.rotate(); // basic SRS handles right direction mostly
                break;
            case ' ':
                this.hardDrop();
                break;
            case 'c':
            case 'C':
            case 'Shift':
                this.hold();
                break;
            case 'p':
            case 'P':
                this.togglePause();
                break;
        }
    }

    updateStatsUI() {
        this.scoreLabel.innerText = this.score;
        this.highScoreLabel.innerText = ScoreSystem.getHighScore('tetris');
        this.levelLabel.innerText = this.level;
        this.linesLabel.innerText = this.lines;
    }

    updateButtonsUI() {
        if (this.isPaused) {
            this.playText.innerText = "RESUME";
            this.playPauseBtn.querySelector('i').className = 'fa-solid fa-play';
        } else if (this.isPlaying) {
            this.playText.innerText = "PAUSE";
            this.playPauseBtn.querySelector('i').className = 'fa-solid fa-pause';
        } else {
            this.playText.innerText = "START";
            this.playPauseBtn.querySelector('i').className = 'fa-solid fa-play';
        }
    }

    showOverlay(title, subtitle, btnText) {
        this.overlayTitle.innerText = title;
        this.overlayScore.innerText = subtitle;
        this.overlayBtn.innerText = btnText;
        this.overlay.classList.add('active');
    }

    hideOverlay() {
        this.overlay.classList.remove('active');
    }

    initEventListeners() {
        this.overlayBtn.addEventListener('click', () => this.start());
        this.playPauseBtn.addEventListener('click', () => this.togglePause());

        this.resetBtn.addEventListener('click', () => {
            synth.playExplosion();
            this.reset();
            this.isPlaying = false;
            this.stopLoop();
            this.showOverlay("MATRIX TETRIS", "System reset. Click to deploy", "START");
            this.updateButtonsUI();
        });

        // Virtual Touch Pad controls
        document.getElementById('tetrisPadRotate').addEventListener('click', () => {
            if (this.isPlaying && !this.isPaused) this.rotate();
        });
        document.getElementById('tetrisPadLeft').addEventListener('click', () => {
            if (this.isPlaying && !this.isPaused) this.moveLeft();
        });
        document.getElementById('tetrisPadRight').addEventListener('click', () => {
            if (this.isPlaying && !this.isPaused) this.moveRight();
        });
        document.getElementById('tetrisPadSoft').addEventListener('click', () => {
            if (this.isPlaying && !this.isPaused) {
                this.moveDown();
                synth.playTick();
            }
        });
        document.getElementById('tetrisPadHold').addEventListener('click', () => {
            if (this.isPlaying && !this.isPaused) this.hold();
        });
        document.getElementById('tetrisPadHard').addEventListener('click', () => {
            if (this.isPlaying && !this.isPaused) this.hardDrop();
        });
    }
}

// Global initialization hook
window.initTetrisGame = function() {
    if (!window.tetrisGame) {
        window.tetrisGame = new TetrisGame();
    }
    window.tetrisGame.init();
};
