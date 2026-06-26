import './style.css';
import { CONFIG } from './config.js';
import { createGame } from './game.js';
import { connectWallet, getBalanceText, mintMilestone, shortAddress, walletState } from './wallet.js';

const app = document.querySelector('#app');
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
        <p id="walletStatus" class="muted">Start on Base Sepolia. Mainnet only after testing.</p>
      </div>
    </section>

    <section class="gameGrid">
      <div class="card gameCard">
        <canvas id="gameCanvas" aria-label="Base Quest game canvas"></canvas>
        <div class="controls">
          <button id="startBtn">Start / Restart</button>
          <button id="jumpBtn">Jump</button>
          <button id="mintBtn" class="accent" disabled>Mint Unlocked NFT</button>
        </div>
      </div>
      <aside class="card stats">
        <h2>Run Stats</h2>
        <dl>
          <div><dt>Score</dt><dd id="score">0</dd></div>
          <div><dt>Best</dt><dd id="best">0</dd></div>
          <div><dt>Stage</dt><dd id="stage">Rookie Runner</dd></div>
          <div><dt>Unlocked NFT</dt><dd id="unlocked">None</dd></div>
          <div><dt>Play Time</dt><dd id="seconds">0s</dd></div>
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
        <div><b>1</b><span>Rookie Runner</span><em>1,200 score</em></div>
        <div><b>2</b><span>Chain Jumper</span><em>2,600 score</em></div>
        <div><b>3</b><span>Base Sprinter</span><em>4,500 score</em></div>
        <div><b>4</b><span>Gasless Ghost</span><em>7,000 score</em></div>
        <div><b>5</b><span>Block Master</span><em>10,000 score</em></div>
        <div><b>6</b><span>Onchain Legend</span><em>13,500 score</em></div>
      </div>
    </section>
  </main>
`;

const $ = (id) => document.querySelector(id);
const scoreEl = $('#score');
const bestEl = $('#best');
const stageEl = $('#stage');
const unlockedEl = $('#unlocked');
const secondsEl = $('#seconds');
const messageEl = $('#message');
const mintBtn = $('#mintBtn');
const connectBtn = $('#connectBtn');
const walletStatus = $('#walletStatus');

let lastSnapshot = null;

const game = createGame($('#gameCanvas'), {
  onUpdate: updateStats,
  onMilestone(snapshot) {
    updateStats(snapshot);
    messageEl.textContent = `Milestone ${snapshot.milestoneUnlocked} unlocked. You can mint this NFT after connecting your wallet.`;
  },
  onGameOver(snapshot) {
    updateStats(snapshot);
    messageEl.textContent = 'Game over. Restart and try to unlock a higher milestone.';
  }
});

function updateStats(snapshot) {
  lastSnapshot = snapshot;
  scoreEl.textContent = snapshot.score.toLocaleString();
  bestEl.textContent = snapshot.best.toLocaleString();
  stageEl.textContent = snapshot.stage?.name || 'Rookie Runner';
  unlockedEl.textContent = snapshot.milestoneUnlocked ? `Milestone ${snapshot.milestoneUnlocked}` : 'None';
  secondsEl.textContent = `${snapshot.playSeconds}s`;
  mintBtn.disabled = !CONFIG.contractAddress || !walletState.account || !snapshot.milestoneUnlocked;
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
      ? 'Wallet connected. Play and mint your unlocked milestone.'
      : 'Wallet connected, but VITE_CONTRACT_ADDRESS is empty. Deploy the contract and add the address.';
    updateStats(lastSnapshot || game.snapshot());
  } catch (err) {
    console.error(err);
    walletStatus.textContent = err.shortMessage || err.message || 'Connection failed.';
  }
});

mintBtn.addEventListener('click', async () => {
  try {
    if (!lastSnapshot?.milestoneUnlocked) throw new Error('Unlock a milestone first.');
    mintBtn.disabled = true;
    messageEl.textContent = 'Mint transaction sent. Confirm only if it calls mintMilestone and asks for gas only.';
    const result = await mintMilestone(lastSnapshot.milestoneUnlocked, lastSnapshot.score, lastSnapshot.playSeconds);
    messageEl.innerHTML = `NFT minted. <a href="${CONFIG.explorerUrl}/tx/${result.hash}" target="_blank" rel="noreferrer">View transaction</a>`;
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.shortMessage || err.message || 'Mint failed.';
  } finally {
    updateStats(lastSnapshot || game.snapshot());
  }
});

if (!CONFIG.contractAddress) {
  messageEl.textContent = 'Contract not configured yet. Deploy on Base Sepolia first, then add VITE_CONTRACT_ADDRESS.';
}
