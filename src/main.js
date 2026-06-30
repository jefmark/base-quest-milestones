import './style.css';

import { CONFIG } from './config.js';
import { createGame, STAGE_CONFIG } from './game.js';
import {
  disconnectWallet,
  getBalanceText,
  mintMilestone,
  openWalletModal,
  shortAddress,
  walletState,
} from './wallet.js';


function installBrowserIdentity() {
  document.title = 'Base Quest Milestones';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2563eb"/>
          <stop offset="1" stop-color="#22c55e"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#bg)"/>
      <circle cx="35" cy="15" r="6" fill="#fff"/>
      <path d="M32 23 L23 33 L34 35 L43 26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M34 35 L26 51" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <path d="M35 36 L49 49" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <path d="M23 33 L13 29" fill="none" stroke="#dbeafe" stroke-width="5" stroke-linecap="round"/>
      <path d="M42 26 L53 22" fill="none" stroke="#dbeafe" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `.trim();

  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.type = 'image/svg+xml';
  icon.href = dataUrl;

  let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = dataUrl;

  const ensureMeta = (name, content) => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  ensureMeta('application-name', 'Base Quest Milestones');
  ensureMeta('theme-color', '#0f172a');
}

installBrowserIdentity();

const app = document.querySelector('#app');

const milestoneCards = STAGE_CONFIG.map((m) => `
  <article class="milestone-card">
    <div class="milestone-topline">
      <span class="milestone-number">${m.milestone}</span>
      <span class="milestone-pill">${m.minPlaySeconds}s</span>
    </div>
    <h3>${m.name}</h3>
    <p>${m.score.toLocaleString()} score required</p>
  </article>
`).join('');

app.innerHTML = `
  <main class="shell">
    <section class="hero-card">
      <div class="hero-copy">
        <p class="eyebrow">Base Mainnet • ERC-721 Runner</p>
        <h1>Base Quest Milestones</h1>
        <p class="hero-text">
          Play a clean run, unlock a milestone, then mint the matching NFT on Base.
          The wallet picker is EVM-only and supports desktop extensions plus mobile WalletConnect.
        </p>
        <div class="actions wallet-actions">
          <button id="connectBtn" class="primary-action" type="button">Connect Wallet</button>
          <button id="disconnectBtn" class="ghost-action" type="button" hidden>Disconnect</button>
        </div>
        <p id="walletStatus" class="status-text">
          Live on Base Mainnet. Connect an EVM wallet to mint unlocked milestones.
        </p>
      </div>
      <div class="hero-side" aria-hidden="true">
        <div class="orb orb-one"></div>
        <div class="orb orb-two"></div>
        <div class="chain-card">
          <span>Network</span>
          <strong>Base</strong>
        </div>
        <div class="chain-card muted">
          <span>Mint Type</span>
          <strong>Milestone NFT</strong>
        </div>
      </div>
    </section>

    <section class="game-panel">
      <div class="game-panel-head">
        <div>
          <p class="eyebrow">Clean run required</p>
          <h2>Runner Arena</h2>
        </div>
        <div class="game-controls">
          <button id="startBtn" type="button">Start / Restart</button>
          <button id="jumpBtn" type="button">Jump</button>
          <button id="soundBtn" type="button">Sound: On</button>
        </div>
      </div>
      <canvas id="gameCanvas" width="960" height="420" aria-label="Base Quest runner game"></canvas>
      <div class="mint-bar">
        <p id="message" class="message">Finish a clean run to unlock minting.</p>
        <button id="mintBtn" class="mint-action" type="button" disabled>Mint NFT Locked</button>
      </div>
    </section>

    <section class="stats-grid" aria-label="Run statistics">
      <article><span>Score</span><strong id="score">0</strong></article>
      <article><span>Best</span><strong id="best">0</strong></article>
      <article><span>Stage</span><strong id="stage">Rookie Runner</strong></article>
      <article><span>Score Unlocked</span><strong id="unlocked">None</strong></article>
      <article><span>Mintable NFT</span><strong id="mintable">None</strong></article>
      <article><span>Play Time</span><strong id="seconds">0s</strong></article>
      <article><span>Protected Hit Penalty</span><strong id="penalty">-100</strong></article>
      <article><span>Last Hit</span><strong id="lastPenalty">None</strong></article>
      <article><span>Anti-Cheat</span><strong id="antiCheat">Not started</strong></article>
      <article class="wide"><span>Next Requirement</span><strong id="requirement">1,200 score • 20s</strong></article>
    </section>

    <section class="info-grid">
      <article class="safety-card">
        <h2>Wallet Safety</h2>
        <p>
          This app only calls <code>mintMilestone</code>. Reject approvals, transfers, unlimited permissions,
          or any wallet popup unrelated to milestone minting.
        </p>
      </article>
      <article class="safety-card">
        <h2>Mint Protection</h2>
        <p>
          If an NFT becomes mintable, accidental Space/tap/canvas clicks will not restart the game.
          Only the Start / Restart button can begin a new run after mint unlock.
        </p>
      </article>
    </section>

    <section class="milestone-section">
      <div class="section-title">
        <p class="eyebrow">Onchain progress</p>
        <h2>Milestones</h2>
      </div>
      <div class="milestones">${milestoneCards}</div>
    </section>
  </main>
`;

const $ = (selector) => document.querySelector(selector);

const scoreEl = $('#score');
const bestEl = $('#best');
const stageEl = $('#stage');
const unlockedEl = $('#unlocked');
const mintableEl = $('#mintable');
const secondsEl = $('#seconds');
const penaltyEl = $('#penalty');
const lastPenaltyEl = $('#lastPenalty');
const requirementEl = $('#requirement');
const messageEl = $('#message');
const mintBtn = $('#mintBtn');
const connectBtn = $('#connectBtn');
const disconnectBtn = $('#disconnectBtn');
const walletStatus = $('#walletStatus');
const soundBtn = $('#soundBtn');
const antiCheatEl = $('#antiCheat');

let lastSnapshot = null;
let connectInProgress = false;
let disconnectInProgress = false;
let mintInProgress = false;
let mintedMilestones = new Set();

function milestoneLabel(milestone) {
  if (!milestone) return 'None';
  return `#${milestone.milestone} ${milestone.name}`;
}

