export const STAGE_CONFIG = [
  { milestone: 1, name: 'Rookie Runner', score: 1200, minPlaySeconds: 20, speed: 5.4 },
  { milestone: 2, name: 'Chain Jumper', score: 5000, minPlaySeconds: 10, speed: 6.2 },
  { milestone: 3, name: 'Base Sprinter', score: 10000, minPlaySeconds: 10, speed: 7.0 },
  { milestone: 4, name: 'Gasless Ghost', score: 15000, minPlaySeconds: 10, speed: 7.9 },
  { milestone: 5, name: 'Block Master', score: 22000, minPlaySeconds: 15, speed: 8.9 },
  { milestone: 6, name: 'Onchain Legend', score: 30000, minPlaySeconds: 17, speed: 10.0 },
];

const safeRandom = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
    player: { x: 90, y: 0, w: 34, h: 42, vy: 0, grounded: false, shield: 0 },
    obstacles: [],
    orbs: [],
    particles: [],
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
    state.player = { x: 90, y: groundY() - 42, w: 34, h: 42, vy: 0, grounded: true, shield: 0 };
    state.obstacles = [];
    state.orbs = [];
    state.particles = [];
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

    return {
      score: Math.floor(state.score),
      best: Math.floor(state.best),
      milestoneUnlocked: scoreUnlocked?.milestone || 0,
      scoreUnlockedMilestone: scoreUnlocked,
      mintableMilestone: mintable,
      nextRequirement: getNextRequirement(),
      stage: STAGE_CONFIG[state.stageIndex],
      playSeconds,
      running: state.running,
    };
  }

  function jump() {
    if (!state.running) reset();
    if (state.player.grounded) {
      state.player.vy = -15.2;
      state.player.grounded = false;
      burst(state.player.x + 15, state.player.y + 36, 8);
    }
  }

  function burst(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: safeRandom(-3, 3),
        vy: safeRandom(-4, 2),
        life: safeRandom(18, 36),
      });
    }
  }

  function spawnObstacle() {
    const h = safeRandom(28, 70);
    state.obstacles.push({
      x: canvas.getBoundingClientRect().width + 30,
      y: groundY() - h,
      w: safeRandom(26, 44),
      h,
      passed: false,
    });
  }

  function spawnOrb() {
    state.orbs.push({
      x: canvas.getBoundingClientRect().width + 30,
      y: safeRandom(groundY() - 160, groundY() - 70),
      r: 11,
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
    const width = canvas.getBoundingClientRect().width;

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
      orbTimer = safeRandom(45, 85);
    }

    for (const o of state.obstacles) {
      o.x -= speed * dt;
      if (!o.passed && o.x + o.w < state.player.x) {
        o.passed = true;
        state.score += 45;
      }
      if (rectHit(state.player, o)) {
        if (state.player.shield > 0) {
          o.x = -999;
          state.player.shield = 0;
          burst(state.player.x + 18, state.player.y + 20, 16);
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
        state.player.shield = Math.max(state.player.shield, 90);
        burst(orb.x, orb.y, 14);
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
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 0, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
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
      ctx.fillStyle = '#e0fbfc';
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    const player = state.player;
    if (player.shield > 0) {
      ctx.strokeStyle = 'rgba(38, 217, 208, .82)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y + player.h / 2, 34, 0, Math.PI * 2);
      ctx.stroke();
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
      ctx.fillText('Jump, collect shields, unlock milestone NFTs.', width / 2, height / 2 + 24);
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
    destroy() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', jump);
    }
  };
}
