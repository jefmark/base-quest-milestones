import './style.css';

import { CONFIG } from './config.js';
import { createGame, STAGE_CONFIG } from './game.js';
import {
  connectWallet,
  disconnectWallet,
  getBalanceText,
  getWalletChoices,
  isMobileBrowser,
  mintMilestone,
  shortAddress,
  walletState,
} from './wallet.js';

const app = document.querySelector('#app');

const milestoneCards = STAGE_CONFIG.map((m) => `
  <article class="milestone-card">
    <div class="milestone-number">${m.milestone}</div>
    <h3>${m.name}</h3>
    <p>${m.score.toLocaleString()} score • ${m.minPlaySeconds}s</p>
  </article>
`).join('');

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Base • NFT Milestone Runner</p>
      <h1>Base Quest Milestones</h1>
      <p>
        Run, jump, collect green shields, lose score on protected hits, and mint ERC-721 milestone NFTs.
        This version uses one wallet button for desktop extensions, mobile wallet browsers, and WalletConnect.
      </p>
      <div class="actions wallet-actions">
        <button id="connectBtn" type="button">Connect Wallet</button>
        <button id="disconnectBtn" type="button" hidden>Disconnect</button>
      </div>
      <p id="walletStatus" class="status-text">
        Live on Base Mainnet. One Connect Wallet button works for desktop, mobile wallet browsers, and WalletConnect.
      </p>
    </section>

    <section class="game-panel">
      <canvas id="gameCanvas" width="960" height="420" aria-label="Base Quest runner game"></canvas>
      <div class="game-controls">
        <button id="startBtn" type="button">Start / Restart</button>
        <button id="jumpBtn" type="button">Jump</button>
        <button id="soundBtn" type="button">Sound: On</button>
        <button id="mintBtn" type="button" disabled>Mint NFT Locked</button>
      </div>
      <p id="message" class="message">
        Anti-cheat rule: mint is allowed only after a finished clean run.
      </p>
    </section>

    <section class="stats-grid" aria-label="Run statistics">
      <article>
        <span>Score</span>
        <strong id="score">0</strong>
      </article>
      <article>
        <span>Best</span>
        <strong id="best">0</strong>
      </article>
      <article>
        <span>Stage</span>
        <strong id="stage">Rookie Runner</strong>
      </article>
      <article>
        <span>Score Unlocked</span>
        <strong id="unlocked">None</strong>
      </article>
      <article>
        <span>Mintable NFT</span>
        <strong id="mintable">None</strong>
      </article>
      <article>
        <span>Play Time</span>
        <strong id="seconds">0s</strong>
      </article>
      <article>
        <span>Protected Hit Penalty</span>
        <strong id="penalty">-100</strong>
      </article>
      <article>
        <span>Last Hit</span>
        <strong id="lastPenalty">None</strong>
      </article>
      <article>
        <span>Anti-Cheat</span>
        <strong id="antiCheat">Not started</strong>
      </article>
      <article class="wide">
        <span>Next Requirement</span>
        <strong id="requirement">1,200 score • 20s</strong>
      </article>
    </section>

    <section class="safety-card">
      <h2>Wallet Safety</h2>
      <p>
        This app only calls <code>mintMilestone</code>. Reject any wallet popup asking for token approval,
        asset transfer, or unlimited permission.
      </p>
    </section>

    <section>
      <h2>Milestones</h2>
      <div class="milestones">
        ${milestoneCards}
      </div>
    </section>
  </main>

  <div id="walletModal" class="wallet-modal" hidden>
    <div class="wallet-modal__backdrop" data-close-wallet-modal></div>
    <section class="wallet-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="walletModalTitle">
      <div class="wallet-modal__header">
        <div>
          <p class="wallet-modal__eyebrow">Connect to Base Mainnet</p>
          <h2 id="walletModalTitle">Choose wallet</h2>
        </div>
        <button id="closeWalletModalBtn" type="button" class="wallet-modal__close" aria-label="Close wallet list">×</button>
      </div>
      <p class="wallet-modal__hint">
        Choose the wallet yourself. MetaMask is shown only when a verified MetaMask provider is detected, so Keplr is not opened by mistake.
      </p>
      <div id="walletChoices" class="wallet-choice-list">
        <button type="button" class="wallet-choice" disabled>Loading wallets...</button>
      </div>
      <p class="wallet-modal__small">
        On mobile Chrome/Samsung Browser, the Connect button opens WalletConnect directly when no mobile wallet browser provider is detected.
        Inside MetaMask's own browser, MetaMask usually appears as a detected wallet.
      </p>
    </section>
  </div>
