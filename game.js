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

    playHitBlip(pitchMultiplier = 1.0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const baseFreq = 880 * pitchMultiplier;
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
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
        this.currentAudio.volume = 0.28; // Reduced by 30% from 0.4

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
    if (e.code === 'Space' && !e.repeat && isInMenu) {
        resetGame();
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

// Star class for background
class Star {
    constructor() {
        this.reset(true);
    }

    reset(randomY = false) {
        this.x = Math.random() * CANVAS_WIDTH;
        this.y = randomY ? Math.random() * CANVAS_HEIGHT : -10;
        this.size = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 0.5 + 0.1; // Slow scrolling

        // Dimmer array of neon colors
        const colors = [
            'rgba(255, 0, 255, 0.4)', // Dim Magenta
            'rgba(0, 255, 255, 0.4)', // Dim Cyan
            'rgba(255, 255, 0, 0.4)', // Dim Yellow
            'rgba(100, 100, 255, 0.4)', // Dim Blue
            'rgba(255, 255, 255, 0.3)'  // Dim White
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];

        this.twinkle = Math.random() > 0.7; // 30% chance to twinkle
        this.twinkleSpeed = Math.random() * 0.05 + 0.01;
        this.alpha = Math.random() * 0.5 + 0.3;
        this.alphaDir = 1;
    }

    update() {
        this.y += this.speed * timeScale;
        if (this.y > CANVAS_HEIGHT) {
            this.reset();
        }

        if (this.twinkle) {
            this.alpha += this.twinkleSpeed * this.alphaDir;
            if (this.alpha >= 0.8 || this.alpha <= 0.2) {
                this.alphaDir *= -1;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;

        // Simple circle or glow
        if (this.size > 1.5) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = this.color;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
    constructor(x, y, color, health, type = 0) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 30;
        this.color = color || COLORS.enemy;
        this.health = health || 1;
        this.maxHealth = health || 1;
        this.flashTimer = 0;
        this.scale = 1.0;
        this.brightness = 1.0; // Increases with each hit
        this.type = type; // 0=squid, 1=crab, 2=octopus, 3=jellyfish
        this.animFrame = 0; // Animation frame (0 or 1)

        // Dive attack properties
        this.isDiving = false;
        this.divePhase = 0; // 0=dive down, 1=loop back, 2=return to formation
        this.diveSpeed = 0;
        this.diveAngle = 0;
        this.formationX = x; // Remember formation position
        this.formationY = y;
        this.divePathPoints = [];
        this.divePathIndex = 0;
    }

    drawSquid(centerX, centerY, drawColor) {
        // Top row - squid shape with tentacles
        const frame = this.animFrame;
        ctx.beginPath();
        // Head
        ctx.moveTo(this.x + 10, this.y + 5);
        ctx.lineTo(this.x + 30, this.y + 5);
        ctx.lineTo(this.x + 35, this.y + 15);
        ctx.lineTo(this.x + 5, this.y + 15);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = drawColor + '22';
        ctx.fill();

        // Tentacles (animated)
        const tentacleOffset = frame ? 2 : -2;
        ctx.beginPath();
        ctx.moveTo(this.x + 8, this.y + 15);
        ctx.lineTo(this.x + 5 + tentacleOffset, this.y + 25);
        ctx.moveTo(this.x + 16, this.y + 15);
        ctx.lineTo(this.x + 15 + tentacleOffset, this.y + 28);
        ctx.moveTo(this.x + 24, this.y + 15);
        ctx.lineTo(this.x + 25 - tentacleOffset, this.y + 28);
        ctx.moveTo(this.x + 32, this.y + 15);
        ctx.lineTo(this.x + 35 - tentacleOffset, this.y + 25);
        ctx.stroke();
    }

    drawCrab(centerX, centerY, drawColor) {
        // Second row - crab shape with claws
        const frame = this.animFrame;
        ctx.beginPath();
        // Body
        ctx.moveTo(this.x + 8, this.y + 10);
        ctx.lineTo(this.x + 32, this.y + 10);
        ctx.lineTo(this.x + 35, this.y + 20);
        ctx.lineTo(this.x + 5, this.y + 20);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = drawColor + '22';
        ctx.fill();

        // Claws (animated)
        const clawSpread = frame ? 8 : 4;
        ctx.beginPath();
        // Left claw
        ctx.moveTo(this.x + 5, this.y + 15);
        ctx.lineTo(this.x - clawSpread, this.y + 8);
        ctx.lineTo(this.x - clawSpread, this.y + 5);
        // Right claw
        ctx.moveTo(this.x + 35, this.y + 15);
        ctx.lineTo(this.x + 40 + clawSpread, this.y + 8);
        ctx.lineTo(this.x + 40 + clawSpread, this.y + 5);
        ctx.stroke();
    }

    drawOctopus(centerX, centerY, drawColor) {
        // Third row - octopus shape
        const frame = this.animFrame;
        ctx.beginPath();
        // Round head
        ctx.arc(centerX, this.y + 12, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = drawColor + '22';
        ctx.fill();

        // Arms (animated wave)
        const waveOffset = frame ? 3 : -3;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const armX = this.x + 10 + i * 7;
            ctx.moveTo(armX, this.y + 20);
            ctx.lineTo(armX + waveOffset, this.y + 28);
        }
        ctx.stroke();
    }

    drawJellyfish(centerX, centerY, drawColor) {
        // Fourth row - jellyfish shape
        const frame = this.animFrame;
        const pulseSize = frame ? 2 : 0;

        ctx.beginPath();
        // Bell (pulsing)
        ctx.moveTo(this.x + 20, this.y + 5 - pulseSize);
        ctx.quadraticCurveTo(this.x + 35, this.y + 10, this.x + 30, this.y + 18);
        ctx.lineTo(this.x + 10, this.y + 18);
        ctx.quadraticCurveTo(this.x + 5, this.y + 10, this.x + 20, this.y + 5 - pulseSize);
        ctx.stroke();
        ctx.fillStyle = drawColor + '22';
        ctx.fill();

        // Trailing tentacles (animated)
        const trailOffset = frame ? 4 : 0;
        ctx.beginPath();
        ctx.moveTo(this.x + 12, this.y + 18);
        ctx.lineTo(this.x + 10, this.y + 26 + trailOffset);
        ctx.moveTo(this.x + 20, this.y + 18);
        ctx.lineTo(this.x + 20, this.y + 28 + trailOffset);
        ctx.moveTo(this.x + 28, this.y + 18);
        ctx.lineTo(this.x + 30, this.y + 26 + trailOffset);
        ctx.stroke();
    }

    draw() {
        ctx.save();

        // Apply hit feedback (scale and flash)
        const currentScale = this.scale;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // Apply rotation if diving
        if (this.isDiving && this.diveAngle !== 0) {
            ctx.translate(centerX, centerY);
            ctx.rotate(this.diveAngle + Math.PI / 2); // +90deg to align with movement
            ctx.scale(currentScale, currentScale);
            ctx.translate(-centerX, -centerY);
        } else {
            ctx.translate(centerX, centerY);
            ctx.scale(currentScale, currentScale);
            ctx.translate(-centerX, -centerY);
        }

        const drawColor = this.flashTimer > 0 ? '#ffffff' : this.color;

        // Apply brightness filter
        ctx.filter = `brightness(${this.brightness})`;

        ctx.shadowBlur = this.flashTimer > 0 ? 30 : 15;
        ctx.shadowColor = drawColor;
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 2;

        // Draw based on enemy type
        switch (this.type) {
            case 0:
                this.drawSquid(centerX, centerY, drawColor);
                break;
            case 1:
                this.drawCrab(centerX, centerY, drawColor);
                break;
            case 2:
                this.drawOctopus(centerX, centerY, drawColor);
                break;
            case 3:
                this.drawJellyfish(centerX, centerY, drawColor);
                break;
        }

        // Draw health number in center
        if (this.health > 0) {
            ctx.filter = 'none'; // Reset filter for text
            ctx.font = 'bold 16px Orbitron';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 3;
            ctx.shadowColor = '#ffffff';
            ctx.fillText(this.health.toString(), centerX, centerY);
        }

        ctx.restore();

        // Decay feedback
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.scale > 1.0) this.scale -= 0.05;
        if (this.scale < 1.0) this.scale = 1.0;
    }

    update(dx, dy) {
        if (this.isDiving) {
            this.updateDive();
        } else {
            this.x += dx;
            this.y += dy;
            // Update formation position when moving normally
            this.formationX += dx;
            this.formationY += dy;
        }
    }

    startDive(playerX) {
        this.isDiving = true;
        this.divePhase = 0;
        this.diveSpeed = 1.5; // Slower speed

        // Create a diving path all the way to bottom
        this.divePathPoints = [];
        const startX = this.x;
        const startY = this.y;
        const bottomY = CANVAS_HEIGHT + 50; // Go past bottom

        // Create a sinusoidal diving path toward player
        const targetX = playerX + (Math.random() - 0.5) * 100;
        const pathLength = bottomY - startY;
        const steps = Math.floor(pathLength / 3); // Slower with more points

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Smooth curve toward target with sine wave
            const x = startX + (targetX - startX) * t + Math.sin(t * Math.PI * 4) * 30;
            const y = startY + pathLength * t;
            this.divePathPoints.push({ x, y });
        }

        this.divePathIndex = 0;
    }

    updateDive() {
        if (this.divePathIndex >= this.divePathPoints.length) {
            // Reached bottom - reposition at top
            this.repositionAtTop();
            return;
        }

        // Follow the path
        const target = this.divePathPoints[this.divePathIndex];
        const prevX = this.x;
        const prevY = this.y;

        this.x = target.x;
        this.y = target.y;

        // Calculate rotation angle based on movement direction
        const dx = this.x - prevX;
        const dy = this.y - prevY;
        this.diveAngle = Math.atan2(dy, dx);

        this.divePathIndex++;
    }

    repositionAtTop() {
        // Find all enemies in formation (not diving)
        const formationEnemies = enemies.filter(e => !e.isDiving && e !== this);

        if (formationEnemies.length === 0) {
            // No formation, just place at top center
            this.x = CANVAS_WIDTH / 2;
            this.y = 100;
            this.formationX = this.x;
            this.formationY = this.y;
            this.isDiving = false;
            this.diveAngle = 0;
            return;
        }

        // Find the top row
        const minY = Math.min(...formationEnemies.map(e => e.formationY));
        const topRowEnemies = formationEnemies.filter(e => Math.abs(e.formationY - minY) < 10);

        // Check for gaps in top row (spacing should be ~45 pixels)
        const spacing = 45;
        const topRowXPositions = topRowEnemies.map(e => e.formationX).sort((a, b) => a - b);

        let foundGap = false;
        let gapX = 0;

        // Check for gaps between enemies
        for (let i = 0; i < topRowXPositions.length - 1; i++) {
            const gap = topRowXPositions[i + 1] - topRowXPositions[i];
            if (gap > spacing * 1.5) {
                // Found a gap
                gapX = topRowXPositions[i] + spacing;
                foundGap = true;
                break;
            }
        }

        if (!foundGap) {
            // No gap in top row, create new row above
            // Find leftmost and rightmost positions to determine row bounds
            const allXPositions = formationEnemies.map(e => e.formationX).sort((a, b) => a - b);
            const leftmost = allXPositions[0];
            const rightmost = allXPositions[allXPositions.length - 1];
            const rowWidth = rightmost - leftmost;

            // Place randomly in new row above
            const newY = minY - spacing;
            const randomOffset = Math.random() * rowWidth;
            gapX = leftmost + randomOffset;

            this.x = gapX;
            this.y = newY;
            this.formationX = gapX;
            this.formationY = newY;
        } else {
            // Place in gap
            this.x = gapX;
            this.y = minY;
            this.formationX = gapX;
            this.formationY = minY;
        }

        this.isDiving = false;
        this.diveAngle = 0;
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
        this.spinFrame = 0; // 0-7 for 8-frame spin cycle
        this.spinTimer = 0;
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // Calculate width scale based on spin frame (creates perspective)
        // Frame 0,4 = edge-on (narrow), Frame 2,6 = face-on (wide)
        const spinPhase = this.spinFrame / 8 * Math.PI * 2;
        const widthScale = Math.abs(Math.cos(spinPhase)) * 0.7 + 0.3; // Range: 0.3 to 1.0
        const currentWidth = this.width * widthScale;

        // Saucer body (ellipse with perspective)
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, currentWidth / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Cockpit dome (only visible when not edge-on)
        if (widthScale > 0.5) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentWidth / 4, Math.PI, 0);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.fill();
        }

        // Add detail lines for spinning effect
        if (widthScale > 0.6) {
            ctx.beginPath();
            // Horizontal detail lines
            ctx.moveTo(centerX - currentWidth / 3, centerY - 3);
            ctx.lineTo(centerX + currentWidth / 3, centerY - 3);
            ctx.moveTo(centerX - currentWidth / 3, centerY + 3);
            ctx.lineTo(centerX + currentWidth / 3, centerY + 3);
            ctx.stroke();
        }

        ctx.restore();
    }

    update() {
        if (!this.active) return;
        this.x += this.speed * this.direction * timeScale;

        if ((this.direction === 1 && this.x > CANVAS_WIDTH) ||
            (this.direction === -1 && this.x < -this.width)) {
            this.active = false;
        }

        // Update spin animation (faster spin = more dramatic)
        this.spinTimer++;
        if (this.spinTimer >= 4) { // Spin every 4 frames
            this.spinTimer = 0;
            this.spinFrame = (this.spinFrame + 1) % 8;
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

        // Rate limit manual fire to prevent macro spam (10Hz cap)
        if (force) {
            const now = Date.now();
            if (this.lastManualShot && now - this.lastManualShot < 100) return;
            this.lastManualShot = now;
        }

        bullets.push(new Bullet(this.x + this.width / 2, this.y));
        AudioEngine.playShoot();
        this.canShoot = false;
        // clear any existing timeout if we forced a shot, to reset the rhythm
        if (this.shootTimer) clearTimeout(this.shootTimer);
        this.shootTimer = setTimeout(() => this.canShoot = true, this.shootDelay / timeScale);
    }
}

// Floating Score Text class
class FloatingText {
    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.life = 60; // 1 second at 60fps
        this.dy = -1.0; // Float up
        this.colors = ['#ff0000', '#ff00ff', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff8000'];
    }

    update() {
        this.y += this.dy * timeScale;
        this.life -= 1 * timeScale;
    }

    draw() {
        if (this.life <= 0) return;
        ctx.save();
        ctx.font = "bold 20px Orbitron";
        // Rapid color cycle
        const colorIndex = Math.floor(Date.now() / 50) % this.colors.length;
        ctx.fillStyle = this.colors[colorIndex];
        ctx.shadowBlur = 5;
        ctx.shadowColor = ctx.fillStyle;
        ctx.globalAlpha = Math.min(1.0, this.life / 20); // Fade out at end
        ctx.textAlign = "center";

        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
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
const highScoreListElement = document.getElementById('high-score-list');
const nameInputContainer = document.getElementById('name-input-container');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');

// Game State
let timeScale = 1.0;
let isGameOver = false;
let score = 0;
let lives = 3;
let currentLevel = 1;
let highScores = JSON.parse(localStorage.getItem('neonInvadersHighScores')) || [
    { name: 'STARLORD', score: 50000 },
    { name: 'RIPLEY', score: 40000 },
    { name: 'SKYWALKER', score: 30000 },
    { name: 'PICARD', score: 20000 },
    { name: 'KIRK', score: 15000 },
    { name: 'SOLO', score: 10000 },
    { name: 'TRON', score: 8000 },
    { name: 'NEO', score: 6000 },
    { name: 'FLYNN', score: 4000 },
    { name: 'QUORRA', score: 2000 }
];
let levelText = "";
let levelTextTimer = 0;
let colorCycleIdx = 0;
let isPausedForLevel = false;
let isInMenu = true;

let enemyDirection = 1;
let enemyMoveTimer = 0;
let enemyMoveSpeed = 1;
let levelBaseSpeed = 1;
let enemyAnimTimer = 0; // Animation timer for marching effect

let player = new Player();
let bullets = [];
let bombs = [];
let enemies = [];
let particles = [];
let stars = [];
let floatingTexts = [];
let saucer = null;
let saucerTimer = (15 + Math.random() * 15) * 60; // 15-30 seconds at 60fps

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push(new Star());
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
                rowConfig[r].health,
                r // Pass row index as enemy type
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
    introOverlay.style.display = 'flex'; // Ensure visible using direct style if needed, or class
    introOverlay.classList.remove('hidden');
    gameOverOverlay.classList.remove('visible');
    gameOverOverlay.classList.add('hidden');

    renderHighScores();

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
    floatingTexts = [];
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

    // Check for high score
    const qualifies = highScores.length < 10 || score > highScores[highScores.length - 1].score;

    if (qualifies) {
        nameInputContainer.classList.remove('hidden');
        restartBtn.classList.add('hidden');
        playerNameInput.value = '';
        playerNameInput.focus();
    } else {
        nameInputContainer.classList.add('hidden');
        restartBtn.classList.remove('hidden');
    }

    gameOverOverlay.classList.remove('hidden');
    gameOverOverlay.classList.add('visible');
}

function renderHighScores() {
    highScoreListElement.innerHTML = '';
    highScores.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'high-score-entry';
        // Cycling color class logic is in CSS on parent or we can add specific classes
        // The prompt asked for "rapidly color cycling font". The title has it.
        // Let's add it to the score text or rows.
        // Currently .high-score-title has the animation.
        // Let's make the list items also cycle or just be static?
        // Prompt: "displays the top 10 high scores ... in large, rapidly color cycling font".
        // It implies the list itself.
        // Apply logic to elements.

        li.innerHTML = `<span class="high-score-rank">${index + 1}. ${entry.name}</span> <span class="high-score-val">${entry.score.toString().padStart(4, '0')}</span>`;
        // Add animation delay for wave effect?
        li.style.animation = `colorCycle 2s infinite ${index * 0.1}s`;
        // We need to define keyframes in CSS for 'li' or inherit. 
        // I added .high-score-title animation.
        // Let's reuse that or assume styles.css handles it.
        // I'll add inline style for now to ensure it works as requested.
        highScoreListElement.appendChild(li);
    });
}

