import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { CONFIG, CONTRACT_ABI } from './config.js';

export const walletState = {
  account: '',
  provider: null,
  signer: null,
  contract: null,
  chainOk: false,
};

const toHexChainId = (chainId) => `0x${Number(chainId).toString(16)}`;

export function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('No wallet found. Install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.');
  }

  walletState.provider = new BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  walletState.signer = await walletState.provider.getSigner();
  walletState.account = await walletState.signer.getAddress();
  await ensureCorrectNetwork();

  if (CONFIG.contractAddress) {
    walletState.contract = new Contract(CONFIG.contractAddress, CONTRACT_ABI, walletState.signer);
  }

  return { ...walletState };
}

export async function ensureCorrectNetwork() {
  if (!window.ethereum) return false;
  const target = toHexChainId(CONFIG.chainId);
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current?.toLowerCase() === target.toLowerCase()) {
    walletState.chainOk = true;
    return true;
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: target,
          chainName: CONFIG.chainName,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [CONFIG.rpcUrl],
          blockExplorerUrls: [CONFIG.explorerUrl],
        }],
      });
    } else {
      throw err;
    }
  }

  walletState.provider = new BrowserProvider(window.ethereum);
  walletState.signer = await walletState.provider.getSigner();
  walletState.chainOk = true;
  return true;
}

export async function getBalanceText() {
  if (!walletState.provider || !walletState.account) return '';
  const balance = await walletState.provider.getBalance(walletState.account);
  return `${Number(formatUnits(balance, 18)).toFixed(5)} ETH`;
}

export async function mintMilestone(milestone, score, playSeconds) {
  if (!walletState.contract) throw new Error('Contract address is not configured yet.');
  await ensureCorrectNetwork();
  const alreadyMinted = await walletState.contract.hasMintedMilestone(walletState.account, milestone);
  if (alreadyMinted) throw new Error('You already minted this milestone.');
  const tx = await walletState.contract.mintMilestone(milestone, Math.floor(score), Math.floor(playSeconds));
  const receipt = await tx.wait();
  return { hash: receipt.hash };
}
