/**
 * RetroPulse Arcade - Core Manager
 * Handles Routing, Sound Synthesis, and High Score persistence.
 */

// Sound Synthesizer using Web Audio API
class AudioSynth {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('arcade_muted') === 'true';
        this.updateSoundIcon();
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('arcade_muted', this.muted);
        this.updateSoundIcon();
        this.playTick();
    }

    updateSoundIcon() {
        const btn = document.getElementById('soundToggleBtn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (this.muted) {
                icon.className = 'fa-solid fa-volume-xmark';
                btn.style.color = 'var(--pink)';
                btn.style.borderColor = 'var(--pink)';
            } else {
                icon.className = 'fa-solid fa-volume-high';
                btn.style.color = '';
                btn.style.borderColor = '';
            }
        }
    }

    // Play a single retro tone
    playTone(frequency, type, duration, endFrequency = null, volume = 0.1) {
        if (this.muted) return;
        this.init();

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
            
            if (endFrequency !== null) {
                osc.frequency.exponentialRampToValueAtTime(endFrequency, this.ctx.currentTime + duration);
            }

            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn("Audio Context error:", e);
        }
    }

    // Sound: Simple high tick for menu navigation or movement
    playTick() {
        this.playTone(600, 'sine', 0.05, null, 0.05);
    }

    // Sound: Positive upward sound for eating / minor scores
    playScore() {
        this.playTone(300, 'triangle', 0.15, 900, 0.15);
    }

    // Sound: Double bleep for rotation / movement success
    playRotate() {
        this.playTone(450, 'sine', 0.08, 600, 0.05);
    }

    // Sound: Deep drop chord
    playDrop() {
        this.playTone(150, 'sawtooth', 0.1, 80, 0.12);
    }

    // Sound: Multi-chord sweep for level-ups or multi-clears
    playSuccess() {
        const now = this.ctx ? this.ctx.currentTime : 0;
        this.playTone(440, 'triangle', 0.2, 880, 0.15);
        setTimeout(() => {
            this.playTone(554.37, 'triangle', 0.2, 1108.73, 0.15);
        }, 80);
        setTimeout(() => {
            this.playTone(659.25, 'triangle', 0.3, 1318.51, 0.15);
        }, 160);
    }

    // Sound: Deep blast for game-over or grid wall hit (noisy feel)
    playExplosion() {
        if (this.muted) return;
        this.init();
        
        try {
            // Noise buffer generator for explosions
            const bufferSize = this.ctx.sampleRate * 0.35; // 0.35s
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = buffer;

            // Lowpass filter to make it sound muffled/bass-heavy
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.3);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

            noiseNode.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noiseNode.start();
        } catch (e) {
            // Fallback to simple low ramp if noise buffer fails
            this.playTone(180, 'sawtooth', 0.3, 40, 0.2);
        }
    }

    // Sound: Melancholic game over tune
    playGameOver() {
        this.playTone(400, 'sawtooth', 0.2, 200, 0.15);
        setTimeout(() => {
            this.playTone(300, 'sawtooth', 0.2, 150, 0.15);
        }, 200);
        setTimeout(() => {
            this.playTone(200, 'sawtooth', 0.4, 50, 0.2);
        }, 400);
    }
}

// Instantiate Sound System Globally
const synth = new AudioSynth();

// High Score Persistence & Leaderboard System
const ScoreSystem = {
    // Retrieve leaderboards from localStorage
    getScores() {
        let scores = localStorage.getItem('retropulse_scores');
        if (!scores) {
            scores = {
                snake: [
                    { date: '2026-07-10', score: 350, extra: 'Level 4' },
                    { date: '2026-07-08', score: 200, extra: 'Level 2' },
                    { date: '2026-07-05', score: 100, extra: 'Level 1' }
                ],
                tetris: [
                    { date: '2026-07-12', score: 2400, extra: '12 Lines' },
                    { date: '2026-07-09', score: 1200, extra: '6 Lines' },
                    { date: '2026-07-06', score: 500, extra: '3 Lines' }
                ]
            };
            localStorage.setItem('retropulse_scores', JSON.stringify(scores));
        } else {
            scores = JSON.parse(scores);
        }
        return scores;
    },

    // Get absolute high score for a specific game
    getHighScore(gameKey) {
        const list = this.getScores()[gameKey] || [];
        if (list.length === 0) return 0;
        return Math.max(...list.map(s => s.score));
    },

    // Get best extra stat (level for snake, lines for tetris)
    getBestExtra(gameKey) {
        const list = this.getScores()[gameKey] || [];
        if (list.length === 0) return gameKey === 'snake' ? 1 : 0;
        
        const values = list.map(item => {
            const num = parseInt(item.extra.replace(/\D/g, ''));
            return isNaN(num) ? 0 : num;
        });
        return Math.max(...values, gameKey === 'snake' ? 1 : 0);
    },

    // Register a new score
    saveScore(gameKey, score, extraString) {
        const data = this.getScores();
        const newEntry = {
            date: new Date().toISOString().split('T')[0],
            score: score,
            extra: extraString
        };

        if (!data[gameKey]) data[gameKey] = [];
        
        data[gameKey].push(newEntry);
        // Sort descending
        data[gameKey].sort((a, b) => b.score - a.score);
        // Limit to top 5
        data[gameKey] = data[gameKey].slice(0, 5);

        localStorage.setItem('retropulse_scores', JSON.stringify(data));
        
        // Update main dashboard stats
        updateDashboardStats();
    },

    // Reset scores
    clearScores() {
        localStorage.removeItem('retropulse_scores');
        updateDashboardStats();
    }
};

