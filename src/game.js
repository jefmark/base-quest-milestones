export const STAGE_CONFIG = [
  { milestone: 1, name: 'Rookie Runner', score: 1200, minPlaySeconds: 20, speed: 5.4 },
  { milestone: 2, name: 'Chain Jumper', score: 5000, minPlaySeconds: 45, speed: 6.2 },
  { milestone: 3, name: 'Base Sprinter', score: 10000, minPlaySeconds: 70, speed: 7.0 },
  { milestone: 4, name: 'Gasless Ghost', score: 18000, minPlaySeconds: 95, speed: 7.9 },
  { milestone: 5, name: 'Block Master', score: 30000, minPlaySeconds: 125, speed: 8.9 },
  { milestone: 6, name: 'Onchain Legend', score: 45000, minPlaySeconds: 160, speed: 10.0 },
];

export const PENALTY_CONFIG = [
  { label: '0-20s', until: 20, penalty: 100 },
  { label: '20-45s', until: 45, penalty: 250 },
  { label: '45-70s', until: 70, penalty: 500 },
  { label: '70-95s', until: 95, penalty: 850 },
  { label: '95-125s', until: 125, penalty: 1300 },
  { label: '125-160s', until: 160, penalty: 2000 },
  { label: '160s+', until: Number.POSITIVE_INFINITY, penalty: 3000 },
];

export const FINAL_REPEAT_SECONDS = 10;

const safeRandom = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));


// Soft procedural audio. No audio files needed; sounds are generated safely in the browser.
let audioCtx = null;
let soundEnabled = localStorage.getItem('baseQuestSound') !== 'off';

function getAudioCtx() {
  if (!soundEnabled) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function setSoundEnabled(value) {
  soundEnabled = Boolean(value);
  localStorage.setItem('baseQuestSound', soundEnabled ? 'on' : 'off');
  if (!soundEnabled && audioCtx) audioCtx.suspend().catch(() => {});
  if (soundEnabled) getAudioCtx();
}

function isSoundEnabled() {
  return soundEnabled;
}

function softTone({ frequency = 440, endFrequency = null, delay = 0, duration = 0.18, type = 'sine', volume = 0.035 }) {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, start);
  filter.Q.setValueAtTime(0.4, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.04);
}

function playSound(kind, stage = null) {
  if (!soundEnabled) return;

  if (kind === 'jump') {
    // Gentle upward motion sound.
    softTone({ frequency: 230, endFrequency: 360, duration: 0.16, type: 'sine', volume: 0.032 });
    softTone({ frequency: 520, delay: 0.035, duration: 0.11, type: 'triangle', volume: 0.018 });
    return;
  }

  if (kind === 'orb') {
    // Soft green-shield pickup chime.
    softTone({ frequency: 520, duration: 0.12, type: 'sine', volume: 0.028 });
    softTone({ frequency: 700, delay: 0.08, duration: 0.14, type: 'sine', volume: 0.026 });
    softTone({ frequency: 930, delay: 0.16, duration: 0.18, type: 'triangle', volume: 0.018 });
    return;
  }

  if (kind === 'protectedHit') {
    // Soft shield impact: muted thud + small shimmer, not harsh.
    softTone({ frequency: 150, endFrequency: 92, duration: 0.20, type: 'triangle', volume: 0.045 });
    softTone({ frequency: 420, delay: 0.04, duration: 0.14, type: 'sine', volume: 0.018 });
    softTone({ frequency: 610, delay: 0.11, duration: 0.16, type: 'sine', volume: 0.014 });
    return;
  }

  if (kind === 'gameOver') {
    // Different gentle end sound by current stage.
    const milestone = Number(stage?.milestone || 1);
    const root = [174, 196, 220, 247, 277, 311][Math.max(0, Math.min(5, milestone - 1))];
    softTone({ frequency: root * 1.4, endFrequency: root, duration: 0.22, type: 'sine', volume: 0.035 });
    softTone({ frequency: root, endFrequency: root * 0.74, delay: 0.18, duration: 0.24, type: 'triangle', volume: 0.032 });
    softTone({ frequency: root * 0.56, delay: 0.42, duration: 0.30, type: 'sine', volume: 0.022 });
  }
}