`;

const modalStyle = document.createElement('style');
modalStyle.textContent = `
  .wallet-modal[hidden] { display: none !important; }
  .wallet-modal {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: 18px;
  }
  .wallet-modal__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(8px);
  }
  .wallet-modal__dialog {
    position: relative;
    width: min(460px, 100%);
    max-height: min(680px, calc(100vh - 36px));
    overflow: auto;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 22px;
    background: #101522;
    color: #ffffff;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
    padding: 22px;
  }
  .wallet-modal__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .wallet-modal__header h2 {
    margin: 4px 0 0;
    font-size: 1.45rem;
  }
  .wallet-modal__eyebrow {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7dd3fc;
  }
  .wallet-modal__close {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-size: 1.45rem;
    line-height: 1;
    cursor: pointer;
  }
  .wallet-modal__hint,
  .wallet-modal__small {
    color: #cbd5e1;
    line-height: 1.55;
  }
  .wallet-modal__small {
    font-size: 0.86rem;
    margin-bottom: 0;
  }
  .wallet-choice-list {
    display: grid;
    gap: 10px;
    margin-top: 16px;
  }
  .wallet-choice {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 54px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    cursor: pointer;
    font-weight: 800;
    text-align: left;
  }
  .wallet-choice:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
  }
  .wallet-choice:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
  .wallet-choice small {
    display: block;
    margin-top: 3px;
    color: #cbd5e1;
    font-weight: 500;
  }
  .wallet-choice__arrow {
    opacity: 0.72;
  }
`;
document.head.appendChild(modalStyle);

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
const walletModal = $('#walletModal');
const walletChoicesEl = $('#walletChoices');
const closeWalletModalBtn = $('#closeWalletModalBtn');

let lastSnapshot = null;
let connectInProgress = false;
let currentWalletChoices = [];

function milestoneLabel(milestone) {
  if (!milestone) return 'None';
  return `#${milestone.milestone} ${milestone.name}`;
}

function requirementText(snapshot) {
  const next = snapshot.nextRequirement;

  if (!next) {
    return 'All milestones unlocked';
  }

  const missing = [];

  if (next.remainingScore > 0) {
    missing.push(`${next.remainingScore.toLocaleString()} more score`);
  }

  if (next.remainingSeconds > 0) {
    missing.push(`${next.remainingSeconds}s more play time`);
  }

  return `#${next.milestone} ${next.name}: ${next.score.toLocaleString()} score • ${next.minPlaySeconds}s${
    missing.length ? ` (${missing.join(' + ')})` : ''
  }`;
}

function updateSoundButton() {
  soundBtn.textContent = game.isSoundEnabled() ? 'Sound: On' : 'Sound: Off';
}

function updateWalletButtons() {
  const connected = Boolean(walletState.account);

  connectBtn.hidden = connected;
  disconnectBtn.hidden = !connected;
  connectBtn.disabled = connectInProgress;
  disconnectBtn.disabled = connectInProgress;

  connectBtn.textContent = connectInProgress ? 'Connecting...' : 'Connect Wallet';

  if (connected) {
    disconnectBtn.textContent = `Disconnect ${shortAddress(walletState.account)}`;
  } else {
    disconnectBtn.textContent = 'Disconnect';
  }
}

function updateMintButton(snapshot) {
  const mintable = snapshot?.mintableMilestone;
  const canMint = Boolean(
    CONFIG.contractAddress &&
    walletState.account &&
    mintable &&
    snapshot.mintAllowed
  );

  mintBtn.disabled = !canMint;

  if (!mintable) {
    mintBtn.textContent = 'Mint NFT Locked';
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
    walletStatus.textContent = 'Live on Base Mainnet. Click Connect Wallet. On mobile Chrome it opens WalletConnect; on desktop choose the exact wallet.';
    updateStats(lastSnapshot || game.snapshot());
    return;
  }

  try {
    const balance = await getBalanceText();
    const name = walletState.walletName || walletState.connectionType || 'Wallet';
    walletStatus.textContent = `${name} connected on ${CONFIG.chainName} • ${shortAddress(walletState.account)} • ${balance}`;
  } catch {
    walletStatus.textContent = `${CONFIG.chainName} connected • ${shortAddress(walletState.account)}`;
  }

  updateStats(lastSnapshot || game.snapshot());
}

function closeWalletModal() {
  walletModal.hidden = true;
}

async function renderWalletChoices() {
  walletChoicesEl.innerHTML = '<button type="button" class="wallet-choice" disabled>Checking wallets...</button>';

  try {
    currentWalletChoices = await getWalletChoices();
  } catch (err) {
    console.error(err);
    currentWalletChoices = [
      {
        id: 'walletconnect',
        type: 'walletconnect',
        walletId: 'walletconnect',
        label: 'WalletConnect / Mobile Wallets',
        providerDetail: null,
      },
    ];
  }

  walletChoicesEl.innerHTML = currentWalletChoices.map((choice, index) => {
    const description = choice.description || (choice.type === 'walletconnect'
      ? 'Best for mobile Chrome, Trust Wallet, MetaMask Mobile, and other wallets'
      : 'Detected in this browser');

    return `
      <button type="button" class="wallet-choice" data-wallet-choice-index="${index}">
        <span>
          ${choice.label}
          <small>${description}</small>
        </span>
        <span class="wallet-choice__arrow">›</span>
      </button>
    `;
  }).join('');
}

