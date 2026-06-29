import './style.css';

import { CONFIG } from './config.js';
import { createGame, STAGE_CONFIG } from './game.js';
import {
  connectWallet,
  getBalanceText,
  mintMilestone,
  shortAddress,
  walletState,
} from './wallet.js';

const app = document.querySelector('#app');

const milestoneCards = STAGE_CONFIG.map((m) => `
  <div>
    <b>${m.milestone}</b>
    <span>${m.name}</span>
    <em>${m.score.toLocaleString()} score • ${m.minPlaySeconds}s</em>
  </div>
`).join('');

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Base • NFT Milestone Runner</p>
        <h1>Base Quest Milestones</h1>
        <p class="lead">
          Run, jump, collect green shields, lose score on protected hits, and mint ERC-721 milestone NFTs.
          This version adds client-side anti-cheat checks without changing the smart contract.
        </p>
      </div>

      <div class="wallet">
        <button id="connectBtn">Connect Wallet</button>
        <p id="walletStatus" class="muted">Live on Base Mainnet. Play, score, finish the run, then mint.</p>
      </div>
    </section>

    <section class="game-grid">
      <div class="card game-card">
        <canvas id="gameCanvas"></canvas>

        <div class="controls">
          <button id="startBtn">Start / Restart</button>
          <button id="jumpBtn">Jump</button>
          <button id="soundBtn">Sound: On</button>
          <button id="mintBtn" disabled>Mint NFT Locked</button>
        </div>

        <p id="message" class="muted">
          Anti-cheat rule: mint is allowed only after a finished clean run.
        </p>
      </div>

      <aside class="card stats">
        <h2>Run Stats</h2>

        <dl>
          <div><dt>Score</dt><dd id="score">0</dd></div>
          <div><dt>Best</dt><dd id="best">0</dd></div>
          <div><dt>Stage</dt><dd id="stage">Rookie Runner</dd></div>
          <div><dt>Score Unlocked</dt><dd id="unlocked">None</dd></div>
          <div><dt>Mintable NFT</dt><dd id="mintable">None</dd></div>
          <div><dt>Play Time</dt><dd id="seconds">0s</dd></div>
          <div><dt>Protected Hit Penalty</dt><dd id="penalty">-100</dd></div>
          <div><dt>Last Hit</dt><dd id="lastPenalty">None</dd></div>
          <div><dt>Anti-Cheat</dt><dd id="antiCheat">Not started</dd></div>
          <div><dt>Next Requirement</dt><dd id="requirement">1,200 score • 20s</dd></div>
        </dl>

        <p class="muted">
          Press Space, tap the game, or use Jump.
        </p>
      </aside>
    </section>

    <section class="card info">
      <h2>Wallet Safety</h2>
      <p>
        This app only calls <code>mintMilestone</code>. Reject any wallet popup asking for token approval,
        asset transfer, or unlimited permission.
      </p>
    </section>

    <section class="card info">
      <h2>Milestones</h2>
      <div class="milestones">
        ${milestoneCards}
      </div>
    </section>
  </main>
`;

const $ = (id) => document.querySelector(id);

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
const walletStatus = $('#walletStatus');
const soundBtn = $('#soundBtn');
const antiCheatEl = $('#antiCheat');

let lastSnapshot = null;

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

function updateMintButton(snapshot) {
  const mintable = snapshot?.mintableMilestone;
  const canMint = Boolean(CONFIG.contractAddress && walletState.account && mintable && snapshot.mintAllowed);

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
  try {
    await connectWallet();

    const balance = await getBalanceText();

    connectBtn.textContent = shortAddress(walletState.account);
    walletStatus.textContent = `${CONFIG.chainName} connected • ${balance}`;
    messageEl.textContent = CONFIG.contractAddress
      ? 'Wallet connected. Finish a clean run to mint.'
      : 'Wallet connected, but VITE_CONTRACT_ADDRESS is empty. Add the contract address.';

    updateStats(lastSnapshot || game.snapshot());
  } catch (err) {
    console.error(err);
    walletStatus.textContent = err.shortMessage || err.message || 'Connection failed.';
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

    messageEl.innerHTML = `NFT minted. <a href="${CONFIG.explorerUrl}/tx/${result.hash}" target="_blank" rel="noopener">View transaction</a>`;
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.shortMessage || err.message || 'Mint failed.';
  } finally {
    updateStats(lastSnapshot || game.snapshot());
  }
});

updateSoundButton();

if (!CONFIG.contractAddress) {
  messageEl.textContent = 'Contract not configured yet. Add VITE_CONTRACT_ADDRESS in GitHub/Vercel variables.';
}
