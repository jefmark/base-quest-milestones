# Base Quest Milestones

Base Quest Milestones is a no-server browser game with ERC-721 milestone NFT badges on the Base network.

Players run inside a lightweight canvas game, collect shields, avoid obstacles, build score, and mint milestone NFTs when they reach verified score and play-time requirements. The frontend is a static Vite app. The smart contract is a simple ERC-721 milestone badge contract with no paid mint, no ERC-20 approval flow, and no token transfer request from the player wallet.

> Current status: experimental MVP. This project is suitable for learning, demo use, portfolio use, and early community testing. Do not attach high-value rewards without stronger server-side or on-chain verification.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Live Links](#live-links)
- [Core Features](#core-features)
- [How the Game Works](#how-the-game-works)
- [Milestone Rules](#milestone-rules)
- [No-Server Anti-Cheat Model](#no-server-anti-cheat-model)
- [Smart Contract Overview](#smart-contract-overview)
- [NFT Metadata and Images](#nft-metadata-and-images)
- [Wallet Safety Model](#wallet-safety-model)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Run Locally](#run-locally)
- [Build the Frontend](#build-the-frontend)
- [Deploy the Frontend with GitHub Pages](#deploy-the-frontend-with-github-pages)
- [Deploy or Manage the Contract with Remix](#deploy-or-manage-the-contract-with-remix)
- [Update Milestone Settings Without Redeploying](#update-milestone-settings-without-redeploying)
- [Fix or Update NFT Metadata](#fix-or-update-nft-metadata)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [Roadmap](#roadmap)
- [Official References](#official-references)
- [License](#license)

---

## Project Overview

Base Quest Milestones combines three parts:

1. **Canvas browser game**
   - Runs fully in the browser.
   - Uses player input, obstacles, shields, score, time, and game-over state.
   - Does not require a backend server.

2. **Static web app**
   - Built with Vite.
   - Uses JavaScript modules.
   - Connects to EVM wallets through ethers v6.

3. **ERC-721 milestone NFT contract**
   - Deployed on Base-compatible EVM networks.
   - Mints badge NFTs for score milestones.
   - Uses milestone metadata files such as `1.json`, `2.json`, etc.
   - Does not accept ETH payments.
   - Does not ask the user for token approvals.

The goal is to create a simple Web3 game loop:

```text
Play → Reach score and time requirement → Finish a clean run → Connect wallet → Mint milestone NFT
```

---

## Live Links

Replace these with your real production links after deployment.

```text
Frontend:
https://jefmark.github.io/base-quest-milestones/

Repository:
https://github.com/jefmark/base-quest-milestones

Base Mainnet Explorer:
https://basescan.org

Base Sepolia Explorer:
https://sepolia.basescan.org
```

If you deploy a new contract, add it here:

```text
Current Contract Address:
0xYOUR_CONTRACT_ADDRESS
```

---

## Core Features

- Browser game built with Vite and Canvas.
- Wallet connection with ethers v6.
- ERC-721 NFT milestone badges.
- No paid mint.
- No ERC-20 approval.
- No `transferFrom` request from player wallets.
- Owner-managed milestone settings.
- Owner-managed base metadata URI.
- Pausable mint function.
- Mint cooldown per wallet.
- One mint per wallet per milestone.
- Static metadata and image hosting.
- Client-side anti-cheat checks for casual cheating.
- GitHub Pages deployment support.
- Base Mainnet and Base Sepolia configuration support.

---

## How the Game Works

The player controls a runner.

The game includes:

- Obstacles.
- Green shield orbs.
- Score gain over time.
- Bonus score for passing obstacles.
- Bonus score for collecting shield orbs.
- Score penalty when a shield protects the player from an obstacle.
- Game over when the player hits an obstacle without shield protection.

The game calculates:

```text
score
play time
current milestone
next required milestone
anti-cheat status
mint eligibility
```

A milestone is only considered mintable when both conditions are met:

```text
score >= required milestone score
play time >= required milestone time
```

In the anti-cheat version, minting is only allowed after a finished clean run.

---

## Milestone Rules

Recommended balanced milestone settings:

| Milestone | Name | Required Score | Required Play Time |
|---:|---|---:|---:|
| 1 | Rookie Runner | 1,200 | 20 seconds |
| 2 | Chain Jumper | 5,000 | 45 seconds |
| 3 | Base Sprinter | 10,000 | 70 seconds |
| 4 | Gasless Ghost | 18,000 | 95 seconds |
| 5 | Block Master | 30,000 | 125 seconds |
| 6 | Onchain Legend | 45,000 | 160 seconds |

These values should match both places:

1. `src/game.js`
2. The deployed contract milestone settings

If the frontend and contract values do not match, the app may show a milestone as ready while the contract rejects the transaction.

---

## No-Server Anti-Cheat Model

This project uses client-side anti-cheat checks because it is designed to run without a backend server.

The current no-server anti-cheat model can block casual cheating inside the normal website UI:

- Minting is allowed only after game over.
- The run becomes invalid if the player switches tabs during an active run.
- The run becomes invalid if the browser freezes for too long.
- The run becomes invalid if the score rate is too high.
- The run becomes invalid if the internal score ledger does not match the visible score.
- The run becomes invalid if jump input frequency is abnormal.
- The app sends mint data through `game.getMintPayload()` instead of raw manual input.

Important limitation:

```text
No-server anti-cheat is not full security.
```

The smart contract still accepts `clientScore` and `playSeconds` as transaction parameters. A technical user can bypass the frontend and call the contract directly from Remix, Basescan, or another script.

For high-value rewards, use one of these stronger models:

- Backend signed mint authorization.
- EIP-712 signed score proofs.
- On-chain game verification.
- Commit-reveal gameplay.
- Zero-knowledge or deterministic proof systems.

For this project, the no-server model is acceptable for low-value NFT badges, portfolio demos, and casual community games.

---

## Smart Contract Overview

Main contract:

```text
contracts/BaseQuestMilestones.sol
```

The contract is an ERC-721 milestone NFT contract.

Key design points:

- Contract name: `Base Quest Milestones`
- Symbol: `BQM`
- Uses OpenZeppelin ERC-721.
- Uses owner-only management functions.
- Uses pausing for emergency shutdown.
- Uses reentrancy protection on mint.
- Rejects direct ETH transfers.
- Does not use payable minting.
- Does not request player token approvals.

Main user function:

```solidity
mintMilestone(uint256 milestone, uint256 clientScore, uint256 playSeconds)
```

Main owner functions:

```solidity
setMilestone(
  uint256 milestone,
  uint32 requiredScore,
  uint32 minPlaySeconds,
  bool active,
  string calldata name
)

setBaseTokenURI(string calldata newBaseTokenURI)

setMintCooldown(uint256 newCooldown)

pause()

unpause()
```

The contract stores which milestone belongs to each token:

```solidity
tokenMilestone[tokenId] = milestone;
```

The token URI is generated from the milestone number:

```solidity
return string.concat(baseTokenURI, milestone.toString(), ".json");
```

This means multiple NFT tokens can share the same metadata file if multiple users mint the same milestone.

Example:

```text
tokenId 1 → milestone 2 → metadata/2.json
tokenId 5 → milestone 2 → metadata/2.json
```

That is normal for this contract design.

---

## NFT Metadata and Images

Metadata files are stored here:

```text
public/metadata/
```

Images are stored here:

```text
public/nft/
```

Example structure:

```text
public/
  metadata/
    1.json
    2.json
    3.json
    4.json
    5.json
    6.json

  nft/
    1.png
    2.png
    3.png
    4.png
    5.png
    6.png
```

When deployed to GitHub Pages, the `public` folder is served from the site root.

So this file:

```text
public/nft/1.png
```

becomes:

```text
https://jefmark.github.io/base-quest-milestones/nft/1.png
```

Do not include `/public/` in the live URL.

Correct:

```json
{
  "image": "https://jefmark.github.io/base-quest-milestones/nft/1.png"
}
```

Wrong:

```json
{
  "image": "https://jefmark.github.io/base-quest-milestones/public/nft/1.png"
}
```

Wrong placeholder:

```json
{
  "image": "https://YOUR_DOMAIN/nft/1.png"
}
```

Each metadata file should use the OpenSea-compatible ERC-721 metadata shape:

```json
{
  "name": "Rookie Runner #1",
  "description": "A milestone badge for the Base Quest game.",
  "image": "https://jefmark.github.io/base-quest-milestones/nft/1.png",
  "external_url": "https://jefmark.github.io/base-quest-milestones/",
  "attributes": [
    {
      "trait_type": "Milestone",
      "value": "1"
    }
  ]
}
```

---

## Wallet Safety Model

This project is designed to minimize wallet risk.

The user should only see a wallet confirmation for:

```text
mintMilestone(...)
```

The user should reject any wallet popup that asks for:

- ERC-20 approval.
- NFT approval.
- Unlimited spending.
- Token transfer.
- `transferFrom`.
- `setApprovalForAll`.
- Any unknown contract interaction unrelated to minting.

The contract has:

```solidity
receive() external payable {
  revert("NO_ETH_ACCEPTED");
}

fallback() external payable {
  revert("NO_ETH_ACCEPTED");
}
```

So direct ETH transfers are rejected.

---

## Project Structure

```text
base-quest-milestones/
  contracts/
    BaseQuestMilestones.sol

  public/
    metadata/
      1.json
      2.json
      3.json
      4.json
      5.json
      6.json

    nft/
      1.png
      2.png
      3.png
      4.png
      5.png
      6.png

  scripts/
    deploy.js

  src/
    config.js
    game.js
    main.js
    style.css
    wallet.js

  .github/
    workflows/
      deploy-pages.yml

  hardhat.config.cjs
  index.html
  package.json
  vite.config.js
```

---

## Local Setup

Install Node.js first.

Recommended:

```text
Node.js 20+
npm 10+
```

Clone the repository:

```bash
git clone https://github.com/jefmark/base-quest-milestones.git
cd base-quest-milestones
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

The frontend reads environment variables that start with `VITE_`.

Create a local `.env` file:

```bash
cp .env.example .env
```

Example for Base Sepolia:

```env
VITE_CHAIN_ID=84532
VITE_CHAIN_NAME=Base Sepolia
VITE_RPC_URL=https://sepolia.base.org
VITE_EXPLORER_URL=https://sepolia.basescan.org
VITE_CONTRACT_ADDRESS=0xYourSepoliaContractAddress
```

Example for Base Mainnet:

```env
VITE_CHAIN_ID=8453
VITE_CHAIN_NAME=Base
VITE_RPC_URL=https://mainnet.base.org
VITE_EXPLORER_URL=https://basescan.org
VITE_CONTRACT_ADDRESS=0xYourMainnetContractAddress
```

For contract deployment scripts, use a fresh deployer wallet and store the private key only in `.env` or GitHub Secrets. Never commit a private key.

Example:

```env
DEPLOYER_PRIVATE_KEY=your_private_key_here
NFT_METADATA_BASE_URI=https://jefmark.github.io/base-quest-milestones/metadata/
```

---

## Run Locally

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite.

Common local URL:

```text
http://localhost:5173/
```

---

## Build the Frontend

Build the production version:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

The production build output is usually:

```text
dist/
```

---

## Deploy the Frontend with GitHub Pages

This project can be published with GitHub Pages.

Recommended repository settings:

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

Add repository variables:

```text
Settings → Secrets and variables → Actions → Variables
```

Add these variables:

```text
VITE_CHAIN_ID
VITE_CHAIN_NAME
VITE_RPC_URL
VITE_EXPLORER_URL
VITE_CONTRACT_ADDRESS
```

For Base Mainnet:

```text
VITE_CHAIN_ID=8453
VITE_CHAIN_NAME=Base
VITE_RPC_URL=https://mainnet.base.org
VITE_EXPLORER_URL=https://basescan.org
VITE_CONTRACT_ADDRESS=0xYourMainnetContractAddress
```

Then run deployment:

```text
Actions → Deploy to GitHub Pages → Run workflow → branch: main → Run workflow
```

Or push to `main` if the workflow runs automatically.

After deployment, test:

```text
https://jefmark.github.io/base-quest-milestones/
```

Use a hard refresh after changes:

```text
Ctrl + F5
```

On mobile:

```text
Close the tab
Close the browser
Open the site again
```

---

## Deploy or Manage the Contract with Remix

You can deploy and manage the contract with Remix.

Basic Remix flow:

1. Open Remix.
2. Add `BaseQuestMilestones.sol`.
3. Compile with Solidity `0.8.24` or compatible.
4. Go to `Deploy & Run Transactions`.
5. Select the injected browser wallet environment.
6. Make sure the wallet is on the correct Base network.
7. Deploy the contract with:
   - `initialOwner`
   - `initialBaseURI`

Example `initialBaseURI`:

```text
https://jefmark.github.io/base-quest-milestones/metadata/
```

The final slash is required.

Correct:

```text
https://jefmark.github.io/base-quest-milestones/metadata/
```

Wrong:

```text
https://jefmark.github.io/base-quest-milestones/metadata
```

---

## Update Milestone Settings Without Redeploying

You do not need to redeploy the contract to change milestone score and time requirements.

Use:

```solidity
setMilestone(
  uint256 milestone,
  uint32 requiredScore,
  uint32 minPlaySeconds,
  bool active,
  string calldata name
)
```

Recommended current settings:

```text
1, 1200, 20, true, "Rookie Runner"
2, 5000, 45, true, "Chain Jumper"
3, 10000, 70, true, "Base Sprinter"
4, 18000, 95, true, "Gasless Ghost"
5, 30000, 125, true, "Block Master"
6, 45000, 160, true, "Onchain Legend"
```

After each transaction, verify with:

```solidity
getMilestone(1)
getMilestone(2)
getMilestone(3)
getMilestone(4)
getMilestone(5)
getMilestone(6)
```

---

## Fix or Update NFT Metadata

If NFT images do not appear on OpenSea, Element, or other marketplaces, check this order:

### 1. Check `tokenURI`

In Remix, call:

```solidity
tokenURI(1)
```

If the token exists, it should return a URL like:

```text
https://jefmark.github.io/base-quest-milestones/metadata/2.json
```

The number can be different from the token ID because this contract maps token IDs to milestone numbers.

### 2. Open the returned JSON URL

The JSON must load without a 404 error.

### 3. Check the `image` field

It must be a real direct image URL.

Correct:

```text
https://jefmark.github.io/base-quest-milestones/nft/2.png
```

Wrong:

```text
https://YOUR_DOMAIN/nft/2.png
```

### 4. Open the image URL directly

The image must open in the browser.

### 5. Refresh marketplace metadata

After fixing JSON files, marketplaces may still show old data because they cache NFT metadata.

Use the marketplace refresh option when available:

```text
NFT item page → More / three dots → Refresh metadata
```

If refresh is not available, wait and check again later.

### 6. Use a new metadata path if cache is stuck

If old metadata remains cached, create a new folder:

```text
public/metadata-v2/
public/nft-v2/
```

Then update the contract:

```solidity
setBaseTokenURI("https://jefmark.github.io/base-quest-milestones/metadata-v2/")
```

This forces marketplaces to read a new URL path.

---

## Troubleshooting

### The game says a milestone is ready, but the contract rejects the mint

Cause:

```text
Frontend milestone settings do not match contract milestone settings.
```

Fix:

1. Check `src/game.js`.
2. Check `getMilestone(n)` in Remix.
3. Make both values the same.

---

### NFT images do not show in OpenSea or Element

Common causes:

- `image` field still uses `YOUR_DOMAIN`.
- Image URL returns 404.
- JSON URL returns 404.
- Base URI is wrong.
- Missing trailing slash in base URI.
- Marketplace metadata is cached.

Fix:

1. Open `tokenURI(tokenId)`.
2. Open the JSON.
3. Open the image URL.
4. Fix JSON if needed.
5. Use `setBaseTokenURI` if the base path is wrong.
6. Refresh metadata on the marketplace.

---

### I see two NFT number 2 items or two NFT number 4 items

This can be normal.

The contract metadata is based on milestone number, not token ID.

If two users mint milestone 2, there will be two different tokens that both use:

```text
metadata/2.json
```

---

### Wallet connection fails

Check:

- Browser wallet is installed.
- Wallet is on the correct chain.
- `VITE_CHAIN_ID` is correct.
- `VITE_RPC_URL` is correct.
- `VITE_CONTRACT_ADDRESS` is set.
- The deployed contract address is on the same chain as the frontend config.

---

### GitHub Pages still shows the old version

Fix:

1. Wait for the GitHub Actions workflow to finish.
2. Check that the latest workflow is green.
3. Hard refresh with `Ctrl + F5`.
4. On mobile, close the browser and reopen the page.
5. Check that repository variables are correct.

---

## Security Notes

This project uses a low-risk mint model:

- No paid mint.
- No ERC-20 approval.
- No NFT approval.
- No token transfer request from players.
- No direct ETH acceptance.

However, the current no-server anti-cheat is not a full security boundary.

A technical user may bypass the frontend and call the contract directly with custom score and time values. This is a known limitation of any no-server browser-only game that sends score values to a smart contract.

Do not use this design for:

- High-value rewards.
- Token emissions.
- Paid competitions.
- Prize pools.
- Financially sensitive game logic.

For production-grade rewards, use backend signature verification or a new smart contract design that verifies gameplay more strongly.

---

## Roadmap

Possible next steps:

- Farcaster Mini App support.
- Vercel deployment.
- IPFS-hosted metadata.
- Contract-level metadata with `contractURI`.
- Backend signed mint authorization.
- EIP-712 score signatures.
- Better marketplace refresh workflow.
- New game mode with stronger deterministic verification.
- Leaderboard.
- Daily challenges.
- Better mobile controls.
- Sound and accessibility settings.
- Contract verification on Basescan.

---

## Official References

Use these official references when modifying or extending the project.

- Vite Guide: https://vite.dev/guide/
- Vite Production Build: https://vite.dev/guide/build
- ethers v6 Getting Started: https://docs.ethers.org/v6/getting-started/
- OpenZeppelin ERC-721: https://docs.openzeppelin.com/contracts/5.x/erc721
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- OpenSea Metadata Standards: https://docs.opensea.io/docs/metadata-standards
- OpenSea Contract Metadata: https://docs.opensea.io/docs/contract-level-metadata
- Base Network Details: https://docs.base.org/base-chain/quickstart/connecting-to-base
- GitHub Actions Secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- GitHub Actions Variables: https://docs.github.com/actions/learn-github-actions/variables
- Hardhat Configuration: https://hardhat.org/docs/reference/configuration
- Hardhat Deployment Overview: https://hardhat.org/docs/guides/deployment
- Remix Deploy and Run: https://remix-ide.readthedocs.io/en/latest/run.html

---

## License

MIT License.
