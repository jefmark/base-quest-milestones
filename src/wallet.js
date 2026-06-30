import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

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

let walletConnectProvider = null;
let removeProviderListeners = [];

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
      // Some injected providers do not expose reliable remove APIs.
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

function providerLabel(providerDetail, fallback = 'Injected Wallet') {
  const info = providerDetail?.info;
  return info?.name || providerDetail?.provider?.name || fallback;
}

function providerIdentity(providerDetail) {
  const provider = providerDetail?.provider;
  const name = String(providerDetail?.info?.name || provider?.name || '').toLowerCase();
  const rdns = String(providerDetail?.info?.rdns || '').toLowerCase();

  return { provider, name, rdns };
}

function isMetaMaskProvider(providerDetail) {
  const { provider, name, rdns } = providerIdentity(providerDetail);
  return rdns.includes('metamask') || name.includes('metamask') || provider?.isMetaMask === true;
}

function isTrustProvider(providerDetail) {
  const { provider, name, rdns } = providerIdentity(providerDetail);
  return rdns.includes('trust') || name.includes('trust') || provider?.isTrust === true;
}

function isCoinbaseProvider(providerDetail) {
  const { provider, name, rdns } = providerIdentity(providerDetail);
  return rdns.includes('coinbase') || name.includes('coinbase') || provider?.isCoinbaseWallet === true;
}

function isKeplrLikeProvider(providerDetail) {
  const { name, rdns } = providerIdentity(providerDetail);
  return rdns.includes('keplr') || name.includes('keplr');
}

function walletMatches(providerDetail, walletId) {
  if (walletId === 'metamask') return isMetaMaskProvider(providerDetail);
  if (walletId === 'trust') return isTrustProvider(providerDetail);
  if (walletId === 'coinbase') return isCoinbaseProvider(providerDetail);
  return false;
}

function providerScore(providerDetail) {
  if (isMetaMaskProvider(providerDetail)) return 100;
  if (isTrustProvider(providerDetail)) return 95;
  if (isCoinbaseProvider(providerDetail)) return 90;
  if (isKeplrLikeProvider(providerDetail)) return 5;
  return 50;
}

function providerKey(providerDetail, fallbackIndex = 0) {
  const { provider } = providerIdentity(providerDetail);

  return (
    providerDetail?.info?.uuid ||
    providerDetail?.info?.rdns ||
    providerDetail?.info?.name ||
    provider?.id ||
    provider?.name ||
    `wallet-${fallbackIndex}`
  );
}

export function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function getInjectedWallets() {
  if (!isBrowser()) return [];

  const providers = new Map();

  function addProvider(detail) {
    if (!detail?.provider?.request) return;

    const key = providerKey(detail, providers.size + 1);
    providers.set(key, detail);
  }

  function onProvider(event) {
    addProvider(event.detail);
  }

  window.addEventListener('eip6963:announceProvider', onProvider);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  await delay(450);

  window.removeEventListener('eip6963:announceProvider', onProvider);

  if (window.ethereum?.request) {
    if (Array.isArray(window.ethereum.providers)) {
      for (const provider of window.ethereum.providers) {
        addProvider({
          provider,
          info: {
            name:
              provider.isTrust ? 'Trust Wallet' :
              provider.isMetaMask ? 'MetaMask' :
              provider.isCoinbaseWallet ? 'Coinbase Wallet' :
              'Injected Wallet',
            rdns:
              provider.isTrust ? 'com.trustwallet.app' :
              provider.isMetaMask ? 'io.metamask' :
              provider.isCoinbaseWallet ? 'com.coinbase.wallet' :
              'injected',
          },
        });
      }
    } else {
      addProvider({
        provider: window.ethereum,
        info: {
          name:
            window.ethereum.isTrust ? 'Trust Wallet' :
            window.ethereum.isMetaMask ? 'MetaMask' :
            window.ethereum.isCoinbaseWallet ? 'Coinbase Wallet' :
            'Injected Wallet',
          rdns:
            window.ethereum.isTrust ? 'com.trustwallet.app' :
            window.ethereum.isMetaMask ? 'io.metamask' :
            window.ethereum.isCoinbaseWallet ? 'com.coinbase.wallet' :
            'injected',
        },
      });
    }
  }

  return Array.from(providers.values())
    .sort((a, b) => providerScore(b) - providerScore(a));
}

export async function getWalletChoices() {
  const injectedWallets = await getInjectedWallets();
  const choices = [];
  const usedKeys = new Set();

  function pushInjectedChoice(walletId, label, providerDetail) {
    if (!providerDetail) return;

    const key = providerKey(providerDetail, choices.length + 1);
    if (usedKeys.has(key)) return;

    usedKeys.add(key);
    choices.push({
      id: `${walletId}:${key}`,
      type: 'injected',
      walletId,
      label,
      providerDetail,
    });
  }

  pushInjectedChoice(
    'metamask',
    'MetaMask',
    injectedWallets.find(isMetaMaskProvider)
  );

  pushInjectedChoice(
    'trust',
    'Trust Wallet',
    injectedWallets.find(isTrustProvider)
  );

  pushInjectedChoice(
    'coinbase',
    'Coinbase Wallet',
    injectedWallets.find(isCoinbaseProvider)
  );

  for (const detail of injectedWallets) {
    if (isMetaMaskProvider(detail) || isTrustProvider(detail) || isCoinbaseProvider(detail)) {
      continue;
    }

    // Keplr is usually not the wallet the user wants for a Base EVM dApp. Do not auto-show it
    // unless it is the only EIP-1193 provider in the browser.
    if (isKeplrLikeProvider(detail) && injectedWallets.length > 1) {
      continue;
    }

    pushInjectedChoice('browser', providerLabel(detail, 'Browser Wallet'), detail);
  }

  choices.push({
    id: 'walletconnect',
    type: 'walletconnect',
    walletId: 'walletconnect',
    label: 'WalletConnect / Mobile Wallets',
    providerDetail: null,
  });

  return choices;
}

