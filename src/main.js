import './style.css';
import { CONFIG } from './config.js';
import { createGame, STAGE_CONFIG } from './game.js';
import { connectWallet, getBalanceText, mintMilestone, shortAddress, walletState } from './wallet.js';

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
    <section class="hero card">
      <div>
        <p class="eyebrow">Base • NFT Milestone Runner</p>
        <h1>Base Quest Milestones</h1>
        <p class="lead">Run, jump, collect shields, unlock safe ERC-721 milestone NFTs. No approvals. No token transfers. No server.</p>
      </div>
      <div class="walletBox">
        <button id="connectBtn" class="primary">Connect Wallet</button>
        <p id="walletStatus" class="muted">Live on Base Mainnet. Play, score, and mint milestone NFT badges.</p>
      </div>
    </section>

    <section class="gameGrid">
      <div class="card gameCard">
        <canvas id="gameCanvas" aria-label="Base Quest game canvas"></canvas>
        <div class="controls">
          <button id="startBtn">Start / Restart</button>
          <button id="jumpBtn">Jump</button>
          <button id="mintBtn" class="accent" disabled>Mint NFT</button>
        </div>
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
          <div><dt>Next Requirement</dt><dd id="requirement">1,200 score • 20s</dd></div>
        </dl>
        <div id="message" class="message">Press Space, tap the game, or use Jump.</div>
        <div class="securityNote">
          <strong>Wallet Safety:</strong> this app only calls <code>mintMilestone</code>. Reject any wallet popup asking for token approval or asset transfer.
        </div>
      </aside>
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
const requirementEl = $('#requirement');
const messageEl = $('#message');
const mintBtn = $('#mintBtn');
const connectBtn = $('#connectBtn');
const walletStatus = $('#walletStatus');

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
  if (next.remainingScore > 0) missing.push(`${next.remainingScore.toLocaleString()} more score`);
  if (next.remainingSeconds > 0) missing.push(`${next.remainingSeconds}s more play time`);

  return `#${next.milestone} ${next.name}: ${next.score.toLocaleString()} score • ${next.minPlaySeconds}s${missing.length ? ` (${missing.join(' + ')})` : ''}`;
}

function updateMintButton(snapshot) {
  const mintable = snapshot?.mintableMilestone;
  const canMint = Boolean(CONFIG.contractAddress && walletState.account && mintable);

  mintBtn.disabled = !canMint;

  if (mintable) {
    mintBtn.textContent = `Mint #${mintable.milestone} ${mintable.name}`;
  } else {
    mintBtn.textContent = 'Mint NFT Locked';
  }
}

const game = createGame($('#gameCanvas'), {
  onUpdate: updateStats,
  onMilestone(snapshot) {
    updateStats(snapshot);
  },
  onGameOver(snapshot) {
    updateStats(snapshot);

    if (snapshot.mintableMilestone) {
      messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} is ready to mint. Play time: ${snapshot.playSeconds}s.`;
    } else {
      messageEl.textContent = `Game over. NFT mint is locked. ${requirementText(snapshot)}`;
    }
  }
});

function updateStats(snapshot) {
  lastSnapshot = snapshot;

  scoreEl.textContent = snapshot.score.toLocaleString();
  bestEl.textContent = snapshot.best.toLocaleString();
  stageEl.textContent = snapshot.stage?.name || 'Rookie Runner';
  unlockedEl.textContent = milestoneLabel(snapshot.scoreUnlockedMilestone);
  mintableEl.textContent = milestoneLabel(snapshot.mintableMilestone);
  secondsEl.textContent = `${snapshot.playSeconds}s`;
  requirementEl.textContent = requirementText(snapshot);

  updateMintButton(snapshot);

  if (snapshot.mintableMilestone) {
    messageEl.textContent = `${milestoneLabel(snapshot.mintableMilestone)} is mintable now. Play time: ${snapshot.playSeconds}s.`;
  } else if (snapshot.scoreUnlockedMilestone) {
    messageEl.textContent = `Score reached for ${milestoneLabel(snapshot.scoreUnlockedMilestone)}, but mint is still locked. ${requirementText(snapshot)}`;
  }
}

$('#startBtn').addEventListener('click', () => game.start());
$('#jumpBtn').addEventListener('click', () => game.jump());

connectBtn.addEventListener('click', async () => {
  try {
    await connectWallet();
    const balance = await getBalanceText();
    connectBtn.textContent = shortAddress(walletState.account);
    walletStatus.textContent = `${CONFIG.chainName} connected • ${balance}`;
    messageEl.textContent = CONFIG.contractAddress
      ? 'Wallet connected. Play until score and time conditions are met.'
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

    mintBtn.disabled = true;
    messageEl.textContent = `Minting #${mintable.milestone} ${mintable.name}. Confirm only if it calls mintMilestone and asks for gas only.`;

    const result = await mintMilestone(
      mintable.milestone,
      lastSnapshot.score,
      lastSnapshot.playSeconds
    );

    messageEl.innerHTML = `NFT minted. <a href="${CONFIG.explorerUrl}/tx/${result.hash}" target="_blank" rel="noreferrer">View transaction</a>`;
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.shortMessage || err.message || 'Mint failed.';
  } finally {
    updateStats(lastSnapshot || game.snapshot());
  }
});

if (!CONFIG.contractAddress) {
  messageEl.textContent = 'Contract not configured yet. Add VITE_CONTRACT_ADDRESS in GitHub/Vercel variables.';
}
