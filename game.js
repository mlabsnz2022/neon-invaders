/**
 * Neon Invaders - Game Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const CANVAS_WIDTH = 650;
const CANVAS_HEIGHT = 800;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const BOMB_SPEED = 4;

// Set canvas dimensions
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Colors
const COLORS = {
    player: '#00ffff',
    enemy: '#ff00ff',
    bullet: '#ffffff',
    bomb: '#ff3333',
    ui: '#9d00ff',
    levels: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
};

// --- AUDIO SYSTEM ---
const AudioEngine = {
    ctx: null,
    sirenOsc: null,
    sirenGain: null,
    noiseBuffer: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.createNoiseBuffer();
        }
    },

    createNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    },

    playShoot() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },

    playBomb() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    },

    playHitBlip() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    },

    playEnemyExplosion() {
        if (!this.ctx || !this.noiseBuffer) return;
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        source.buffer = this.noiseBuffer;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
        source.stop(this.ctx.currentTime + 0.3);
    },

    playPlayerExplosion() {
        if (!this.ctx || !this.noiseBuffer) return;
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        source.buffer = this.noiseBuffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 1.0);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
        source.stop(this.ctx.currentTime + 1.0);
    },

    startSaucerSiren() {
        if (!this.ctx || this.sirenOsc) return;
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();

        this.sirenOsc.type = 'sine';
        // Frequency sweep siren effect
        const now = this.ctx.currentTime;
        this.sirenOsc.frequency.setValueAtTime(440, now);

        // Loop a frequency wobble
        for (let i = 0; i < 100; i++) {
            this.sirenOsc.frequency.linearRampToValueAtTime(880, now + i * 0.4 + 0.2);
            this.sirenOsc.frequency.linearRampToValueAtTime(440, now + i * 0.4 + 0.4);
        }

        this.sirenGain.gain.setValueAtTime(0, now);
        this.sirenGain.gain.linearRampToValueAtTime(0.05, now + 0.1);

        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);
        this.sirenOsc.start();
    },

    stopSaucerSiren() {
        if (!this.sirenOsc) return;
        const now = this.ctx.currentTime;
        this.sirenGain.gain.cancelScheduledValues(now);
        this.sirenGain.gain.setValueAtTime(this.sirenGain.gain.value, now);
        this.sirenGain.gain.linearRampToValueAtTime(0, now + 0.1);
        this.sirenOsc.stop(now + 0.1);
        this.sirenOsc = null;
        this.sirenGain = null;
    },

    playLevelStart() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Rising synth swell
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.2);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    },

    playLevelComplete() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // TADA chord (C Major: C, E, G, C)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth'; // bright sound
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.05, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.8);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.8);
        });
    },

    playGameOver() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Sad minor descending arpeggio (A Minor: E4, C4, A3)
        const notes = [329.63, 261.63, 220.00];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle'; // Mellow sound
            osc.frequency.setValueAtTime(freq, now + i * 0.4);

            gain.gain.setValueAtTime(0, now + i * 0.4);
            gain.gain.linearRampToValueAtTime(0.1, now + i * 0.4 + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 1.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.4);
            osc.stop(now + i * 0.4 + 1.2);
        });
    },

    playSaucerVictory() {
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const now = this.ctx.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.05, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.1);
        });
    },

    playExplosion() {
        // Legacy fallback
        this.playEnemyExplosion();
    }
};

const MUSIC_TRACKS = [
    'music/Static_In_The Summer_Mall.mp3',
    'music/Static_In_The Summer_Mall2.mp3',
    'music/Vertigo_of_the_Neon_Unknown_1.mp3',
    'music/Vertigo_of_the_Neon_Unknown_2.mp3'
];

const MusicEngine = {
    currentAudio: null,
    currentIndex: -1,
    introIndex: -1,

    playRandomTrack(excludeIndex = -1) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
        } while (nextIndex === excludeIndex || (MUSIC_TRACKS.length > 1 && nextIndex === this.currentIndex));

        this.currentIndex = nextIndex;
        this.currentAudio = new Audio(MUSIC_TRACKS[this.currentIndex]);
        this.currentAudio.volume = 0.4;

        // When track ends, play another random one (excluding the one that just finished)
        this.currentAudio.addEventListener('ended', () => {
            this.playRandomTrack(this.currentIndex);
        });

        this.currentAudio.play().catch(e => console.log("Audio play failed (autoplay policy?):", e));
    },

    playIntro() {
        this.playRandomTrack();
        this.introIndex = this.currentIndex;
    },

    playGame() {
        // Start game music, ensuring we don't pick the intro track
        this.playRandomTrack(this.introIndex);
    },

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }
};

// Input handling
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    AudioEngine.init();
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
    }
    if (e.code === 'Space' && !e.repeat && !isGameOver && !isPausedForLevel && !isInMenu) {
        if (player.canManualFire) {
            player.shoot(true);
            player.canManualFire = false;
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
    if (e.code === 'Space') {
        // Debounce manual reset to filter out OS auto-repeat KeyUp/KeyDown pairs (common on Linux)
        setTimeout(() => {
            if (!keys.Space) {
                player.canManualFire = true;
            }
        }, 50);
    }
});

// Particle class for explosions
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.speedX *= 0.98;
        this.speedY *= 0.98;
    }
}

// Bullet class (Player)
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.bullet;
        ctx.fillStyle = COLORS.bullet;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.restore();
    }

    update() {
        this.y -= BULLET_SPEED;
    }
}

// Bomb class (Enemy)
class Bomb {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = 6;
        this.height = 12;
        this.color = color || COLORS.bomb;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        // Zigzag bomb shape
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + 4, this.y + 4);
        ctx.lineTo(this.x - 4, this.y + 8);
        ctx.lineTo(this.x, this.y + 12);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    update() {
        this.y += (this.currentSpeed || BOMB_SPEED) * timeScale;
    }
}

// Enemy class
class Enemy {
    constructor(x, y, color, health) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 30;
        this.color = color || COLORS.enemy;
        this.health = health || 1;
        this.flashTimer = 0;
        this.scale = 1.0;
    }

    draw() {
        ctx.save();

        // Apply hit feedback (scale and flash)
        const currentScale = this.scale;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-centerX, -centerY);

        const drawColor = this.flashTimer > 0 ? '#ffffff' : this.color;

        ctx.shadowBlur = this.flashTimer > 0 ? 30 : 15;
        ctx.shadowColor = drawColor;
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(this.x + 5, this.y);
        ctx.lineTo(this.x + 15, this.y + 10);
        ctx.lineTo(this.x + 25, this.y + 10);
        ctx.lineTo(this.x + 35, this.y);
        ctx.lineTo(this.x + 40, this.y + 20);
        ctx.lineTo(this.x + 30, this.y + 30);
        ctx.lineTo(this.x + 10, this.y + 30);
        ctx.lineTo(this.x, this.y + 20);
        ctx.closePath();

        ctx.stroke();
        ctx.fillStyle = drawColor + '22';
        ctx.fill();
        ctx.restore();

        // Decay feedback
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.scale > 1.0) this.scale -= 0.05;
        if (this.scale < 1.0) this.scale = 1.0;
    }

    update(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}

// Saucer class (Mystery Ship)
class Saucer {
    constructor(direction) {
        this.width = 50;
        this.height = 20;
        this.color = '#00ffff';
        this.direction = direction; // 1 for left-to-right, -1 for right-to-left
        this.speed = 1.35;
        this.x = direction === 1 ? -this.width : CANVAS_WIDTH;
        this.y = 50; // Positioned above the main enemy grid
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        // Saucer body (ellipse)
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Cockpit dome
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 4, Math.PI, 0);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fill();
        ctx.restore();
    }

    update() {
        if (!this.active) return;
        this.x += this.speed * this.direction * timeScale;

        if ((this.direction === 1 && this.x > CANVAS_WIDTH) ||
            (this.direction === -1 && this.x < -this.width)) {
            this.active = false;
        }
    }
}

class Player {
    constructor() {
        this.width = 40;
        this.height = 30;
        this.reset();
    }

    reset() {
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CANVAS_HEIGHT - 60;
        this.color = COLORS.player;
        this.canShoot = true;
        this.shootDelay = 300;
        this.shootTimer = null;
        this.canManualFire = true;
        this.isExploding = false;
        timeScale = 1.0;
    }

    explode() {
        this.isExploding = true;
        timeScale = 0.1; // Slow down the world
        AudioEngine.playPlayerExplosion();
        createExplosion(this.x + this.width / 2, this.y + this.height / 2, this.color, 40);
    }

    draw() {
        if (this.isExploding) return;

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x + this.width * 0.8, this.y + this.height * 0.8);
        ctx.lineTo(this.x + this.width * 0.2, this.y + this.height * 0.8);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();

        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();
        ctx.restore();
    }

    update() {
        if (this.isExploding || isPausedForLevel) return;
        if (keys.ArrowLeft && this.x > 0) this.x -= PLAYER_SPEED * timeScale;
        if (keys.ArrowRight && this.x < CANVAS_WIDTH - this.width) this.x += PLAYER_SPEED * timeScale;
        if (keys.Space && this.canShoot) this.shoot();
    }

    shoot(force = false) {
        if (!this.canShoot && !force) return;

        bullets.push(new Bullet(this.x + this.width / 2, this.y));
        AudioEngine.playShoot();
        this.canShoot = false;
        // clear any existing timeout if we forced a shot, to reset the rhythm
        if (this.shootTimer) clearTimeout(this.shootTimer);
        this.shootTimer = setTimeout(() => this.canShoot = true, this.shootDelay / timeScale);
    }
}

// UI Elements
const scoreElement = document.getElementById('score-val');
const livesElement = document.getElementById('lives-val');
const gameOverOverlay = document.getElementById('game-over-overlay');
const introOverlay = document.getElementById('intro-overlay');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');

// Game State
let timeScale = 1.0;
let isGameOver = false;
let score = 0;
let lives = 3;
let currentLevel = 1;
let levelText = "";
let levelTextTimer = 0;
let colorCycleIdx = 0;
let isPausedForLevel = false;
let isInMenu = true;

let enemyDirection = 1;
let enemyMoveTimer = 0;
let enemyMoveSpeed = 1;
let levelBaseSpeed = 1;

let player = new Player();
let bullets = [];
let bombs = [];
let enemies = [];
let particles = [];
let saucer = null;
let saucerTimer = (15 + Math.random() * 15) * 60; // 15-30 seconds at 60fps

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function spawnEnemies() {
    enemies = [];
    const rows = 4;
    const cols = 8;
    const spacing = 45;
    const offsetX = (CANVAS_WIDTH - (cols * spacing)) / 2;
    const offsetY = 100; // Moved lower to make room for saucer

    // Row configuration from top to bottom
    const rowConfig = [
        { color: '#ff0000', health: 5 },
        { color: '#ffff00', health: 4 },
        { color: '#00ff00', health: 3 },
        { color: '#0000ff', health: 2 }
    ];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            enemies.push(new Enemy(
                offsetX + c * spacing,
                offsetY + r * spacing,
                rowConfig[r].color,
                rowConfig[r].health
            ));
        }
    }
}

function startLevel(level) {
    currentLevel = level;
    isPausedForLevel = true;
    levelText = `LEVEL ${level}`;
    levelTextTimer = 180; // 3 seconds at 60fps
    AudioEngine.playLevelStart();

    // Scale difficulty
    // Level 10 is original speed (enemyMoveSpeed = 1, bombSpeed multiplier = 1)
    // Level 1 starts at 20% speed
    const difficultyMultiplier = 0.2 + (0.8 * (level - 1) / 9);
    levelBaseSpeed = 1 * difficultyMultiplier;
    enemyMoveSpeed = levelBaseSpeed;

    bullets = [];
    bombs = [];
    spawnEnemies();

    setTimeout(() => {
        isPausedForLevel = false;
    }, 3000);
}

function showIntro() {
    isInMenu = true;
    introOverlay.style.display = 'block'; // Ensure visible using direct style if needed, or class
    introOverlay.classList.remove('hidden');
    gameOverOverlay.classList.remove('visible');
    gameOverOverlay.classList.add('hidden');

    // Clear game state visuals behind menu
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    enemies = [];
    bullets = [];
    bombs = [];
    particles = [];
    if (saucer) {
        saucer.active = false;
        saucer = null;
    }
    AudioEngine.stopSaucerSiren();
    MusicEngine.playIntro();
}

function resetGame() {
    isInMenu = false;
    score = 0;
    lives = 3;
    isGameOver = false;
    currentLevel = 1;
    timeScale = 1.0;

    introOverlay.style.display = 'none'; // Force hide
    introOverlay.classList.add('hidden');
    gameOverOverlay.classList.remove('visible');
    gameOverOverlay.classList.add('hidden');

    player.reset();
    bullets = [];
    bombs = [];
    particles = [];
    saucer = null;
    saucerTimer = (15 + Math.random() * 15) * 60;

    AudioEngine.stopSaucerSiren();
    AudioEngine.init();
    if (AudioEngine.ctx && AudioEngine.ctx.state === 'suspended') {
        AudioEngine.ctx.resume();
    }
    MusicEngine.playGame();

    scoreElement.textContent = "0000";
    livesElement.textContent = "3";

    startLevel(1);
}

startBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('click', showIntro); // Return to main menu

function updateScore(points) {
    score += points;
    scoreElement.textContent = score.toString().padStart(4, '0');
}

function triggerGameOver() {
    isGameOver = true;
    AudioEngine.stopSaucerSiren();
    if (saucer) {
        saucer.active = false;
        saucer = null;
    }
    AudioEngine.playGameOver();
    MusicEngine.stop();
    finalScoreElement.textContent = score.toString().padStart(4, '0');
    gameOverOverlay.classList.remove('hidden');
    gameOverOverlay.classList.add('visible');
}

function checkCollisions() {
    // Player bullets vs Objects
    for (let i = bullets.length - 1; i >= 0; i--) {
        const blt = bullets[i];

        // vs Enemies
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (blt.x > e.x && blt.x < e.x + e.width && blt.y > e.y && blt.y < e.y + e.height) {
                bullets.splice(i, 1);
                hit = true;
                e.health--;
                if (e.health <= 0) {
                    AudioEngine.playEnemyExplosion();
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, e.color, 20);
                    enemies.splice(j, 1);
                    updateScore(100);
                    const enemiesDestroyed = 40 - enemies.length;
                    enemyMoveSpeed = levelBaseSpeed * (1 + (enemiesDestroyed / 40) * 3);
                } else {
                    AudioEngine.playHitBlip();
                    e.flashTimer = 5;
                    e.scale = 1.2;
                }
                break;
            }
        }

        if (hit) continue;

        // vs Enemy Bombs
        for (let j = bombs.length - 1; j >= 0; j--) {
            const bmb = bombs[j];
            // Treat bombs as a small box for easier hitting
            if (blt.x > bmb.x - 10 && blt.x < bmb.x + 10 &&
                blt.y > bmb.y - 10 && blt.y < bmb.y + 10) {

                bullets.splice(i, 1);
                bombs.splice(j, 1);
                AudioEngine.playEnemyExplosion();
                createExplosion(bmb.x, bmb.y, bmb.color, 8);
                updateScore(10);
                break;
            }
        }

        // vs Saucer
        if (saucer && saucer.active &&
            blt.x > saucer.x && blt.x < saucer.x + saucer.width &&
            blt.y > saucer.y && blt.y < saucer.y + saucer.height) {

            bullets.splice(i, 1);
            AudioEngine.playSaucerVictory();
            AudioEngine.stopSaucerSiren();
            createExplosion(saucer.x + saucer.width / 2, saucer.y + saucer.height / 2, saucer.color, 30);
            updateScore(500); // High score for the saucer
            saucer.active = false;
            saucerTimer = (15 + Math.random() * 15) * 60; // Reset spawn timer
        }
    }

    // Enemy bombs vs Player
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        if (!player.isExploding &&
            b.x > player.x && b.x < player.x + player.width &&
            b.y > player.y && b.y < player.y + player.height) {

            bombs.splice(i, 1);
            player.explode();
            lives--;
            livesElement.textContent = Math.max(0, lives);

            if (lives <= 0) {
                AudioEngine.stopSaucerSiren();
                if (saucer) saucer.active = false;
                setTimeout(() => triggerGameOver(), 1500);
            } else {
                // 2 second real-time delay before reset
                setTimeout(() => {
                    player.reset();
                }, 2000);
            }
        }
    }

    // Enemies vs Player / Bottom
    for (let e of enemies) {
        if (!player.isExploding && e.y + e.height >= player.y) {
            player.explode();
            AudioEngine.stopSaucerSiren();
            if (saucer) saucer.active = false;
            setTimeout(() => triggerGameOver(), 1000);
            break;
        }
    }

    // Win check (all enemies dead)
    if (enemies.length === 0 && !isGameOver && !isPausedForLevel) {
        if (currentLevel < 10) {
            isPausedForLevel = true;
            levelText = "LEVEL CLEARED!";
            levelTextTimer = 120;
            AudioEngine.playLevelComplete();
            setTimeout(() => {
                startLevel(currentLevel + 1);
            }, 1500);
        } else {
            isGameOver = true;
            levelText = "YOU HAVE OBLITERATED THE ALIENS";
            levelTextTimer = 999999;
        }
    }
}

function updateEnemies() {
    if (isPausedForLevel) return;

    let shouldChangeDirection = false;
    let dy = 0;

    for (let e of enemies) {
        if ((enemyDirection === 1 && e.x + e.width >= CANVAS_WIDTH - 10) ||
            (enemyDirection === -1 && e.x <= 10)) {
            shouldChangeDirection = true;
            break;
        }
    }

    if (shouldChangeDirection) {
        enemyDirection *= -1;
        dy = 20;
    }

    const currentEnemyDX = enemyDirection * enemyMoveSpeed * timeScale;
    const currentEnemyDY = dy * timeScale;

    const difficultyMultiplier = 0.2 + (0.8 * (currentLevel - 1) / 9);
    const currentBombSpeed = BOMB_SPEED * difficultyMultiplier * timeScale;

    for (let e of enemies) {
        e.update(currentEnemyDX, currentEnemyDY);

        // Random shooting - rate and speed affected by level
        if (Math.random() < 0.001 * enemyMoveSpeed * timeScale) {
            const b = new Bomb(e.x + e.width / 2, e.y + e.height, e.color);
            b.currentSpeed = currentBombSpeed;
            bombs.push(b);
        }
    }
}

function gameLoop() {
    if (isInMenu) {
        requestAnimationFrame(gameLoop);
        return;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (!isGameOver) {
        player.update();
        updateEnemies();
        checkCollisions();
    }

    // Update & draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!isGameOver) bullets[i].update();
        if (bullets[i].y < -20) bullets.splice(i, 1);
        else bullets[i].draw();
    }

    // Update & draw bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
        if (!isGameOver) bombs[i].update();
        if (bombs[i].y > CANVAS_HEIGHT + 20) bombs.splice(i, 1);
        else bombs[i].draw();
    }

    player.draw();
    enemies.forEach(e => e.draw());

    // Update & draw Saucer
    if (saucer && saucer.active) {
        if (!isGameOver) saucer.update();
        saucer.draw();
        if (!saucer.active) {
            AudioEngine.stopSaucerSiren();
            saucer = null;
        }
    } else if (!isPausedForLevel && !isGameOver) {
        saucerTimer--;
        if (saucerTimer <= 0) {
            const direction = Math.random() > 0.5 ? 1 : -1;
            saucer = new Saucer(direction);
            AudioEngine.startSaucerSiren();
            saucerTimer = (15 + Math.random() * 15) * 60;
        }
    }

    // Update & draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // UI Overlays (Level/Victory text)
    if (levelTextTimer > 0) {
        levelTextTimer--;
        colorCycleIdx++;
        const color = COLORS.levels[colorCycleIdx % COLORS.levels.length];

        ctx.save();
        ctx.font = "bold 40px Orbitron";
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fillText(levelText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}

// Start with intro
showIntro();
requestAnimationFrame(gameLoop);