async function pickInjectedProvider(walletId = 'auto') {
  const wallets = await getInjectedWallets();

  if (!wallets.length) return null;

  if (walletId !== 'auto' && walletId !== 'browser') {
    return wallets.find((wallet) => walletMatches(wallet, walletId)) || null;
  }

  if (walletId === 'browser') {
    return wallets.find((wallet) => !isKeplrLikeProvider(wallet)) || wallets[0] || null;
  }

  return wallets.find((wallet) => !isKeplrLikeProvider(wallet)) || wallets[0] || null;
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

async function connectWithEip1193Provider(providerDetail, connectionType, preapprovedAccounts = null) {
  const eip1193Provider = providerDetail?.provider || providerDetail;

  if (!eip1193Provider?.request) {
    throw new Error('Selected wallet does not expose an EIP-1193 provider.');
  }

  walletState.eip1193Provider = eip1193Provider;
  walletState.connectionType = connectionType;
  walletState.walletName = providerLabel(providerDetail, connectionType);
  walletState.provider = new BrowserProvider(eip1193Provider);

  attachProviderListeners(eip1193Provider);

  let accounts = preapprovedAccounts;

  if (!accounts?.length) {
    accounts = await eip1193Provider.request({ method: 'eth_requestAccounts' });
  }

  walletState.account = accounts?.[0] || '';

  if (!walletState.account) {
    throw new Error('Wallet connected, but no account was returned.');
  }

  await ensureCorrectNetwork();
  await refreshSignerAndContract();

  emitWalletChanged();

  return { ...walletState };
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

async function getWalletConnectProvider() {
  if (!CONFIG.walletConnectProjectId) {
    throw new Error(
      'WalletConnect Project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID in GitHub Actions variables and deploy again.'
    );
  }

  if (!walletConnectProvider) {
    walletConnectProvider = await EthereumProvider.init({
      projectId: CONFIG.walletConnectProjectId,
      metadata: walletConnectMetadata(),
      showQrModal: true,
      chains: [CONFIG.chainId],
      optionalChains: [CONFIG.chainId],
      methods: REQUIRED_WALLET_METHODS,
      optionalMethods: REQUIRED_WALLET_METHODS,
      events: REQUIRED_WALLET_EVENTS,
      optionalEvents: REQUIRED_WALLET_EVENTS,
      rpcMap: {
        [CONFIG.chainId]: CONFIG.rpcUrl,
      },
      qrModalOptions: {
        themeMode: 'dark',
      },
    });
  }

  return walletConnectProvider;
}

export async function connectInjectedWallet(walletId = 'auto') {
  const providerDetail = await pickInjectedProvider(walletId);

  if (!providerDetail) {
    if (walletId === 'metamask') {
      throw new Error('MetaMask was not found in this browser. Use WalletConnect on mobile browsers, or install MetaMask extension on desktop.');
    }

    if (walletId === 'trust') {
      throw new Error('Trust Wallet injected provider was not found. Use WalletConnect to connect Trust Wallet on mobile.');
    }

    throw new Error('No browser wallet was found. Use WalletConnect on mobile browsers.');
  }

  return connectWithEip1193Provider(providerDetail, 'injected');
}

export async function connectWalletConnect() {
  const provider = await getWalletConnectProvider();
  let accounts = [];

  try {
    // enable() reliably opens the WalletConnect modal and returns accounts after approval.
    accounts = await provider.enable();
  } catch (err) {
    throw normalizeRpcError(err, 'WalletConnect connection was cancelled or failed.');
  }

  return connectWithEip1193Provider(
    {
      provider,
      info: {
        name: provider.session?.peer?.metadata?.name || 'WalletConnect',
        rdns: 'walletconnect',
      },
    },
    'walletconnect',
    accounts
  );
}

export async function connectWallet(options = {}) {
  const walletId = options.walletId || 'auto';
  const providerDetail = options.providerDetail || null;

  if (walletId === 'walletconnect') {
    return connectWalletConnect();
  }

  if (providerDetail) {
    return connectWithEip1193Provider(providerDetail, 'injected');
  }

  return connectInjectedWallet(walletId);
}

export async function ensureCorrectNetwork() {
  const activeProvider = walletState.eip1193Provider;

  if (!activeProvider?.request) return false;

  const target = toHexChainId(CONFIG.chainId);
  const current = await activeProvider.request({ method: 'eth_chainId' });

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

export async function disconnectWallet() {
  const provider = walletState.eip1193Provider;
  const shouldDisconnectSession = walletState.connectionType === 'walletconnect';

  clearProviderListeners();

  try {
    if (shouldDisconnectSession && provider?.disconnect) {
      await provider.disconnect();
    }
  } catch (err) {
    console.warn('WalletConnect disconnect failed:', err);
  }

  resetWalletState(false);
  emitWalletChanged();
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