function requirementText(snapshot) {
  const next = snapshot.nextRequirement;
  if (!next) return 'All milestones unlocked';

  const missing = [];
  if (next.remainingScore > 0) missing.push(`${next.remainingScore.toLocaleString()} more score`);
  if (next.remainingSeconds > 0) missing.push(`${next.remainingSeconds}s more play time`);

  return `#${next.milestone} ${next.name}: ${next.score.toLocaleString()} score • ${next.minPlaySeconds}s${missing.length ? ` (${missing.join(' + ')})` : ''}`;
}

function updateSoundButton() {
  soundBtn.textContent = game.isSoundEnabled() ? 'Sound: On' : 'Sound: Off';
}

function updateWalletButtons() {
  const connected = Boolean(walletState.account);
  const busy = connectInProgress || disconnectInProgress || mintInProgress;

  connectBtn.hidden = connected;
  disconnectBtn.hidden = !connected;
  connectBtn.disabled = busy;
  disconnectBtn.disabled = busy;

  connectBtn.textContent = connectInProgress ? 'Opening wallet list...' : 'Connect Wallet';
  disconnectBtn.textContent = connected
    ? (disconnectInProgress ? 'Disconnecting...' : `Disconnect ${shortAddress(walletState.account)}`)
    : 'Disconnect';
}

