# Base Quest Milestones

Base Quest Milestones is a browser-based ERC-721 runner game deployed on GitHub Pages. Players run through milestone checkpoints, unlock NFT mint opportunities, connect an EVM wallet, and mint milestone NFTs on Base Mainnet.

The project is designed for desktop EVM wallets, mobile wallet browsers, WalletConnect QR/mobile connection, Base Mainnet NFT minting, and static deployment through Vite and GitHub Pages.

> Current status: experimental MVP. This project is suitable for learning, demo use, portfolio use, and early community testing. Do not attach high-value rewards without stronger server-side or on-chain verification.

---

## Live Site

```txt
https://jefmark.github.io/base-quest-milestones/
```

## Repository

```txt
https://github.com/jefmark/base-quest-milestones
```

## Network

```txt
Chain ID: 8453
Chain Name: Base
RPC URL: https://mainnet.base.org
Explorer: https://basescan.org
```

---

## Core Features

### Game

- Runner-style browser game
- Six NFT milestones
- Mobile and desktop gameplay support
- Mobile tap-to-jump support
- Sound toggle
- Start / Restart control
- Mint button only appears when an NFT milestone is unlocked
- If a milestone NFT is already minted, the game should not unnecessarily lock the player at that milestone
- If a milestone NFT is not yet minted, the game preserves the mint opportunity and prevents accidental restart/jump from skipping the claim

### NFT Minting

- ERC-721 minting on Base Mainnet
- Milestone-specific mint flow
- Wallet network validation
- Mobile wallet browser support
- Direct transaction request flow for mobile wallets
- Persistent mint status messages
- NFT preview after successful mint
- No paid mint
- No ERC-20 approval flow
- No token transfer request from the player wallet

NFT images are expected to exist in:

```txt
public/nft/1.png
public/nft/2.png
public/nft/3.png
public/nft/4.png
public/nft/5.png
public/nft/6.png
```

Metadata files are expected to exist in:

```txt
public/metadata/
```

---

## How the Game Works

The player controls a runner. The game includes obstacles, jump input, score gain, milestone checkpoint detection, mint eligibility checks, game-over state, and mint-preserve behavior when an unminted milestone is unlocked.

Normal loop:

```txt
Play
→ Reach required score/time
→ Unlock milestone
→ Connect wallet
→ Mint milestone NFT
→ Show minted NFT image
```

---

## Milestone Rules

Recommended milestone settings:

| Milestone | Name | Required Score | Required Play Time |
|---:|---|---:|---:|
| 1 | Rookie Runner | 1,200 | 20 seconds |
| 2 | Chain Jumper | 5,000 | 45 seconds |
| 3 | Base Sprinter | 10,000 | 70 seconds |
| 4 | Gasless Ghost | 18,000 | 95 seconds |
| 5 | Block Master | 30,000 | 125 seconds |
| 6 | Onchain Legend | 45,000 | 160 seconds |

These values must match both places:

1. `src/game.js`
2. The deployed contract milestone settings

If the frontend and contract values do not match, the app may show a milestone as ready while the contract rejects the transaction.

---

## NFT Metadata and Images

Metadata files are stored here:

```txt
public/metadata/
```

Images are stored here:

```txt
public/nft/
```

When deployed to GitHub Pages, the `public` folder is served from the site root.

Correct image URL:

```txt
https://jefmark.github.io/base-quest-milestones/nft/1.png
```

Wrong image URL:

```txt
https://jefmark.github.io/base-quest-milestones/public/nft/1.png
```

Each metadata file should use the ERC-721 metadata shape:

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

## Wallet Support

The wallet connection system uses a custom EVM wallet picker.

Supported wallet options:

```txt
MetaMask
Trust Wallet
Coinbase Wallet
Rabby Wallet
Rainbow
OKX Wallet
Zerion Wallet
Browser Wallet
WalletConnect
```

The wallet picker is EVM-focused. Non-EVM wallet flows such as Solana, Keplr, Cosmos, etc. are not used for this game.

### Desktop wallet behavior

Desktop wallets are selected through injected EVM providers when available. The app avoids blindly choosing the wrong injected provider when multiple extensions exist.

### Mobile wallet behavior

Mobile wallets usually work in one of these ways:

1. The site is opened directly inside the wallet browser.
2. The user starts from Android Chrome and is deeplinked into the wallet browser.
3. The user connects with WalletConnect.
4. The user scans WalletConnect QR from another device.