// Application Router & Screen Transitions
const Router = {
    currentScreen: 'home',

    navigateTo(screenId) {
        // Init audio context on first screen switch
        synth.init();
        synth.playTick();

        // Remove active class from all screens
        document.querySelectorAll('.screen').forEach(scr => {
            scr.classList.remove('active');
        });

        // Add active class to target screen
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            
            // Adjust body tag classes for game specific themes
            document.body.className = '';
            if (screenId === 'screenSnake') {
                document.body.classList.add('snake-theme');
            } else if (screenId === 'screenTetris') {
                document.body.classList.add('tetris-theme');
            }

            this.currentScreen = screenId.replace('screen', '').toLowerCase();

            // Show/Hide top Home Nav button
            const homeBtn = document.getElementById('navHomeBtn');
            if (homeBtn) {
                homeBtn.style.display = this.currentScreen === 'home' ? 'none' : 'flex';
            }
        }
    }
};

// UI Notification System
function showNotification(message) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<i class="fa-solid fa-bell-ring" style="color: var(--cyan); margin-right: 0.5rem;"></i> ${message}`;

    container.appendChild(notification);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        notification.addEventListener('animationend', () => {
            notification.remove();
        });
    }, 3000);
}

// Update dashboard display stats
function updateDashboardStats() {
    // Snake
    document.getElementById('cardSnakeHighScore').innerText = ScoreSystem.getHighScore('snake');
    document.getElementById('cardSnakeBestLevel').innerText = ScoreSystem.getBestExtra('snake');
    
    // Tetris
    document.getElementById('cardTetrisHighScore').innerText = ScoreSystem.getHighScore('tetris');
    document.getElementById('cardTetrisBestLines').innerText = ScoreSystem.getBestExtra('tetris') + ' Lines';
}

// Populates leaderboard table on request
let activeLeaderboardTab = 'snake';

function renderLeaderboard() {
    const scores = ScoreSystem.getScores()[activeLeaderboardTab] || [];
    const tableBody = document.getElementById('leaderboardBody');
    const headerMetric = document.getElementById('leaderboardMetricHeader');
    
    headerMetric.innerText = activeLeaderboardTab === 'snake' ? 'Level' : 'Lines';
    tableBody.innerHTML = '';

    if (scores.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <i class="fa-solid fa-folder-open"></i>
                        <p>No records found. Play a game to set high scores!</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    scores.forEach((item, index) => {
        let badgeClass = 'rank-badge rank-other';
        if (index === 0) badgeClass = 'rank-badge rank-1';
        else if (index === 1) badgeClass = 'rank-badge rank-2';
        else if (index === 2) badgeClass = 'rank-badge rank-3';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="${badgeClass}">${index + 1}</span></td>
            <td>${item.date}</td>
            <td style="text-align: center;">${item.extra}</td>
            <td style="text-align: right;" class="leaderboard-score">${item.score}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Dashboard Stats
    updateDashboardStats();

    // Nav Bar triggers
    document.getElementById('headerLogo').addEventListener('click', () => {
        stopAllGames();
        Router.navigateTo('screenHome');
    });

    document.getElementById('navHomeBtn').addEventListener('click', () => {
        stopAllGames();
        Router.navigateTo('screenHome');
    });

    document.getElementById('navLeaderboardBtn').addEventListener('click', () => {
        stopAllGames();
        renderLeaderboard();
        Router.navigateTo('screenLeaderboard');
    });

    document.getElementById('soundToggleBtn').addEventListener('click', () => {
        synth.toggleMute();
    });

    // Dashboard Play buttons
    document.getElementById('cardSnake').querySelector('.play-btn').addEventListener('click', () => {
        Router.navigateTo('screenSnake');
        // Let snake.js handle actual canvas init
        if (window.initSnakeGame) window.initSnakeGame();
    });

    document.getElementById('cardTetris').querySelector('.play-btn').addEventListener('click', () => {
        Router.navigateTo('screenTetris');
        // Let tetris.js handle canvas init
        if (window.initTetrisGame) window.initTetrisGame();
    });

    // Leaderboard Tabs
    document.getElementById('tabSnakeLeaderboard').addEventListener('click', (e) => {
        document.getElementById('tabTetrisLeaderboard').classList.remove('active');
        e.target.classList.add('active');
        activeLeaderboardTab = 'snake';
        synth.playTick();
        renderLeaderboard();
    });

    document.getElementById('tabTetrisLeaderboard').addEventListener('click', (e) => {
        document.getElementById('tabSnakeLeaderboard').classList.remove('active');
        e.target.classList.add('active');
        activeLeaderboardTab = 'tetris';
        synth.playTick();
        renderLeaderboard();
    });

    // Clear Scores
    document.getElementById('clearLeaderboardBtn').addEventListener('click', () => {
        if (confirm("Are you sure you want to wipe out all local high scores?")) {
            ScoreSystem.clearScores();
            synth.playExplosion();
            renderLeaderboard();
            showNotification("High scores formatted successfully!");
        }
    });

    // Back to Home
    document.getElementById('backToHomeBtn').addEventListener('click', () => {
        Router.navigateTo('screenHome');
    });

    // Listen globally for Esc back to Home
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            stopAllGames();
            Router.navigateTo('screenHome');
        }
    });
});

// Helper to shut down running loops when swapping screens
function stopAllGames() {
    if (window.snakeGame && typeof window.snakeGame.destroy === 'function') {
        window.snakeGame.destroy();
    }
    if (window.tetrisGame && typeof window.tetrisGame.destroy === 'function') {
        window.tetrisGame.destroy();
    }
}