function submitHighScore() {
    const name = playerNameInput.value.trim().toUpperCase() || 'ANONYMOUS';

    const newEntry = { name: name, score: score };
    highScores.push(newEntry);
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 10) highScores.length = 10;

    localStorage.setItem('neonInvadersHighScores', JSON.stringify(highScores));

    showIntro();
}

submitScoreBtn.addEventListener('click', submitHighScore);

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
                    const killScore = 100;
                    updateScore(killScore);
                    floatingTexts.push(new FloatingText(e.x + e.width / 2, e.y, "+" + killScore));
                    const enemiesDestroyed = 40 - enemies.length;
                    enemyMoveSpeed = levelBaseSpeed * (1 + (enemiesDestroyed / 40) * 3);
                } else {
                    // Calculate pitch based on damage taken
                    const damageRatio = (e.maxHealth - e.health) / e.maxHealth;
                    const pitchMultiplier = 1.0 + (damageRatio * 0.5); // Rises up to 1.5x
                    AudioEngine.playHitBlip(pitchMultiplier);

                    e.flashTimer = 5;
                    e.scale = 1.2;

                    // Increase brightness with each hit
                    e.brightness = Math.min(2.0, 1.0 + (damageRatio * 1.0)); // Up to 2x brightness
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
            const saucerScore = 500;
            updateScore(saucerScore); // High score for the saucer
            floatingTexts.push(new FloatingText(saucer.x + saucer.width / 2, saucer.y, "+" + saucerScore));
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

    // Enemies vs Player / Bottom (including diving enemies)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // Check collision with player (both formation and diving enemies)
        if (!player.isExploding) {
            const collision = e.x < player.x + player.width &&
                e.x + e.width > player.x &&
                e.y < player.y + player.height &&
                e.y + e.height > player.y;

            if (collision) {
                // Diving enemy kamikaze - destroy enemy and damage player
                if (e.isDiving) {
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, e.color, 30);
                    AudioEngine.playEnemyExplosion();
                    enemies.splice(i, 1);

                    // Player loses a life (same as bomb hit)
                    player.explode();
                    lives--;
                    livesElement.textContent = Math.max(0, lives);

                    if (lives <= 0) {
                        AudioEngine.stopSaucerSiren();
                        if (saucer) saucer.active = false;
                        setTimeout(() => triggerGameOver(), 1500);
                    } else {
                        // 2 second delay before reset
                        setTimeout(() => {
                            player.reset();
                        }, 2000);
                    }
                    break;
                }

                // Formation enemies reaching player (instant game over)
                player.explode();
                AudioEngine.stopSaucerSiren();
                if (saucer) saucer.active = false;
                setTimeout(() => triggerGameOver(), 1000);
                break;
            }

            // Formation enemies reaching bottom
            if (!e.isDiving && e.y + e.height >= player.y) {
                player.explode();
                AudioEngine.stopSaucerSiren();
                if (saucer) saucer.active = false;
                setTimeout(() => triggerGameOver(), 1000);
                break;
            }
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

    // Dive attack logic
    const maxDivers = Math.min(currentLevel, 5); // Max 5 divers at once
    const currentDivers = enemies.filter(e => e.isDiving).length;

    if (currentDivers < maxDivers && Math.random() < 0.002 * currentLevel) {
        // Find eligible enemies (no enemy below them)
        const eligibleEnemies = enemies.filter(e => {
            if (e.isDiving) return false;

            // Check if any enemy is below this one
            const hasEnemyBelow = enemies.some(other => {
                return !other.isDiving &&
                    other !== e &&
                    Math.abs(other.x - e.x) < 30 && // Same column
                    other.y > e.y; // Below
            });

            return !hasEnemyBelow;
        });

        if (eligibleEnemies.length > 0) {
            const diver = eligibleEnemies[Math.floor(Math.random() * eligibleEnemies.length)];
            diver.startDive(player.x + player.width / 2);
        }
    }

    // Toggle animation frame every 30 frames for marching effect
    enemyAnimTimer++;
    if (enemyAnimTimer >= 30) {
        enemyAnimTimer = 0;
        for (let e of enemies) {
            e.animFrame = e.animFrame ? 0 : 1;
        }
    }
}

function gameLoop() {
    if (isInMenu) {
        requestAnimationFrame(gameLoop);
        return;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Update & draw Stars (Background)
    stars.forEach(star => {
        star.update();
        star.draw();
    });

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

    // Update & draw Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update();
        floatingTexts[i].draw();
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
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
initStars();
showIntro();
requestAnimationFrame(gameLoop);
