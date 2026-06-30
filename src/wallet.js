import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { base } from '@reown/appkit/networks';

import { CONFIG, CONTRACT_ABI } from './config.js';

export const walletState = {
  account: '',
  provider: null,
  signer: null,
  contract: null,
  chainOk: false,
  eip1193Provider: null,
  connectionType: '',
  walletName: '',
};

const REQUIRED_WALLET_METHODS = [
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

const REQUIRED_WALLET_EVENTS = [
  'accountsChanged',
  'chainChanged',
  'disconnect',
];

let appKitModal = null;
let unsubscribeProvider = null;
let unsubscribeWalletInfo = null;
let removeProviderListeners = [];
let lastWalletInfo = null;

const toHexChainId = (chainId) => `0x${Number(chainId).toString(16)}`;
const normalizeHex = (value) => String(value || '').toLowerCase();

function isBrowser() {
  return typeof window !== 'undefined';
}

function emitWalletChanged() {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent('bqm-wallet-changed', {
      detail: {
        account: walletState.account,
        chainOk: walletState.chainOk,
        connectionType: walletState.connectionType,
        walletName: walletState.walletName,
      },
    })
  );
}

function normalizeRpcError(err, fallbackMessage = 'Wallet request failed.') {
  const message =
    err?.shortMessage ||
    err?.reason ||
    err?.message ||
    err?.data?.message ||
    fallbackMessage;

  const normalized = new Error(message);
  normalized.code = err?.code;
  normalized.cause = err;
  return normalized;
}

function walletConnectMetadata() {
  const basePath = import.meta.env.BASE_URL || '/';
  const origin = isBrowser() ? window.location.origin : 'https://jefmark.github.io';
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const appUrl = `${origin}${normalizedBase}`;
  const iconUrl = `${appUrl}nft/1.png`;

  return {
    name: 'Base Quest Milestones',
    description: 'Base Mainnet NFT milestone runner game',
    url: appUrl,
    icons: [iconUrl],
  };
}

function createContractIfReady() {
  if (!CONFIG.contractAddress || !walletState.signer) {
    walletState.contract = null;
    return null;
  }

  walletState.contract = new Contract(
    CONFIG.contractAddress,
    CONTRACT_ABI,
    walletState.signer
  );

  return walletState.contract;
}

function clearProviderListeners() {
  for (const remove of removeProviderListeners) {
    try {
      remove();
    } catch {
      // Some providers do not expose reliable remove APIs.
    }
  }

  removeProviderListeners = [];
}

function listen(provider, eventName, handler) {
  if (!provider?.on) return;

  provider.on(eventName, handler);

  removeProviderListeners.push(() => {
    if (provider.removeListener) provider.removeListener(eventName, handler);
    else if (provider.off) provider.off(eventName, handler);
  });
}

function resetWalletState(keepProvider = false) {
  walletState.account = '';
  walletState.provider = null;
  walletState.signer = null;
  walletState.contract = null;
  walletState.chainOk = false;
  walletState.connectionType = '';
  walletState.walletName = '';

  if (!keepProvider) {
    walletState.eip1193Provider = null;
  }
}

function walletNameFromInfo(fallback = 'Wallet') {
  return lastWalletInfo?.name || fallback;
}

async function refreshSignerAndContract() {
  if (!walletState.eip1193Provider) return;

  walletState.provider = new BrowserProvider(walletState.eip1193Provider);

  const accounts = await walletState.eip1193Provider
    .request({ method: 'eth_accounts' })
    .catch(() => []);

  walletState.account = accounts?.[0] || walletState.account;

  if (walletState.account) {
    walletState.signer = await walletState.provider.getSigner();
    createContractIfReady();
  }
}

function attachProviderListeners(provider) {
  clearProviderListeners();

  listen(provider, 'accountsChanged', async (accounts) => {
    walletState.account = accounts?.[0] || '';

    if (!walletState.account) {
      walletState.signer = null;
      walletState.contract = null;
    } else if (walletState.provider) {
      walletState.signer = await walletState.provider.getSigner().catch(() => null);
      createContractIfReady();
    }

    emitWalletChanged();
  });

  listen(provider, 'chainChanged', async () => {
    try {
      await refreshSignerAndContract();
      await ensureCorrectNetwork();
    } catch (err) {
      walletState.chainOk = false;
      console.warn('Chain change handling failed:', err);
    }

    emitWalletChanged();
  });

  listen(provider, 'disconnect', () => {
    resetWalletState(false);
    emitWalletChanged();
  });
}