---

## Important Mobile Wallet Behavior

There is one known mobile wallet behavior that still exists.

When the user opens the site from Android Chrome and chooses a wallet such as MetaMask or Trust Wallet, the wallet app may open the site inside its own internal browser.

Because Android Chrome and the wallet internal browser are two separate browser contexts, the original page state and injected provider are not automatically transferred.

The user may need to do this:

```txt
1. Open site in Android Chrome.
2. Tap Connect Wallet.
3. Choose MetaMask or Trust Wallet.
4. Wallet app opens the site inside its internal browser.
5. Tap Connect Wallet again inside the wallet browser.
6. Choose the same wallet again.
7. The wallet connects successfully because the provider is now injected inside the wallet browser.
```

This is not ideal UX, but it is a known limitation of mobile wallet deeplink flows.

### Why this happens

Mobile wallets usually inject `window.ethereum` only inside their own browser. When the site is opened in normal Chrome, Trust Wallet or MetaMask Mobile cannot always inject the provider directly into that Chrome tab.

So the first tap only moves the user into the wallet browser. The second tap connects inside the correct browser context.

### What was tried

Several approaches were implemented or tested during development:

- Direct `window.ethereum` connection
- Custom EVM wallet picker
- EIP-6963 provider detection for desktop wallets
- MetaMask / Trust Wallet mobile deeplinks
- WalletConnect fallback
- WalletConnect QR/modal support
- Closing the custom wallet modal before opening WalletConnect
- Keeping game state safer after mobile wallet redirects
- Preventing accidental restart when a mintable NFT is available
- Direct transaction request flow for mobile minting
- Persistent mint status messages so mobile wallet errors remain visible
- NFT preview after successful mint

### Current status

The remaining issue is:

```txt
Mobile deeplink wallets may still require two taps:
one tap to open the wallet browser,
another tap inside the wallet browser to connect.
```

Recommended workaround:

```txt
Use WalletConnect when the user wants to stay in the same browser context,
or open the site directly inside MetaMask Mobile / Trust Wallet Browser.
```

---

## WalletConnect Setup

WalletConnect requires a valid Reown / WalletConnect Project ID.

The project uses this environment variable:

```txt
VITE_WALLETCONNECT_PROJECT_ID
```

This value must be added in GitHub Repository Variables.

Go to:

```txt
Repository Settings
→ Secrets and variables
→ Actions
→ Variables
→ New repository variable
```

Add:

```txt
Name:
VITE_WALLETCONNECT_PROJECT_ID
```

```txt
Value:
YOUR_REAL_REOWN_PROJECT_ID
```

Do not write `Value:` inside the value field. Do not wrap the ID in quotes. Do not leave it empty. Do not use stars.

Correct example format:

```txt
a1b2c3d4e5f6g7h8i9j0
```

Important: the value should be placed in Repository Variables, not only in Secrets.

The GitHub Actions workflow reads:

```yaml
VITE_WALLETCONNECT_PROJECT_ID: ${{ vars.VITE_WALLETCONNECT_PROJECT_ID }}
```

So the value must exist under `vars`.

---

## Required GitHub Repository Variables

```txt
VITE_CHAIN_ID=8453
VITE_CHAIN_NAME=Base
VITE_RPC_URL=https://mainnet.base.org
VITE_EXPLORER_URL=https://basescan.org
VITE_CONTRACT_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_WALLETCONNECT_PROJECT_ID=YOUR_REOWN_PROJECT_ID
```

`VITE_CONTRACT_ADDRESS` must be the actual deployed ERC-721 contract address on Base Mainnet.

---

## GitHub Actions Deployment

The deployment workflow must pass all Vite variables into the build.

File:

```txt
.github/workflows/deploy-pages.yml
```

The workflow must include:

```yaml
env:
  VITE_CHAIN_ID: ${{ vars.VITE_CHAIN_ID }}
  VITE_CHAIN_NAME: ${{ vars.VITE_CHAIN_NAME }}
  VITE_RPC_URL: ${{ vars.VITE_RPC_URL }}
  VITE_EXPLORER_URL: ${{ vars.VITE_EXPLORER_URL }}
  VITE_CONTRACT_ADDRESS: ${{ vars.VITE_CONTRACT_ADDRESS }}
  VITE_WALLETCONNECT_PROJECT_ID: ${{ vars.VITE_WALLETCONNECT_PROJECT_ID }}
```

