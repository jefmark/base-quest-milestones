# Security Policy

## Wallet Safety

This app is designed to be non-custodial and low-risk:

- The game frontend never asks users to approve ERC-20 tokens.
- The contract mint function is not payable.
- The contract does not transfer tokens or NFTs from players.
- Users should reject any wallet popup that asks for token approval, unlimited allowance, asset transfer, or an unknown contract call.

## Owner Safety

Use a fresh deployer wallet with only enough ETH for gas. Do not put your main wallet private key in `.env`.

After testing, you may keep ownership in the deployer wallet or transfer ownership to a safer wallet/multisig. If you transfer ownership, test on Base Sepolia first.

## No-Server Limitation

This project has no backend server. Browser-only score checks can reduce casual spam, but they cannot fully prevent cheating. Do not attach high-value financial rewards to browser-only scores without a backend verifier, signed score system, or other anti-cheat design.

## Reporting Issues

Open a private security advisory or contact the project owner directly. Do not publicly post exploitable vulnerabilities before they are patched.
