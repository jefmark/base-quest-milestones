# Base Quest Milestones

A secure, no-server browser runner game with ERC-721 milestone NFTs on Base.

## What this project does

- Browser game built with Vite + Canvas + ethers v6
- Users connect an EVM wallet and play the game
- After reaching score milestones, users can mint ERC-721 badge NFTs
- No server required
- No ERC-20 approvals
- No payable mint
- No transfer-from calls against player wallets
- Designed for Base Sepolia testing first, then Base Mainnet

## Important safety rule

Do not deploy with your main wallet private key. Create a fresh deployer wallet, fund it only with enough ETH for gas, and test on Base Sepolia before using Base Mainnet.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Deploy contract on Base Sepolia first

1. Create a new wallet for deployment.
2. Add the private key to `.env`:

```bash
DEPLOYER_PRIVATE_KEY=your_private_key_here
NFT_METADATA_BASE_URI=https://YOUR_USERNAME.github.io/base-quest-milestones/metadata/
```

3. Deploy to testnet:

```bash
npm run deploy:base-sepolia
```

4. Copy the deployed contract address and add it to `.env`:

```bash
VITE_CONTRACT_ADDRESS=0xYourContractAddress
```

5. Restart the dev server:

```bash
npm run dev
```

## Publish frontend with GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml`.

After uploading the repo to GitHub:

1. Go to repository **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Go to **Settings → Secrets and variables → Actions → Variables**.
4. Add these repository variables:

```text
VITE_CHAIN_ID=84532
VITE_CHAIN_NAME=Base Sepolia
VITE_RPC_URL=https://sepolia.base.org
VITE_EXPLORER_URL=https://sepolia.basescan.org
VITE_CONTRACT_ADDRESS=0xYourSepoliaContractAddress
```

5. Push to `main` or run the workflow manually from the **Actions** tab.

## Switch to Base Mainnet later

Only after testing:

```text
VITE_CHAIN_ID=8453
VITE_CHAIN_NAME=Base
VITE_RPC_URL=https://mainnet.base.org
VITE_EXPLORER_URL=https://basescan.org
VITE_CONTRACT_ADDRESS=0xYourMainnetContractAddress
```

Deploy the contract with:

```bash
npm run deploy:base-mainnet
```

## NFT metadata

Metadata is in `public/metadata/` and images are in `public/nft/`.

Before mainnet, replace `YOUR_USERNAME` in the JSON files with your real GitHub username or host metadata on IPFS.

## No-server anti-cheat warning

This game can block casual spam using contract limits, cooldowns, and score requirements. It cannot fully prevent cheating because gameplay happens in the browser. Do not attach high-value money, tokens, or expensive rewards without a backend anti-cheat verifier.
