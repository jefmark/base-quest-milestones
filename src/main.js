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
        Wallet connection is powered by Reown AppKit for a professional desktop and mobile wallet list.
      </p>
      <div class="actions wallet-actions">
        <button id="connectBtn" type="button">Connect Wallet</button>
        <button id="disconnectBtn" type="button" hidden>Disconnect</button>
      </div>
      <p id="walletStatus" class="status-text">
        Live on Base Mainnet. Click Connect Wallet to choose an EVM/Base wallet from the wallet list.
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
        asset transfer, unlimited permission, or anything unrelated to minting your milestone NFT.
      </p>
    </section>

    <section>
      <h2>Milestones</h2>
      <div class="milestones">
        ${milestoneCards}
      </div>
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
  const busy = connectInProgress || disconnectInProgress;

  connectBtn.hidden = connected;
  disconnectBtn.hidden = !connected;
  connectBtn.disabled = busy;
  disconnectBtn.disabled = busy;

  connectBtn.textContent = connectInProgress ? 'Opening wallet list...' : 'Connect Wallet';

  if (connected) {
    disconnectBtn.textContent = disconnectInProgress
      ? 'Disconnecting...'
      : `Disconnect ${shortAddress(walletState.account)}`;
  } else {
    disconnectBtn.textContent = disconnectInProgress ? 'Disconnecting...' : 'Disconnect';
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
    walletStatus.textContent = 'Live on Base Mainnet. Click Connect Wallet to choose an EVM/Base wallet. Mobile opens the same wallet list with deep links.';
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

connectBtn.addEventListener('click', async () => {
  if (connectInProgress || walletState.account) return;

  connectInProgress = true;
  updateWalletButtons();
  walletStatus.textContent = 'Opening wallet list. Choose MetaMask, Trust Wallet, Coinbase Wallet, or another EVM wallet for Base.';

  try {
    await openWalletModal();
    walletStatus.textContent = 'Wallet list opened. Choose an EVM/Base wallet from the modal.';
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
  walletStatus.textContent = 'Disconnecting wallet and revoking dapp permission when supported by the wallet...';

  try {
    const result = await disconnectWallet();
    await refreshWalletUi();
    messageEl.textContent = result?.revoked
      ? 'Wallet disconnected and dapp account permission was revoked by the wallet.'
      : 'Wallet disconnected from the site. If your wallet still lists this dapp, remove it from the wallet connections screen.';
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
