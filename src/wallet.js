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

const SUPPORTED_WALLET_METHODS = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

const SUPPORTED_WALLET_EVENTS = [
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

function isMobileBrowser() {
  if (!isBrowser()) return false;
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
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

function shouldFallbackToWalletConnect(err) {
  if (!isMobileBrowser()) return false;

  const message = String(
    err?.shortMessage || err?.message || err?.data?.message || ''
  ).toLowerCase();

  if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') return false;

  return (
    message.includes('unsupported') ||
    message.includes('not supported') ||
    message.includes('provider') ||
    message.includes('wallet') ||
    message.includes('chain') ||
    message.includes('request') ||
    message.includes('method') ||
    message.includes('internal') ||
    message.includes('failed')
  );
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

function providerScore(providerDetail, preferredWallet = 'auto') {
  const provider = providerDetail?.provider;
  const name = String(providerDetail?.info?.name || '').toLowerCase();
  const rdns = String(providerDetail?.info?.rdns || '').toLowerCase();

  if (preferredWallet === 'trust') {
    if (rdns.includes('trust') || name.includes('trust') || provider?.isTrust) return 100;
    if (provider?.isMetaMask) return 10;
  }

  if (preferredWallet === 'metamask') {
    if (rdns.includes('metamask') || name.includes('metamask') || provider?.isMetaMask) return 100;
    if (provider?.isTrust) return 10;
  }

  if (rdns.includes('trust') || name.includes('trust') || provider?.isTrust) return 80;
  if (rdns.includes('metamask') || name.includes('metamask') || provider?.isMetaMask) return 70;
  if (rdns.includes('coinbase') || name.includes('coinbase') || provider?.isCoinbaseWallet) return 60;

  return 50;
}

export function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function getInjectedWallets() {
  if (!isBrowser()) return [];

  const providers = new Map();

  function addProvider(detail) {
    if (!detail?.provider) return;

    const key =
      detail.info?.uuid ||
      detail.info?.rdns ||
      detail.info?.name ||
      String(providers.size + 1);

    providers.set(key, detail);
  }

  function onProvider(event) {
    addProvider(event.detail);
  }

  window.addEventListener('eip6963:announceProvider', onProvider);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  await delay(350);

  window.removeEventListener('eip6963:announceProvider', onProvider);

  if (window.ethereum) {
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

  return Array.from(providers.values());
}

async function pickInjectedProvider(preferredWallet = 'auto') {
  const wallets = await getInjectedWallets();

  if (!wallets.length) return null;

  return wallets.sort(
    (a, b) => providerScore(b, preferredWallet) - providerScore(a, preferredWallet)
  )[0];
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

async function connectWithEip1193Provider(providerDetail, connectionType) {
  const eip1193Provider = providerDetail?.provider || providerDetail;

  if (!eip1193Provider?.request) {
    throw new Error('Selected wallet does not expose an EIP-1193 provider.');
  }

  walletState.eip1193Provider = eip1193Provider;
  walletState.connectionType = connectionType;
  walletState.walletName = providerLabel(providerDetail, connectionType);
  walletState.provider = new BrowserProvider(eip1193Provider);

  attachProviderListeners(eip1193Provider);

  const accounts = await eip1193Provider.request({ method: 'eth_requestAccounts' });
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
      'WalletConnect Project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID in your GitHub Actions variables or .env file.'
    );
  }

  if (!walletConnectProvider) {
    walletConnectProvider = await EthereumProvider.init({
      projectId: CONFIG.walletConnectProjectId,
      metadata: walletConnectMetadata(),
      showQrModal: true,
      optionalChains: [CONFIG.chainId],
      optionalMethods: SUPPORTED_WALLET_METHODS,
      optionalEvents: SUPPORTED_WALLET_EVENTS,
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

export async function connectInjectedWallet(preferredWallet = 'auto') {
  const providerDetail = await pickInjectedProvider(preferredWallet);

  if (!providerDetail) {
    throw new Error('No injected wallet was found in this browser. Use WalletConnect on mobile browsers.');
  }

  return connectWithEip1193Provider(providerDetail, 'injected');
}

export async function connectWalletConnect() {
  const provider = await getWalletConnectProvider();

  if (!provider.session) {
    await provider.connect();
  }

  return connectWithEip1193Provider(
    {
      provider,
      info: {
        name: provider.session?.peer?.metadata?.name || 'WalletConnect',
        rdns: 'walletconnect',
      },
    },
    'walletconnect'
  );
}

export async function connectWallet(options = {}) {
  const preferredWallet = options.preferredWallet || 'auto';
  const mode = options.mode || 'auto';

  if (mode === 'walletconnect') {
    return connectWalletConnect();
  }

  if (mode === 'injected') {
    return connectInjectedWallet(preferredWallet);
  }

  const injected = await pickInjectedProvider(preferredWallet);

  if (injected) {
    try {
      return await connectWithEip1193Provider(injected, 'injected');
    } catch (err) {
      if (!shouldFallbackToWalletConnect(err)) {
        throw normalizeRpcError(err, 'Injected wallet connection failed.');
      }

      console.warn('Injected mobile wallet failed. Falling back to WalletConnect.', err);
    }
  }

  return connectWalletConnect();
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