Without this line:

```yaml
VITE_WALLETCONNECT_PROJECT_ID: ${{ vars.VITE_WALLETCONNECT_PROJECT_ID }}
```

the site will build without the WalletConnect Project ID, even if the variable exists in GitHub.

Resulting error:

```txt
WalletConnect Project ID is missing.
```

---

## Correct Deploy Workflow

Use this workflow if deployment fails because of missing cache lock file or missing environment variables.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

env:
  VITE_CHAIN_ID: ${{ vars.VITE_CHAIN_ID }}
  VITE_CHAIN_NAME: ${{ vars.VITE_CHAIN_NAME }}
  VITE_RPC_URL: ${{ vars.VITE_RPC_URL }}
  VITE_EXPLORER_URL: ${{ vars.VITE_EXPLORER_URL }}
  VITE_CONTRACT_ADDRESS: ${{ vars.VITE_CONTRACT_ADDRESS }}
  VITE_WALLETCONNECT_PROJECT_ID: ${{ vars.VITE_WALLETCONNECT_PROJECT_ID }}

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Install dependencies
        run: npm install

      - name: Build site
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Why npm cache was removed

An earlier workflow used:

```yaml
cache: npm
```

GitHub then expected a dependency lock file such as:

```txt
package-lock.json
```

Because the repository did not have a lock file, GitHub Actions failed with:

```txt
Dependencies lock file is not found
```

The current workflow removes npm cache to avoid that failure.

---

## Local Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

---

## Project Structure