function updateMintButton(snapshot) {
  const mintable = snapshot?.mintableMilestone;
  const alreadyMintedLocally = mintable ? mintedMilestones.has(mintable.milestone) : false;
  const canMint = Boolean(
    CONFIG.contractAddress &&
    walletState.account &&
    mintable &&
    snapshot.mintAllowed &&
    !mintInProgress &&
    !alreadyMintedLocally
  );

  mintBtn.disabled = !canMint;

  if (mintInProgress) {
    mintBtn.textContent = 'Waiting for wallet...';
    return;
  }
  if (!mintable) {
    mintBtn.textContent = 'Mint NFT Locked';
    return;
  }
  if (alreadyMintedLocally) {
    mintBtn.textContent = `Minted #${mintable.milestone}`;
    return;
  }
  if (!walletState.account) {
    mintBtn.textContent = `Connect wallet to mint #${mintable.milestone}`;
    return;
  }
  if (!snapshot.mintAllowed) {
    mintBtn.textContent = `Mint locked: #${mintable.milestone}`;
    return;
  }

  mintBtn.textContent = `Mint #${mintable.milestone} ${mintable.name}`;
}

async function refreshWalletUi() {
  updateWalletButtons();

  if (!walletState.account) {
    walletStatus.textContent = 'Live on Base Mainnet. Connect an EVM wallet. On mobile, MetaMask/Trust opens the wallet app; WalletConnect keeps this page open.';
    updateStats(lastSnapshot || game.snapshot());
    return;
  }

  try {
    const balance = await getBalanceText();
    const name = walletState.walletName || walletState.connectionType || 'Wallet';
    const networkLabel = walletState.chainOk ? CONFIG.chainName : `wrong network - switch to ${CONFIG.chainName}`;
    walletStatus.textContent = `${name} connected on ${networkLabel} • ${shortAddress(walletState.account)} • ${balance}`;
  } catch {
    walletStatus.textContent = `${CONFIG.chainName} connected • ${shortAddress(walletState.account)}`;
  }

  updateStats(lastSnapshot || game.snapshot());
}

