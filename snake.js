/**
 * RetroPulse Arcade - Snake Game
 */

class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('snakeCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.gridSize = 20; // 20x20 cells
        this.cellSize = this.canvas.width / this.gridSize; // 20px per cell

        // State variables
        this.snake = [];
        this.direction = 'right';
        this.nextDirection = 'right';
        this.food = { x: 0, y: 0 };
        this.score = 0;
        this.level = 1;
        this.speed = 130; // ms per update step
        
        this.isPlaying = false;
        this.isPaused = false;
        this.wrapMode = false; // wrap-around vs walls kill
        
        this.gameLoopId = null;
        this.lastTime = 0;
        this.accumulatedTime = 0;

        // Particle System
        this.particles = [];

        // Elements
        this.overlay = document.getElementById('snakeOverlay');
        this.overlayTitle = document.getElementById('snakeOverlayTitle');
        this.overlayScore = document.getElementById('snakeOverlayScore');
        this.overlayBtn = document.getElementById('snakeOverlayBtn');
        this.playPauseBtn = document.getElementById('snakePlayPauseBtn');
        this.resetBtn = document.getElementById('snakeResetBtn');
        this.playText = document.getElementById('snakePlayText');

        // Mode elements
        this.modeClassicBtn = document.getElementById('snakeModeClassic');
        this.modeWrapBtn = document.getElementById('snakeModeWrap');

        // Stats elements
        this.scoreLabel = document.getElementById('snakeScore');
        this.highScoreLabel = document.getElementById('snakeHighScore');
        this.levelLabel = document.getElementById('snakeLevel');

        // Keyboard handler reference
        this.handleKeyDownBound = this.handleKeyDown.bind(this);
        
        // Setup initial bindings
        this.initEventListeners();
    }

    init() {
        this.reset();
        this.updateStatsUI();
        
        // Show start overlay
        this.showOverlay("NEON SNAKE", "Click to start grid cycle", "START");
        
        // Key listener hooks
        window.addEventListener('keydown', this.handleKeyDownBound);
    }

    destroy() {
        this.stopLoop();
        window.removeEventListener('keydown', this.handleKeyDownBound);
        this.isPlaying = false;
        this.isPaused = false;
    }

    reset() {
        this.snake = [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 }
        ];
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.level = 1;
        this.speed = 130;
        this.isPaused = false;
        this.particles = [];
        this.spawnFood();
        this.updateStatsUI();
    }

    spawnFood() {
        let attempts = 0;
        while (attempts < 100) {
            const rx = Math.floor(Math.random() * this.gridSize);
            const ry = Math.floor(Math.random() * this.gridSize);
            
            // Check if food is spawning inside snake body
            const onSnake = this.snake.some(segment => segment.x === rx && segment.y === ry);
            if (!onSnake) {
                this.food = { x: rx, y: ry };
                return;
            }
            attempts++;
        }
        // Fallback
        this.food = { x: 10, y: 10 };
    }

    start() {
        if (!this.isPlaying) {
            this.reset();
            this.isPlaying = true;
            this.isPaused = false;
        } else if (this.isPaused) {
            this.isPaused = false;
        }

        this.hideOverlay();
        this.updateButtonsUI();

        // Start game tick loop
        this.stopLoop();
        this.lastTime = performance.now();
        this.accumulatedTime = 0;
        this.gameLoopId = requestAnimationFrame(this.gameTick.bind(this));

        synth.playSuccess();
        showNotification("Snake core grid activated!");
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
        ScoreSystem.saveScore('snake', this.score, `Level ${this.level}`);
        this.updateStatsUI();
        
        this.showOverlay("GRID FAULT", `Terminal Score: ${this.score}`, "PLAY AGAIN");
        showNotification("Snake connection lost.");
    }

    stopLoop() {
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    // High fidelity game tick with accurate delta time
    gameTick(timestamp) {
        if (!this.isPlaying || this.isPaused) return;

        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.accumulatedTime += delta;

        // Process physics frame if threshold met
        if (this.accumulatedTime >= this.speed) {
            this.updatePhysics();
            this.accumulatedTime -= this.speed;
        }

        // Draw every frame for smooth animations/particles
        this.draw();

        this.gameLoopId = requestAnimationFrame(this.gameTick.bind(this));
    }

    updatePhysics() {
        this.direction = this.nextDirection;
        
        // Head coordinate calculation
        const head = { ...this.snake[0] };
        
        switch (this.direction) {
            case 'up': head.y -= 1; break;
            case 'down': head.y += 1; break;
            case 'left': head.x -= 1; break;
            case 'right': head.x += 1; break;
        }

        // Collision Check: Walls
        if (this.wrapMode) {
            // Wrap Around Logic
            if (head.x < 0) head.x = this.gridSize - 1;
            if (head.x >= this.gridSize) head.x = 0;
            if (head.y < 0) head.y = this.gridSize - 1;
            if (head.y >= this.gridSize) head.y = 0;
        } else {
            // Hard Walls Collision
            if (head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize) {
                synth.playExplosion();
                this.gameOver();
                return;
            }
        }

        // Collision Check: Snake Body Self-collision
        // Note: Head cannot crash with tail end if it's not growing, but let's test all body segments
        for (let i = 0; i < this.snake.length; i++) {
            if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
                synth.playExplosion();
                this.gameOver();
                return;
            }
        }

        // Move Snake
        this.snake.unshift(head);

        // Food ingestion check
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            synth.playScore();
            this.createFoodEatenParticles(this.food.x, this.food.y);
            this.spawnFood();

            // Check level speed progression (every 50 points increases speed level)
            const oldLevel = this.level;
            this.level = Math.floor(this.score / 50) + 1;
            if (this.level > oldLevel) {
                this.speed = Math.max(50, 130 - (this.level - 1) * 10);
                synth.playSuccess();
                showNotification(`GRID ACCELERATED! Level ${this.level}`);
            }

            this.updateStatsUI();
        } else {
            // Remove tail segment if food not eaten
            this.snake.pop();
        }
    }

    createFoodEatenParticles(gridX, gridY) {
        const cx = gridX * this.cellSize + this.cellSize / 2;
        const cy = gridY * this.cellSize + this.cellSize / 2;
        
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = 1 + Math.random() * 4;
            this.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                radius: 2 + Math.random() * 3,
                color: Math.random() > 0.5 ? 'var(--green)' : 'var(--cyan)',
                alpha: 1,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        // Clear Canvas
        this.ctx.fillStyle = '#020108';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid structure lines lightly (cyber aesthetics)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridSize; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.cellSize, 0);
            this.ctx.lineTo(i * this.cellSize, this.canvas.height);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.cellSize);
            this.ctx.lineTo(this.canvas.width, i * this.cellSize);
            this.ctx.stroke();
        }

        // Draw food (glowing core)
        const pulse = Math.sin(performance.now() / 150) * 2;
        const fSize = this.cellSize / 2.5 + pulse;
        const fx = this.food.x * this.cellSize + this.cellSize / 2;
        const fy = this.food.y * this.cellSize + this.cellSize / 2;

        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
        this.ctx.fillStyle = 'var(--cyan)';
        
        // Inner circle
        this.ctx.beginPath();
        this.ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Outer glow accent ring
        this.ctx.strokeStyle = 'var(--pink)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(fx, fy, fSize + 4, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0; // reset shadow for body blocks

        // Draw Snake
        this.snake.forEach((segment, idx) => {
            const x = segment.x * this.cellSize;
            const y = segment.y * this.cellSize;
            const margin = 2;

            if (idx === 0) {
                // Head
                this.ctx.fillStyle = 'var(--green)';
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = 'var(--green)';
                this.ctx.fillRect(x + margin, y + margin, this.cellSize - margin * 2, this.cellSize - margin * 2);
                
                // Eyes helper
                this.ctx.fillStyle = '#020108';
                this.ctx.shadowBlur = 0;
                const eyeSize = 3;
                if (this.direction === 'right' || this.direction === 'left') {
                    const ex = this.direction === 'right' ? x + this.cellSize - 6 : x + 4;
                    this.ctx.fillRect(ex, y + 5, eyeSize, eyeSize);
                    this.ctx.fillRect(ex, y + this.cellSize - 8, eyeSize, eyeSize);
                } else {
                    const ey = this.direction === 'down' ? y + this.cellSize - 6 : y + 4;
                    this.ctx.fillRect(x + 5, ey, eyeSize, eyeSize);
                    this.ctx.fillRect(x + this.cellSize - 8, ey, eyeSize, eyeSize);
                }
            } else {
                // Body Segment Gradient Transition
                const brightness = Math.max(0.4, 1 - (idx / this.snake.length) * 0.6);
                this.ctx.fillStyle = `rgba(57, 255, 20, ${brightness})`;
                
                // Rounded rectangular segments
                const drawSize = this.cellSize - margin * 2;
                this.ctx.fillRect(x + margin, y + margin, drawSize, drawSize);
            }
        });

        // Draw and Update Particles
        this.updateParticles();
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    handleKeyDown(e) {
        if (Router.currentScreen !== 'snake') return;

        const key = e.key.toLowerCase();
        
        // Prevent default scrolling for game controls
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
            e.preventDefault();
        }

        // Direction keys map
        if ((key === 'arrowup' || key === 'w') && this.direction !== 'down') {
            this.nextDirection = 'up';
        }
        else if ((key === 'arrowdown' || key === 's') && this.direction !== 'up') {
            this.nextDirection = 'down';
        }
        else if ((key === 'arrowleft' || key === 'a') && this.direction !== 'right') {
            this.nextDirection = 'left';
        }
        else if ((key === 'arrowright' || key === 'd') && this.direction !== 'left') {
            this.nextDirection = 'right';
        }
        else if (key === 'p') {
            this.togglePause();
        }
    }

    setMode(mode) {
        if (this.isPlaying) {
            this.reset();
            this.isPlaying = false;
            this.stopLoop();
        }
        
        if (mode === 'classic') {
            this.wrapMode = false;
            this.modeClassicBtn.classList.add('active');
            this.modeWrapBtn.classList.remove('active');
        } else {
            this.wrapMode = true;
            this.modeClassicBtn.classList.remove('active');
            this.modeWrapBtn.classList.add('active');
        }
        this.showOverlay("NEON SNAKE", "Mode changed. Click to start", "START");
        this.updateButtonsUI();
        synth.playTick();
    }

    updateStatsUI() {
        this.scoreLabel.innerText = this.score;
        this.highScoreLabel.innerText = ScoreSystem.getHighScore('snake');
        this.levelLabel.innerText = this.level;
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
        // Screen action triggers
        this.overlayBtn.addEventListener('click', () => this.start());
        this.playPauseBtn.addEventListener('click', () => this.togglePause());
        
        this.resetBtn.addEventListener('click', () => {
            synth.playExplosion();
            this.reset();
            this.isPlaying = false;
            this.stopLoop();
            this.showOverlay("NEON SNAKE", "System reset. Click to loop", "START");
            this.updateButtonsUI();
        });

        // Mode toggles
        this.modeClassicBtn.addEventListener('click', () => this.setMode('classic'));
        this.modeWrapBtn.addEventListener('click', () => this.setMode('wrap'));

        // Virtual Pad controls
        document.getElementById('snakePadUp').addEventListener('click', () => {
            if (this.direction !== 'down') this.nextDirection = 'up';
            synth.playTick();
        });
        document.getElementById('snakePadDown').addEventListener('click', () => {
            if (this.direction !== 'up') this.nextDirection = 'down';
            synth.playTick();
        });
        document.getElementById('snakePadLeft').addEventListener('click', () => {
            if (this.direction !== 'right') this.nextDirection = 'left';
            synth.playTick();
        });
        document.getElementById('snakePadRight').addEventListener('click', () => {
            if (this.direction !== 'left') this.nextDirection = 'right';
            synth.playTick();
        });
        document.getElementById('snakePadCenter').addEventListener('click', () => {
            this.togglePause();
        });
    }
}

// Global initialization hook
window.initSnakeGame = function() {
    if (!window.snakeGame) {
        window.snakeGame = new SnakeGame();
    }
    window.snakeGame.init();
};
