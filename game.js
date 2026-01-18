/**
 * Neon Invaders - Game Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
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

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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

        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    },

    playExplosion() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
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
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
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

class Player {
    constructor() {
        this.width = 40;
        this.height = 30;
        this.particles = [];
        this.reset();
    }

    reset() {
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CANVAS_HEIGHT - 60;
        this.color = COLORS.player;
        this.canShoot = true;
        this.shootDelay = 300;
        this.isExploding = false;
        this.particles = [];
        timeScale = 1.0;
    }

    explode() {
        this.isExploding = true;
        timeScale = 0.1; // Slow down the world
        AudioEngine.playExplosion();
        // Generate particles
        for (let i = 0; i < 30; i++) {
            this.particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height / 2,
                this.color
            ));
        }
    }

    draw() {
        // Draw explosion particles if any
        this.particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.life <= 0) this.particles.splice(index, 1);
        });

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

    shoot() {
        bullets.push(new Bullet(this.x + this.width / 2, this.y));
        AudioEngine.playShoot();
        this.canShoot = false;
        setTimeout(() => this.canShoot = true, this.shootDelay / timeScale);
    }
}

// UI Elements
const scoreElement = document.getElementById('score-val');
const livesElement = document.getElementById('lives-val');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

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

let enemyDirection = 1;
let enemyMoveTimer = 0;
let enemyMoveSpeed = 1;
let levelBaseSpeed = 1;

let player = new Player();
let bullets = [];
let bombs = [];
let enemies = [];

function spawnEnemies() {
    enemies = [];
    const rows = 4;
    const cols = 10;
    const spacing = 60;
    const offsetX = (CANVAS_WIDTH - (cols * spacing)) / 2;
    const offsetY = 50;

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

function resetGame() {
    score = 0;
    lives = 3;
    isGameOver = false;
    currentLevel = 1;
    player.reset();
    scoreElement.textContent = "0000";
    livesElement.textContent = "3";
    gameOverOverlay.classList.add('hidden');
    gameOverOverlay.classList.remove('visible');
    startLevel(1);
    requestAnimationFrame(gameLoop);
}

restartBtn.addEventListener('click', resetGame);

function updateScore(points) {
    score += points;
    scoreElement.textContent = score.toString().padStart(4, '0');
}

function triggerGameOver() {
    isGameOver = true;
    finalScoreElement.textContent = score.toString().padStart(4, '0');
    gameOverOverlay.classList.remove('hidden');
    gameOverOverlay.classList.add('visible');
}

function checkCollisions() {
    // Player bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) {
                bullets.splice(i, 1);

                e.health--;
                if (e.health <= 0) {
                    AudioEngine.playExplosion();
                    enemies.splice(j, 1);
                    updateScore(100);

                    // Increase speed as enemies are destroyed
                    const enemiesDestroyed = 40 - enemies.length;
                    enemyMoveSpeed = levelBaseSpeed * (1 + (enemiesDestroyed / 40) * 3);
                } else {
                    // Hit feedback
                    e.flashTimer = 5;
                    e.scale = 1.2;
                }
                break;
            }
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
            AudioEngine.playBomb();
        }
    }
}

function gameLoop() {
    if (isGameOver) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    player.update();
    updateEnemies();
    checkCollisions();

    // Update & draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].y < -20) bullets.splice(i, 1);
        else bullets[i].draw();
    }

    // Update & draw bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
        bombs[i].update();
        if (bombs[i].y > CANVAS_HEIGHT + 20) bombs.splice(i, 1);
        else bombs[i].draw();
    }

    player.draw();
    enemies.forEach(e => e.draw());

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

// Start game
resetGame();
