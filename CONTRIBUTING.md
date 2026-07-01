# Contributing to Base Quest Milestones

Thanks for your interest in contributing to Base Quest Milestones.

This project is a browser-based Base Mainnet NFT runner game. Contributions are welcome for wallet support, mobile UX, game logic, NFT display, documentation, and deployment improvements.

---

## Project Goals

Base Quest Milestones aims to provide:

- A simple browser runner game
- ERC-721 milestone NFT minting on Base Mainnet
- Mobile wallet browser support
- WalletConnect support
- Clean GitHub Pages deployment
- Clear documentation for Web3 beginners and contributors

---

## Ways to Contribute

You can help by:

- Reporting bugs
- Improving mobile wallet connection flows
- Improving WalletConnect behavior
- Improving MetaMask, Trust Wallet, Rabby, Coinbase, OKX, Zerion, and Rainbow support
- Improving the game UI/UX
- Improving mobile tap controls
- Improving mint success NFT preview
- Improving README and documentation
- Adding better error messages
- Adding tests
- Improving smart contract documentation
- Improving NFT metadata or image loading logic

---

## Local Setup

Clone the repository:

```bash
git clone https://github.com/jefmark/base-quest-milestones.git
cd base-quest-milestones
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the production app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## Required Environment Variables

The production GitHub Pages build requires these GitHub repository variables:

```txt
VITE_CHAIN_ID=8453
VITE_CHAIN_NAME=Base
VITE_RPC_URL=https://mainnet.base.org
VITE_EXPLORER_URL=https://basescan.org
VITE_CONTRACT_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_WALLETCONNECT_PROJECT_ID=YOUR_REOWN_PROJECT_ID
```

Do not commit private keys, seed phrases, recovery phrases, or sensitive wallet data.

---

## GitHub Pages Deployment Notes

This project is deployed as a static Vite app on GitHub Pages.

The deployment workflow must pass Vite variables into the build environment. In `.github/workflows/deploy-pages.yml`, make sure the workflow includes:

```yaml
env:
  VITE_CHAIN_ID: ${{ vars.VITE_CHAIN_ID }}
  VITE_CHAIN_NAME: ${{ vars.VITE_CHAIN_NAME }}
  VITE_RPC_URL: ${{ vars.VITE_RPC_URL }}
  VITE_EXPLORER_URL: ${{ vars.VITE_EXPLORER_URL }}
  VITE_CONTRACT_ADDRESS: ${{ vars.VITE_CONTRACT_ADDRESS }}
  VITE_WALLETCONNECT_PROJECT_ID: ${{ vars.VITE_WALLETCONNECT_PROJECT_ID }}
```

If `VITE_WALLETCONNECT_PROJECT_ID` is missing from the workflow, WalletConnect will fail even if the variable exists in GitHub Repository Variables.

Common WalletConnect error:

```txt
WalletConnect Project ID is missing.
```

Common GitHub Actions cache error:

```txt
Dependencies lock file is not found
```

If this happens and the repository does not include a `package-lock.json`, remove npm cache from `actions/setup-node`.

---

## Pull Request Guidelines

Before opening a pull request:

1. Make sure the project builds successfully.

```bash
npm run build
```

2. Test the change on desktop if it affects wallet or UI behavior.

3. Test on mobile if it affects wallet connection, mobile tap controls, or minting.

4. Describe exactly what changed.

5. Include screenshots or screen recordings for UI changes.

6. Mention which wallets were tested.

Recommended PR description:

```txt
## What changed?

## Why?

## How was it tested?

## Wallets tested:
- MetaMask:
- Trust Wallet:
- Rabby:
- WalletConnect:

## Screenshots:
```

---

## Bug Reports

When opening an issue, include:

- Device model
- Operating system
- Browser name
- Wallet name
- Wallet version if known
- Screenshot of the issue
- Error message
- Steps to reproduce
- Expected behavior
- Actual behavior

Example:

```txt
Device: Samsung Android
Browser: Trust Wallet browser
Wallet: Trust Wallet
Network: Base Mainnet

Steps:
1. Open site
2. Connect wallet
3. Play until NFT #1 is mintable
4. Tap Mint
5. Wallet popup does not appear

Expected:
Wallet should open gas confirmation.

Actual:
The page shows "Waiting for wallet" and then nothing happens.
```

---

## Mobile Wallet Notes

Mobile wallet behavior can vary between Android Chrome, MetaMask Mobile, Trust Wallet, and WalletConnect.

Known mobile behavior:

- Opening from Android Chrome may redirect the user into the wallet's internal browser.
- After the site opens inside the wallet browser, the user may need to tap `Connect Wallet` again.
- This happens because mobile wallets usually inject `window.ethereum` only inside their own browser context.
- WalletConnect can be used when the user wants a QR/mobile-session style connection.

When improving mobile wallet UX, test both:

- Normal Android Chrome
- The internal browser inside MetaMask Mobile or Trust Wallet

---

## Good First Issues

Good first contribution areas:

- Improve README wording
- Improve mobile UI spacing
- Add clearer wallet connection instructions
- Add BaseScan transaction links after mint
- Add marketplace links after mint
- Improve NFT preview modal
- Add loading states for wallet actions
- Improve WalletConnect error handling
- Improve mobile wallet deeplink instructions
- Add small UI polish for the wallet picker

---

## Security

Never include:

- Private keys
- Seed phrases
- Recovery phrases
- Sensitive RPC keys
- Admin wallet credentials
- Production secrets

Safe public frontend values include:

```txt
VITE_CHAIN_ID
VITE_CHAIN_NAME
VITE_RPC_URL
VITE_EXPLORER_URL
VITE_CONTRACT_ADDRESS
VITE_WALLETCONNECT_PROJECT_ID
```

The WalletConnect Project ID is not a private key, but the project should still use correct Reown metadata and origin settings where possible.

If you find a security issue, do not open a public issue with exploit details. Contact the maintainer privately first.

---

## Code Style

This project uses:

- JavaScript ES modules
- Vite
- ethers v6
- CSS without a heavy UI framework
- GitHub Pages deployment

Keep changes simple and readable.

Avoid adding heavy dependencies unless clearly necessary.

---

## Testing Checklist

For wallet-related changes, test:

### Desktop

- Chrome with MetaMask
- Chrome with Rabby
- Browser Wallet option
- WalletConnect QR/modal
- Disconnect and reconnect
- Base Mainnet network switch
- Mint flow

### Mobile

- Android Chrome
- MetaMask Mobile browser
- Trust Wallet browser
- WalletConnect mobile flow
- Tap-to-jump behavior
- Mint button behavior
- Mint success NFT preview

---

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License unless otherwise stated.

The source code is released under the MIT License.

NFT artwork, logos, and visual assets may have separate usage restrictions if stated in the README or asset notices.