const game = createGame($('#gameCanvas'), {
  onUpdate: updateStats,
  onMilestone(snapshot) {
    updateStats(snapshot);
  },
  onPenalty(snapshot, amount, row) {
    updateStats(snapshot);
    messageEl.textContent = `Shield protected you. -${amount.toLocaleString()} score in ${row.label}.`;
  },
  onCheatFlag(snapshot, code, detail) {
    updateStats(snapshot);
    messageEl.textContent = `Anti-cheat blocked this run: ${code}. ${detail || 'Restart required.'}`;
  },
  onGameOver(snapshot) {
    updateStats(snapshot);
    if (snapshot.mintAllowed && snapshot.mintableMilestone) {
      messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} is ready to mint. Accidental Space/tap will not restart this run. Use Mint NFT or press Start / Restart for a new run.`;
      return;
    }
    if (snapshot.mintableMilestone && !snapshot.mintAllowed) {
      messageEl.textContent = `NFT score/time reached, but mint is blocked. ${snapshot.mintBlockedReason}`;
      return;
    }
    messageEl.textContent = `Game over. NFT mint is locked. ${requirementText(snapshot)}`;
  },
});

function updateStats(snapshot) {
  lastSnapshot = snapshot;

  scoreEl.textContent = snapshot.score.toLocaleString();
  bestEl.textContent = snapshot.best.toLocaleString();
  stageEl.textContent = snapshot.stage?.name || 'Rookie Runner';
  unlockedEl.textContent = milestoneLabel(snapshot.scoreUnlockedMilestone);
  mintableEl.textContent = milestoneLabel(snapshot.mintableMilestone);
  secondsEl.textContent = `${snapshot.playSeconds}s`;
  penaltyEl.textContent = `-${snapshot.currentPenalty.toLocaleString()} (${snapshot.penaltyWindow.label})`;
  lastPenaltyEl.textContent = snapshot.lastPenalty ? `-${snapshot.lastPenalty.toLocaleString()}` : 'None';
  requirementEl.textContent = requirementText(snapshot);
  antiCheatEl.textContent = snapshot.antiCheat?.status || 'Unknown';

  updateMintButton(snapshot);

  if (mintInProgress) return;

  if (snapshot.antiCheat && !snapshot.antiCheat.clean) {
    messageEl.textContent = `${snapshot.antiCheat.status} Start a new run to mint.`;
    return;
  }

  if (snapshot.mintableMilestone && snapshot.mintAllowed) {
    messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} is mintable now. Accidental jump/tap will not restart it.`;
    return;
  }

  if (snapshot.mintableMilestone && !snapshot.mintAllowed) {
    messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} reached, but mint is locked. ${snapshot.mintBlockedReason}`;
    return;
  }

  if (snapshot.scoreUnlockedMilestone) {
    messageEl.textContent = `Score reached for ${milestoneLabel(snapshot.scoreUnlockedMilestone)}, but mint is still locked. ${requirementText(snapshot)}`;
  }
}

$('#startBtn').addEventListener('click', () => {
  game.start();
  updateStats(game.snapshot());
});

$('#jumpBtn').addEventListener('click', () => game.jump());

soundBtn.addEventListener('click', () => {
  game.setSoundEnabled(!game.isSoundEnabled());
  updateSoundButton();
});

connectBtn.addEventListener('click', async () => {
  if (connectInProgress || walletState.account) return;

  connectInProgress = true;
  updateWalletButtons();
  walletStatus.textContent = 'Opening EVM wallet list...';

  try {
    await openWalletModal();
    walletStatus.textContent = 'Wallet list opened. On Android Chrome, choose MetaMask/Trust to open the app, or WalletConnect to stay on this page.';
  } catch (err) {
    console.error(err);
    const message = err.shortMessage || err.message || 'Could not open wallet list.';
    walletStatus.textContent = message;
    messageEl.textContent = message;
  } finally {
    connectInProgress = false;
    updateWalletButtons();
  }
});

disconnectBtn.addEventListener('click', async () => {
  if (disconnectInProgress) return;

  disconnectInProgress = true;
  updateWalletButtons();
  walletStatus.textContent = 'Disconnecting wallet and revoking permission when supported...';

  try {
    const result = await disconnectWallet();
    await refreshWalletUi();
    messageEl.textContent = result?.revoked
      ? 'Wallet disconnected and account permission was revoked by the wallet.'
      : 'Wallet disconnected from the site. Some wallets require removing the dapp from their own connections screen.';
  } catch (err) {
    console.error(err);
    const message = err.shortMessage || err.message || 'Disconnect failed.';
    walletStatus.textContent = message;
    messageEl.textContent = message;
  } finally {
    disconnectInProgress = false;
    updateWalletButtons();
  }
});

mintBtn.addEventListener('click', async () => {
  if (mintInProgress) return;

  try {
    const mintable = lastSnapshot?.mintableMilestone;

    if (!mintable) {
      throw new Error('No NFT is mintable yet. Reach the required score and play time first.');
    }

    const payload = game.getMintPayload(mintable.milestone);

    mintInProgress = true;
    updateMintButton(lastSnapshot);
    updateWalletButtons();
    messageEl.textContent = `Preparing mint #${payload.milestone}. Your wallet should ask for gas only. Do not close this page.`;

    const result = await mintMilestone(
      payload.milestone,
      payload.score,
      payload.playSeconds
    );

    mintedMilestones.add(payload.milestone);
    messageEl.innerHTML = `NFT minted. <a href="${CONFIG.explorerUrl}/tx/${result.hash}" target="_blank" rel="noreferrer">View transaction</a>`;
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.shortMessage || err.message || 'Mint failed.';
  } finally {
    mintInProgress = false;
    updateWalletButtons();
    updateStats(lastSnapshot || game.snapshot());
  }
});

window.addEventListener('bqm-wallet-changed', refreshWalletUi);

updateSoundButton();
updateWalletButtons();
updateStats(game.snapshot());

if (!CONFIG.contractAddress) {
  messageEl.textContent = 'Contract is not configured. Add VITE_CONTRACT_ADDRESS in GitHub Actions variables.';
}