async function syncFromAppKitState(state = {}) {
  const modal = getAppKitModal();
  const provider = state.provider || modal.getWalletProvider?.() || modal.getProviders?.()?.eip155 || null;
  const address = state.address || modal.getAddress?.() || '';
  const isConnected = Boolean(state.isConnected ?? modal.getIsConnected?.());

  if (!isConnected || !provider || !address) {
    resetWalletState(false);
    emitWalletChanged();
    return;
  }

  walletState.eip1193Provider = provider;
  walletState.connectionType = modal.getWalletProviderType?.() || 'appkit';
  walletState.walletName = walletNameFromInfo(walletState.connectionType);
  walletState.provider = new BrowserProvider(provider);
  walletState.account = address;

  attachProviderListeners(provider);

  try {
    await ensureCorrectNetwork();
    await refreshSignerAndContract();
  } catch (err) {
    walletState.chainOk = false;
    console.warn('Network check failed:', err);
  }

  emitWalletChanged();
}

function getBaseNetwork() {
  // Use Reown's official Base definition, but keep your RPC/explorer in config for ethers calls and fallback switching.
  return base;
}

export function getAppKitModal() {
  if (appKitModal) return appKitModal;

  if (!CONFIG.walletConnectProjectId) {
    throw new Error(
      'WalletConnect Project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID in GitHub Actions variables and deploy again.'
    );
  }

  const baseNetwork = getBaseNetwork();

  appKitModal = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [baseNetwork],
    defaultNetwork: baseNetwork,
    metadata: walletConnectMetadata(),
    projectId: CONFIG.walletConnectProjectId,
    enableWallets: true,
    enableNetworkSwitch: false,
    enableReconnect: true,
    enableMobileFullScreen: true,
    enableWalletGuide: true,
    allowUnsupportedChain: false,
    allWallets: 'SHOW',
    defaultAccountTypes: { eip155: 'eoa' },
    coinbasePreference: 'eoaOnly',
    customRpcUrls: {
      [`eip155:${CONFIG.chainId}`]: [{ url: CONFIG.rpcUrl }],
    },
    universalProviderConfigOverride: {
      methods: { eip155: REQUIRED_WALLET_METHODS },
      optionalMethods: { eip155: REQUIRED_WALLET_METHODS },
      chains: { eip155: [String(CONFIG.chainId)] },
      optionalChains: { eip155: [String(CONFIG.chainId)] },
      events: { eip155: REQUIRED_WALLET_EVENTS },
      optionalEvents: { eip155: REQUIRED_WALLET_EVENTS },
      rpcMap: {
        [CONFIG.chainId]: CONFIG.rpcUrl,
      },
      defaultChain: `eip155:${CONFIG.chainId}`,
    },
    features: {
      analytics: true,
      swaps: false,
      onramp: false,
      email: false,
      socials: false,
      connectMethodsOrder: ['wallet'],
    },
    themeMode: 'dark',
  });

  appKitModal.setThemeMode?.('dark');

  unsubscribeProvider = appKitModal.subscribeProvider?.((state) => {
    void syncFromAppKitState(state);
  });

  unsubscribeWalletInfo = appKitModal.subscribeWalletInfo?.((info) => {
    lastWalletInfo = info || null;
    if (walletState.account) {
      walletState.walletName = walletNameFromInfo(walletState.connectionType || 'Wallet');
      emitWalletChanged();
    }
  });

  void syncFromAppKitState();

  return appKitModal;
}

export function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function openWalletModal() {
  const modal = getAppKitModal();

  // Always open Reown's wallet list, on both desktop and mobile.
  // namespace eip155 = Ethereum/EVM only. This prevents Solana/Bitcoin wallet flows for this Base dApp.
  await modal.open({ view: 'Connect', namespace: 'eip155' });
}

export async function openAccountModal() {
  const modal = getAppKitModal();
  await modal.open({ view: 'Account', namespace: 'eip155' });
}