```txt
.
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── contracts/
│   └── BaseQuestMilestones.sol
├── public/
│   ├── favicon.svg
│   ├── site.webmanifest
│   ├── nft/
│   │   ├── 1.png
│   │   ├── 2.png
│   │   ├── 3.png
│   │   ├── 4.png
│   │   ├── 5.png
│   │   └── 6.png
│   └── metadata/
├── scripts/
├── src/
│   ├── config.js
│   ├── game.js
│   ├── main.js
│   ├── style.css
│   └── wallet.js
├── hardhat.config.cjs
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## Main Files

### `src/config.js`

Responsible for chain configuration, RPC URL, explorer URL, contract address, WalletConnect Project ID, and contract ABI.

Important line:

```js
walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''
```

### `src/wallet.js`

Responsible for wallet detection, EVM wallet picker, wallet icons, desktop wallet provider selection, mobile deeplink handling, WalletConnect initialization, network switching, balance reading, mint transaction creation, minted milestone checking, and disconnect handling.

### `src/game.js`

Responsible for game loop, character jump, obstacle collision, milestone unlocks, mint-preserve behavior, and restart behavior.

### `src/main.js`

Responsible for UI binding, button handlers, wallet modal UI, mint button state, status messages, mobile tap-to-jump behavior, and mint success NFT preview.

### `src/style.css`

Responsible for main layout, wallet modal design, mobile responsive layout, game panel styling, mint panel styling, and NFT preview modal styling.

---

## Security Notes

This project uses a low-risk mint model:

- No paid mint
- No ERC-20 approval
- No NFT approval
- No token transfer request from players
- No direct ETH acceptance

The user should only see a wallet confirmation for:

```txt
mintMilestone(...)
```

The user should reject any wallet popup that asks for:

- ERC-20 approval
- NFT approval
- Unlimited spending
- Token transfer
- `transferFrom`
- `setApprovalForAll`
- Any unknown contract interaction unrelated to minting

Never commit:

```txt
Private key
Seed phrase
Wallet recovery phrase
RPC admin key
Secret deployment key
```

Safe to expose publicly:

```txt
VITE_CHAIN_ID
VITE_CHAIN_NAME
VITE_RPC_URL
VITE_EXPLORER_URL
VITE_CONTRACT_ADDRESS
VITE_WALLETCONNECT_PROJECT_ID
```

The WalletConnect Project ID is not a private key, but it should still be configured properly with domain/origin settings where possible.

---

## No-Server Anti-Cheat Model

This project is a static frontend with no backend. The anti-cheat model is therefore limited.

It can block casual cheating in the normal website UI, but it is not a full security boundary.

A technical user may bypass the frontend and call the contract directly from Remix, Basescan, a custom script, or another frontend.

For high-value rewards, use a stronger model such as backend signed mint authorization, EIP-712 signed score proofs, on-chain game verification, commit-reveal gameplay, or zero-knowledge / deterministic proof systems.

---

## Known Issues and Limitations

### 1. Mobile wallet browser double-connect behavior

Status:

```txt
Still exists.
```

Description:

On mobile, choosing MetaMask or Trust Wallet from Chrome may open the site inside the wallet internal browser. The user then needs to tap Connect Wallet again inside that wallet browser.

Reason:

The wallet provider is injected inside the wallet browser, not necessarily inside Android Chrome.

Possible future improvements:

- Add clearer UI instructions after mobile deeplink
- Detect wallet browser and auto-open the wallet picker
- Prefer WalletConnect as the default mobile path
- Add a dedicated Open in wallet browser instruction screen
- Use a full AppKit-style modal if the project later adopts a complete wallet UX SDK

### 2. Rabby risk warning

Rabby may show warnings such as:

```txt
Very Low popularity
Not listed on community platforms
```

This is not caused by the dApp code. It is related to domain reputation and wallet-side risk checks.

Recommended improvements:

- Use a custom production domain instead of only GitHub Pages
- Verify domain metadata where available
- Publish project information publicly
- Add clear project links and metadata
- Avoid suspicious redirects
- Keep contract and frontend source public

### 3. WalletConnect Project ID missing

Error:

```txt
WalletConnect Project ID is missing.
```

Cause:

```txt
VITE_WALLETCONNECT_PROJECT_ID is missing in GitHub Variables
VITE_WALLETCONNECT_PROJECT_ID is empty
VITE_WALLETCONNECT_PROJECT_ID is placed in Secrets instead of Variables
deploy-pages.yml does not pass vars.VITE_WALLETCONNECT_PROJECT_ID into env
site was not redeployed after adding the variable
browser is still showing cached old build
```

Fix:

```txt
1. Add VITE_WALLETCONNECT_PROJECT_ID to GitHub Repository Variables.
2. Make sure deploy-pages.yml passes it into env.
3. Deploy again.
4. Hard refresh the site.
```

### 4. GitHub Actions lock file error

Error:

```txt
Dependencies lock file is not found
```

Cause:

The workflow used npm cache but the repository had no `package-lock.json`.

Fix:

Remove:

```yaml
cache: npm
```

from the `actions/setup-node` step.

### 5. Mobile mint popup does not appear

Earlier behavior:

```txt
Preparing mint...
Waiting for wallet...
No wallet gas popup appears
```

Fix implemented:

- Direct transaction request flow
- More persistent mint status messages
- Better error visibility
- Wallet browser support

If this happens again, check wallet network, ETH on Base for gas, contract address, milestone status, provider connection, and WalletConnect session.

---

## Troubleshooting

### The game says a milestone is ready, but the contract rejects the mint

Cause:

```txt
Frontend milestone settings do not match contract milestone settings.
```

Fix:

```txt
1. Check src/game.js.
2. Check getMilestone(n) in Remix.
3. Make both values the same.
```

### NFT images do not show in OpenSea or Element

Common causes:

- `image` field still uses `YOUR_DOMAIN`
- Image URL returns 404
- JSON URL returns 404
- Base URI is wrong
- Missing trailing slash in base URI
- Marketplace metadata is cached

Fix:

```txt
1. Open tokenURI(tokenId).
2. Open the JSON.
3. Open the image URL.
4. Fix JSON if needed.
5. Use setBaseTokenURI if the base path is wrong.
6. Refresh metadata on the marketplace.
```

### Wallet connection fails

Check:

```txt
Browser wallet is installed
Wallet is on the correct chain
VITE_CHAIN_ID is correct
VITE_RPC_URL is correct
VITE_CONTRACT_ADDRESS is set
The deployed contract address is on the same chain as the frontend config
VITE_WALLETCONNECT_PROJECT_ID is available in the build
```

### GitHub Pages still shows the old version

Fix:

```txt
1. Wait for the GitHub Actions workflow to finish.
2. Check that the latest workflow is green.
3. Hard refresh with Command + Shift + R.
4. On mobile, close the browser and reopen the page.
5. Check that repository variables are correct.
```

---

## Testing Checklist

### Desktop

```txt
Open site in Chrome
Hard refresh with Command + Shift + R
Connect MetaMask
Connect Rabby
Connect Coinbase if installed
Open WalletConnect
Confirm QR/modal appears
Play game
Unlock NFT
Mint NFT
Confirm transaction in wallet
Confirm NFT preview appears after mint
Disconnect wallet
Reconnect
```

### Mobile

```txt
Open site in Android Chrome
Tap Connect Wallet
Choose MetaMask or Trust Wallet
Confirm wallet browser opens
Tap Connect Wallet again inside wallet browser
Connect wallet
Play game
Tap anywhere on non-button page area to jump
Unlock NFT
Tap Mint
Confirm gas popup appears
Confirm NFT preview appears after mint
```

### Mobile WalletConnect

```txt
Open site
Tap Connect Wallet
Tap WalletConnect
Confirm WalletConnect modal opens
Choose wallet or scan QR from another device
Connect wallet
Play and mint
```

---

## Cache Notes

After deployment, old files may remain cached.

Desktop hard refresh:

```txt
Command + Shift + R
```

Mobile:

```txt
Close wallet browser tab
Close wallet app if needed
Open site again
```

If still stale:

```txt
Clear site data for jefmark.github.io
```

---

## Reown / WalletConnect Domain Notes

Recommended app URL:

```txt
https://jefmark.github.io/base-quest-milestones/
```

Recommended origin if an allowlist/origin field exists:

```txt
https://jefmark.github.io
```

Correct origin:

```txt
https://jefmark.github.io
```

Full app URL:

```txt
https://jefmark.github.io/base-quest-milestones/
```

---

## Current Final Status

Working:

```txt
Desktop wallet connection
Mobile wallet browser connection
Trust Wallet mobile browser connection
MetaMask mobile browser connection
Minting inside mobile wallet browser
Game milestone unlock flow
Mint-preserve behavior
Mobile tap-to-jump
NFT preview after successful mint
GitHub Pages deployment
```

Still known limitation:

```txt
Mobile deeplink wallets may require two connection taps:
one tap to open the wallet browser,
another tap inside the wallet browser to connect.
```

Primary remaining improvement:

```txt
Improve mobile wallet UX so the second connect step is clearer or avoided where possible.
```

---

## Roadmap

Possible next steps:

- Add a dedicated mobile wallet instruction screen
- Make WalletConnect the recommended mobile path
- Add automatic wallet-browser detection
- Add clearer message after deeplink
- Add custom production domain
- Improve Rabby / wallet reputation by using verified metadata and public project links
- Add `package-lock.json` for deterministic GitHub Actions installs
- Add automated build checks before deploy
- Add transaction hash display after mint
- Add NFT marketplace / BaseScan links after mint
- Farcaster Mini App support
- Vercel deployment
- IPFS-hosted metadata
- Backend signed mint authorization
- EIP-712 score signatures
- Better marketplace refresh workflow
- Leaderboard
- Daily challenges
- Better mobile controls
- Sound and accessibility settings
- Contract verification on Basescan

---

## Official References

- Vite Guide: https://vite.dev/guide/
- Vite Production Build: https://vite.dev/guide/build
- ethers v6 Getting Started: https://docs.ethers.org/v6/getting-started/
- OpenZeppelin ERC-721: https://docs.openzeppelin.com/contracts/5.x/erc721
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- OpenSea Metadata Standards: https://docs.opensea.io/docs/metadata-standards
- OpenSea Contract Metadata: https://docs.opensea.io/docs/contract-level-metadata
- Base Network Details: https://docs.base.org/base-chain/quickstart/connecting-to-base
- GitHub Actions Variables: https://docs.github.com/actions/learn-github-actions/variables
- GitHub Actions Secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- Hardhat Configuration: https://hardhat.org/docs/reference/configuration
- Hardhat Deployment Overview: https://hardhat.org/docs/guides/deployment
- Remix Deploy and Run: https://remix-ide.readthedocs.io/en/latest/run.html
- Reown Cloud: https://cloud.reown.com/
- WalletConnect / Reown Documentation: https://docs.reown.com/

---

## Contact

Have feedback, questions, bug reports, or collaboration ideas?

- X / Twitter: https://x.com/Crypto30724
- Farcaster / Warpcast: https://warpcast.com/crypto30724
- Email: Crypto30724@gmail.com
- GitHub Issues: https://github.com/jefmark/base-quest-milestones/issues

For bug reports, include:

```txt
Device
Browser
Wallet
Network
Screenshot
Transaction hash if available
Steps to reproduce
```

---

## License

MIT License.


are provided for this project and demo use. Unless otherwise stated, the artwork remains owned by the project creator and should not be reused as standalone commercial artwork without permission.