export function getPenaltyForSeconds(seconds) {
  return PENALTY_CONFIG.find((row) => seconds < row.until) || PENALTY_CONFIG[PENALTY_CONFIG.length - 1];
}

export function createGame(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d');
  const state = {
    running: false,
    paused: false,
    startedAt: 0,
    endedAt: 0,
    lastTime: 0,
    score: 0,
    best: Number(localStorage.getItem('baseQuestBest') || 0),
    stageIndex: 0,
    milestoneUnlocked: 0,
    distance: 0,
    shake: 0,
    lastPenalty: 0,
    player: { x: 90, y: 0, w: 34, h: 42, vy: 0, grounded: false, shield: 0 },
    obstacles: [],
    orbs: [],
    particles: [],
    damageTexts: [],
    keys: new Set(),
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function groundY() {
    return canvas.getBoundingClientRect().height - 72;
  }

  function reset() {
    state.running = true;
    state.paused = false;
    state.startedAt = performance.now();
    state.endedAt = 0;
    state.lastTime = performance.now();
    state.score = 0;
    state.stageIndex = 0;
    state.milestoneUnlocked = 0;
    state.distance = 0;
    state.shake = 0;
    state.lastPenalty = 0;
    state.player = { x: 90, y: groundY() - 42, w: 34, h: 42, vy: 0, grounded: true, shield: 0 };
    state.obstacles = [];
    state.orbs = [];
    state.particles = [];
    state.damageTexts = [];
    callbacks.onUpdate?.(snapshot());
  }

  function getPlaySeconds() {
    if (!state.startedAt) return 0;
    const endTime = !state.running && state.endedAt ? state.endedAt : performance.now();
    return Math.max(0, Math.floor((endTime - state.startedAt) / 1000));
  }

  function getHighestScoreMilestone() {
    let unlocked = null;
    for (const m of STAGE_CONFIG) {
      if (state.score >= m.score) unlocked = m;
    }
    return unlocked;
  }

  function getMintableMilestone() {
    const seconds = getPlaySeconds();
    let mintable = null;
    for (const m of STAGE_CONFIG) {
      if (state.score >= m.score && seconds >= m.minPlaySeconds) mintable = m;
    }
    return mintable;
  }

  function getNextRequirement() {
    const seconds = getPlaySeconds();
    for (const m of STAGE_CONFIG) {
      if (state.score < m.score || seconds < m.minPlaySeconds) {
        return {
          ...m,
          remainingScore: Math.max(0, Math.ceil(m.score - state.score)),
          remainingSeconds: Math.max(0, m.minPlaySeconds - seconds),
        };
      }
    }
    return null;
  }

  function snapshot() {
    const playSeconds = getPlaySeconds();
    const scoreUnlocked = getHighestScoreMilestone();
    const mintable = getMintableMilestone();
    const penaltyWindow = getPenaltyForSeconds(playSeconds);

    return {
      score: Math.floor(state.score),
      best: Math.floor(state.best),
      milestoneUnlocked: scoreUnlocked?.milestone || 0,
      scoreUnlockedMilestone: scoreUnlocked,
      mintableMilestone: mintable,
      nextRequirement: getNextRequirement(),
      stage: STAGE_CONFIG[state.stageIndex],
      playSeconds,
      currentPenalty: penaltyWindow.penalty,
      penaltyWindow,
      lastPenalty: state.lastPenalty,
      shieldActive: state.player.shield > 0,
      running: state.running,
    };
  }

  function jump() {
    if (!state.running) reset();
    if (state.player.grounded) {
      state.player.vy = -15.2;
      state.player.grounded = false;
      burst(state.player.x + 15, state.player.y + 36, 8);
      playSound('jump');
    }
  }

  function burst(x, y, count = 12, color = '#e0fbfc') {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: safeRandom(-3, 3),
        vy: safeRandom(-4, 2),
        life: safeRandom(18, 36),
        color,
      });
    }
  }

  function showPenaltyText(amount) {
    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    const direction = Math.random() > 0.5 ? 1 : -1;
    state.damageTexts.push({
      text: `-${amount}`,
      x: px,
      y: py,
      vx: safeRandom(1.8, 4.4) * direction,
      vy: safeRandom(-5.2, -3.2),
      life: 72,
      maxLife: 72,
      size: safeRandom(20, 27),
      rotation: safeRandom(-0.18, 0.18),
    });
  }

  function applyProtectedHitPenalty() {
    const seconds = getPlaySeconds();
    const row = getPenaltyForSeconds(seconds);
    const amount = row.penalty;

    state.score = Math.max(0, state.score - amount);
    state.lastPenalty = amount;
    state.shake = 9;
    showPenaltyText(amount);
    playSound('protectedHit');
    burst(state.player.x + 18, state.player.y + 20, 18, '#26d9d0');
    callbacks.onPenalty?.(snapshot(), amount, row);
  }

  function spawnObstacle() {
    const h = safeRandom(28, 70);
    state.obstacles.push({
      x: canvas.getBoundingClientRect().width + 30,
      y: groundY() - h,
      w: safeRandom(26, 44),
      h,
      passed: false,
      hit: false,
    });
  }

  function spawnOrb() {
    state.orbs.push({
      x: canvas.getBoundingClientRect().width + 30,
      y: safeRandom(groundY() - 160, groundY() - 70),
      r: 12,
      taken: false,
      pulse: 0,
    });
  }

  function rectHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function orbHit(player, orb) {
    const cx = clamp(orb.x, player.x, player.x + player.w);
    const cy = clamp(orb.y, player.y, player.y + player.h);
    const dx = orb.x - cx;
    const dy = orb.y - cy;
    return dx * dx + dy * dy < orb.r * orb.r;
  }

  function endGame() {
    state.endedAt = performance.now();
    state.running = false;
    state.shake = 18;
    playSound('gameOver', STAGE_CONFIG[state.stageIndex]);
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('baseQuestBest', String(Math.floor(state.best)));
    }
    callbacks.onGameOver?.(snapshot());
  }

  let obstacleTimer = 0;
  let orbTimer = 0;

  function update(dt) {
    if (!state.running || state.paused) return;
    const stage = STAGE_CONFIG[state.stageIndex];
    const speed = stage.speed + Math.min(4, state.distance / 5000);

    state.distance += speed * dt;
    state.score += speed * dt * 0.9;
    state.player.vy += 0.75 * dt;
    state.player.y += state.player.vy * dt;
    state.player.y = Math.min(state.player.y, groundY() - state.player.h);
    state.player.grounded = state.player.y >= groundY() - state.player.h;
    if (state.player.grounded) state.player.vy = 0;
    if (state.player.shield > 0) state.player.shield -= dt;

    obstacleTimer -= dt;
    orbTimer -= dt;
    if (obstacleTimer <= 0) {
      spawnObstacle();
      obstacleTimer = safeRandom(58, 110) - state.stageIndex * 4;
    }
    if (orbTimer <= 0) {
      spawnOrb();
      orbTimer = safeRandom(42, 80);
    }

    for (const o of state.obstacles) {
      o.x -= speed * dt;
      if (!o.passed && o.x + o.w < state.player.x) {
        o.passed = true;
        state.score += 45;
      }
      if (!o.hit && rectHit(state.player, o)) {
        o.hit = true;
        if (state.player.shield > 0) {
          o.x = -999;
          state.player.shield = 0;
          applyProtectedHitPenalty();
        } else {
          endGame();
        }
      }
    }

    for (const orb of state.orbs) {
      orb.x -= speed * dt;
      orb.pulse += dt * 0.1;
      if (!orb.taken && orbHit(state.player, orb)) {
        orb.taken = true;
        state.score += 120;
        state.player.shield = Math.max(state.player.shield, 120);
        burst(orb.x, orb.y, 14, '#8cffcb');
        playSound('orb');
      }
    }

    state.obstacles = state.obstacles.filter(o => o.x > -80);
    state.orbs = state.orbs.filter(o => o.x > -80 && !o.taken);

    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.18 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    for (const d of state.damageTexts) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy -= 0.02 * dt;
      d.life -= dt;
    }
    state.damageTexts = state.damageTexts.filter(d => d.life > 0);

    const nextStage = STAGE_CONFIG.findIndex(s => state.score < s.score);
    const newStageIndex = nextStage === -1 ? STAGE_CONFIG.length - 1 : Math.max(0, nextStage);
    if (newStageIndex !== state.stageIndex) state.stageIndex = newStageIndex;

    for (const m of STAGE_CONFIG) {
      if (state.score >= m.score && state.milestoneUnlocked < m.milestone) {
        state.milestoneUnlocked = m.milestone;
        callbacks.onMilestone?.(snapshot());
      }
    }

    callbacks.onUpdate?.(snapshot());
  }

  function draw() {
    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const shakeX = state.shake > 0 ? safeRandom(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 ? safeRandom(-state.shake, state.shake) : 0;
    state.shake = Math.max(0, state.shake - 1);
    ctx.translate(shakeX, shakeY);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#101827');
    gradient.addColorStop(0.55, '#172b4d');
    gradient.addColorStop(1, '#07111f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 48; i++) {
      const x = (i * 97 - state.distance * 0.12) % (width + 140) - 70;
      const y = 22 + (i * 37) % Math.max(70, height - 120);
      ctx.fillStyle = '#8bd3ff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    const gy = groundY();
    ctx.fillStyle = '#0d1a2c';
    ctx.fillRect(0, gy, width, height - gy);
    ctx.fillStyle = '#26d9d0';
    ctx.fillRect(0, gy, width, 3);
    ctx.globalAlpha = 0.18;
    for (let x = -80; x < width + 80; x += 38) {
      ctx.fillRect(x - (state.distance % 38), gy + 22, 22, 3);
    }
    ctx.globalAlpha = 1;

    for (const orb of state.orbs) {
      ctx.save();
      ctx.translate(orb.x, orb.y);
      const scale = 1 + Math.sin(orb.pulse) * 0.08;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(0, 0, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190, 255, 220, .85)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#d1fae5';
      ctx.beginPath();
      ctx.arc(-3, -3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const o of state.obstacles) {
      const hazard = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
      hazard.addColorStop(0, '#ff6b6b');
      hazard.addColorStop(1, '#912f56');
      ctx.fillStyle = hazard;
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(o.x + 5, o.y + 5, 5, Math.max(10, o.h - 12));
    }

    for (const p of state.particles) {
      ctx.globalAlpha = clamp(p.life / 36, 0, 1);
      ctx.fillStyle = p.color || '#e0fbfc';
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    const player = state.player;
    if (player.shield > 0) {
      const pulse = 34 + Math.sin(performance.now() / 110) * 3;
      ctx.strokeStyle = 'rgba(34, 197, 94, .88)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y + player.h / 2, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y + player.h / 2, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const body = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.h);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(1, '#83e9ff');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.w, player.h, 9);
    ctx.fill();
    ctx.fillStyle = '#101827';
    ctx.fillRect(player.x + 21, player.y + 12, 5, 5);
    ctx.fillStyle = '#26d9d0';
    ctx.fillRect(player.x + 8, player.y + 29, 19, 5);

    for (const d of state.damageTexts) {
      const alpha = clamp(d.life / d.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      ctx.font = `900 ${d.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(20, 0, 0, .85)';
      ctx.strokeText(d.text, 0, 0);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText(d.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    if (!state.running) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Space / Tap to Start', width / 2, height / 2 - 8);
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('Jump, collect green shields, unlock milestone NFTs.', width / 2, height / 2 + 24);
      ctx.restore();
    }
  }

  function loop(now) {
    const dt = Math.min(2.2, (now - state.lastTime) / 16.67);
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
      e.preventDefault();
      jump();
    }
    if (e.code === 'KeyP') state.paused = !state.paused;
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', jump);
  requestAnimationFrame((t) => { state.lastTime = t; requestAnimationFrame(loop); });
  draw();

  return {
    start: reset,
    jump,
    snapshot,
    setSoundEnabled,
    isSoundEnabled,
    destroy() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', jump);
    }
  };
}