export async function connectWallet() {
  await openWalletModal();
}

export async function ensureCorrectNetwork() {
  const activeProvider = walletState.eip1193Provider;

  if (!activeProvider?.request) return false;

  const target = toHexChainId(CONFIG.chainId);
  const current = await activeProvider.request({ method: 'eth_chainId' }).catch(() => null);

  if (normalizeHex(current) === normalizeHex(target)) {
    walletState.chainOk = true;
    return true;
  }

  try {
    await activeProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target }],
    });
  } catch (err) {
    if (err?.code === 4902 || String(err?.message || '').includes('4902')) {
      await activeProvider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: target,
            chainName: CONFIG.chainName,
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: [CONFIG.rpcUrl],
            blockExplorerUrls: [CONFIG.explorerUrl],
          },
        ],
      });
    } else {
      throw normalizeRpcError(
        err,
        `Please switch your wallet network to ${CONFIG.chainName}.`
      );
    }
  }

  const afterSwitch = await activeProvider
    .request({ method: 'eth_chainId' })
    .catch(() => target);

  walletState.chainOk = normalizeHex(afterSwitch) === normalizeHex(target);

  if (!walletState.chainOk) {
    throw new Error(`Wallet is connected, but it is not on ${CONFIG.chainName}.`);
  }

  walletState.provider = new BrowserProvider(activeProvider);
  walletState.signer = await walletState.provider.getSigner();
  createContractIfReady();

  return true;
}

async function bestEffortRevokePermissions(provider) {
  if (!provider?.request) return false;

  try {
    await provider.request({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    });
    return true;
  } catch (err) {
    // Not all wallets support wallet_revokePermissions. AppKit/WalletConnect disconnect still runs below.
    console.info('Wallet permission revoke is not supported or was rejected by this wallet:', err);
    return false;
  }
}

export async function disconnectWallet() {
  const provider = walletState.eip1193Provider;
  let revoked = false;

  clearProviderListeners();

  // Best effort: MetaMask and some EVM wallets support revoking eth_accounts permission.
  // This removes the site from the wallet's connected dapps when the wallet supports it.
  revoked = await bestEffortRevokePermissions(provider);

  try {
    const modal = getAppKitModal();

    if (typeof modal.disconnect === 'function') {
      await modal.disconnect();
    } else if (modal.adapter?.connectionControllerClient?.disconnect) {
      await modal.adapter.connectionControllerClient.disconnect();
    }
  } catch (err) {
    console.warn('AppKit disconnect failed:', err);
  }

  try {
    if (provider?.disconnect) await provider.disconnect();
    else if (provider?.close) await provider.close();
  } catch (err) {
    console.warn('Provider disconnect/close failed:', err);
  }

  if (typeof unsubscribeProvider === 'function') {
    // Keep the subscription active only by re-creating AppKit on the next open.
    try { unsubscribeProvider(); } catch {}
    unsubscribeProvider = null;
  }

  if (typeof unsubscribeWalletInfo === 'function') {
    try { unsubscribeWalletInfo(); } catch {}
    unsubscribeWalletInfo = null;
  }

  appKitModal = null;
  lastWalletInfo = null;

  resetWalletState(false);
  emitWalletChanged();

  return { revoked };
}

export async function getBalanceText() {
  if (!walletState.provider || !walletState.account) return '';

  const balance = await walletState.provider.getBalance(walletState.account);
  return `${Number(formatUnits(balance, 18)).toFixed(5)} ETH`;
}

export async function mintMilestone(milestone, score, playSeconds) {
  if (!walletState.account) {
    throw new Error('Connect your wallet first.');
  }

  if (!CONFIG.contractAddress) {
    throw new Error('Contract address is not configured yet.');
  }

  await ensureCorrectNetwork();

  if (!walletState.contract) {
    createContractIfReady();
  }

  const alreadyMinted = await walletState.contract.hasMintedMilestone(
    walletState.account,
    milestone
  );

  if (alreadyMinted) {
    throw new Error('You already minted this milestone.');
  }

  const tx = await walletState.contract.mintMilestone(
    milestone,
    Math.floor(score),
    Math.floor(playSeconds)
  );

  const receipt = await tx.wait();

  return { hash: receipt.hash };
}