async function openWalletModal() {
  if (connectInProgress || walletState.account) return;

  connectInProgress = true;
  updateWalletButtons();
  walletStatus.textContent = 'Checking available wallets...';

  let choices = [];

  try {
    choices = await getWalletChoices();
  } catch (err) {
    console.error(err);
    choices = [];
  } finally {
    connectInProgress = false;
    updateWalletButtons();
  }

  const walletConnectChoice = choices.find((choice) => choice.type === 'walletconnect') || {
    id: 'walletconnect',
    type: 'walletconnect',
    walletId: 'walletconnect',
    label: 'WalletConnect / Mobile Wallets',
    providerDetail: null,
  };

  const injectedChoices = choices.filter((choice) => choice.type === 'injected');

  // On normal mobile browsers there is usually no injected wallet.
  // Opening WalletConnect directly avoids the "nothing happened" feeling.
  if (isMobileBrowser() && injectedChoices.length === 0) {
    await connectWithChoice(walletConnectChoice);
    return;
  }

  currentWalletChoices = choices.length ? choices : [walletConnectChoice];
  walletModal.hidden = false;
  walletChoicesEl.innerHTML = currentWalletChoices.map((choice, index) => {
    const description = choice.description || (choice.type === 'walletconnect'
      ? 'Best for mobile Chrome, Trust Wallet, MetaMask Mobile, and other wallets'
      : 'Detected in this browser');

    return `
      <button type="button" class="wallet-choice" data-wallet-choice-index="${index}">
        <span>
          ${choice.label}
          <small>${description}</small>
        </span>
        <span class="wallet-choice__arrow">›</span>
      </button>
    `;
  }).join('');
}

async function connectWithChoice(choice) {
  if (!choice || connectInProgress) return;

  connectInProgress = true;
  updateWalletButtons();

  const isWalletConnect = choice.type === 'walletconnect';
  walletStatus.textContent = isWalletConnect
    ? 'Opening WalletConnect. On mobile, choose Trust Wallet or MetaMask from the wallet list.'
    : `Opening ${choice.label}...`;

  try {
    await connectWallet({
      walletId: choice.walletId,
      providerDetail: choice.providerDetail,
    });

    closeWalletModal();
    await refreshWalletUi();

    messageEl.textContent = CONFIG.contractAddress
      ? 'Wallet connected. Finish a clean run to mint.'
      : 'Wallet connected, but VITE_CONTRACT_ADDRESS is empty. Add the Base Mainnet contract address.';
  } catch (err) {
    console.error(err);
    const message = err.shortMessage || err.message || 'Connection failed.';
    walletStatus.textContent = message;
    messageEl.textContent = message;
  } finally {
    connectInProgress = false;
    updateWalletButtons();
  }
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
      messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} is ready to mint. Final play time: ${snapshot.playSeconds}s.`;
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

  if (snapshot.antiCheat && !snapshot.antiCheat.clean) {
    messageEl.textContent = `${snapshot.antiCheat.status} Start a new run to mint.`;
    return;
  }

  if (snapshot.mintableMilestone && snapshot.mintAllowed) {
    messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} is mintable now.`;
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

$('#startBtn').addEventListener('click', () => game.start());
$('#jumpBtn').addEventListener('click', () => game.jump());

soundBtn.addEventListener('click', () => {
  game.setSoundEnabled(!game.isSoundEnabled());
  updateSoundButton();
});

connectBtn.addEventListener('click', openWalletModal);

closeWalletModalBtn.addEventListener('click', closeWalletModal);

walletModal.addEventListener('click', (event) => {
  if (event.target?.matches('[data-close-wallet-modal]')) {
    closeWalletModal();
  }
});

walletChoicesEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-wallet-choice-index]');
  if (!button) return;

  const index = Number(button.dataset.walletChoiceIndex);
  const choice = currentWalletChoices[index];
  await connectWithChoice(choice);
});

disconnectBtn.addEventListener('click', async () => {
  await disconnectWallet();
  await refreshWalletUi();
  messageEl.textContent = 'Wallet disconnected.';
});

mintBtn.addEventListener('click', async () => {
  try {
    const mintable = lastSnapshot?.mintableMilestone;

    if (!mintable) {
      throw new Error('No NFT is mintable yet. Reach the required score and play time first.');
    }

    const payload = game.getMintPayload(mintable.milestone);

    mintBtn.disabled = true;
    messageEl.textContent = `Minting #${payload.milestone}. Confirm only if it calls mintMilestone and asks for gas only.`;

    const result = await mintMilestone(
      payload.milestone,
      payload.score,
      payload.playSeconds
    );

    messageEl.innerHTML = `NFT minted. <a href="${CONFIG.explorerUrl}/tx/${result.hash}" target="_blank" rel="noreferrer">View transaction</a>`;
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.shortMessage || err.message || 'Mint failed.';
  } finally {
    updateStats(lastSnapshot || game.snapshot());
  }
});

window.addEventListener('bqm-wallet-changed', refreshWalletUi);

updateSoundButton();
updateWalletButtons();

if (!CONFIG.contractAddress) {
  messageEl.textContent = 'Contract not configured yet. Add VITE_CONTRACT_ADDRESS in GitHub Actions variables.';
}
