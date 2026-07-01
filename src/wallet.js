import { BrowserProvider, Contract, Interface, formatUnits } from 'ethers';
import EthereumProvider from '@walletconnect/ethereum-provider';

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

const BASE_CHAIN_ID = CONFIG.chainId || 8453;
const BASE_CAIP_CHAIN_ID = `eip155:${BASE_CHAIN_ID}`;
const WALLETCONNECT_ID = 'walletconnect';
const BROWSER_WALLET_ID = 'browser';

const REQUIRED_METHODS = [
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

const REQUIRED_EVENTS = [
  'accountsChanged',
  'chainChanged',
  'disconnect',
];

const KNOWN_WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    subtitle: 'Popular EVM wallet',
    rdns: ['io.metamask'],
    flags: ['isMetaMask'],
    desktopInstallUrl: 'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
    mobileOpenUrl: (url) => `https://metamask.app.link/dapp/${stripProtocol(url)}`,
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    subtitle: 'Mobile and browser wallet',
    rdns: ['com.trustwallet.app', 'com.trustwallet', 'com.trustwallet.wallet'],
    flags: ['isTrust', 'isTrustWallet'],
    desktopInstallUrl: 'https://trustwallet.com/browser-extension',
    mobileOpenUrl: (url) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    subtitle: 'Coinbase EVM wallet',
    rdns: ['com.coinbase.wallet'],
    flags: ['isCoinbaseWallet'],
    desktopInstallUrl: 'https://www.coinbase.com/wallet/downloads',
    mobileOpenUrl: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    subtitle: 'Desktop EVM wallet with transaction simulation. GitHub Pages domains may show Rabby reputation warnings.',
    rdns: ['io.rabby', 'io.rabby.wallet'],
    flags: ['isRabby'],
    desktopInstallUrl: 'https://rabby.io/',
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    subtitle: 'EVM mobile wallet',
    rdns: ['me.rainbow'],
    flags: ['isRainbow'],
    desktopInstallUrl: 'https://rainbow.me/',
    mobileOpenUrl: (url) => `https://rnbwapp.com/wc?uri=${encodeURIComponent(url)}`,
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    subtitle: 'EVM browser wallet',
    rdns: ['com.okex.wallet', 'com.okx.wallet'],
    flags: ['okxwallet', 'isOkxWallet'],
    desktopInstallUrl: 'https://www.okx.com/web3',
  },
  {
    id: 'zerion',
    name: 'Zerion Wallet',
    subtitle: 'EVM wallet',
    rdns: ['io.zerion.wallet'],
    flags: ['isZerion'],
    desktopInstallUrl: 'https://zerion.io/wallet',
  },
  {
    id: BROWSER_WALLET_ID,
    name: 'Browser Wallet',
    subtitle: 'Use the active injected EVM provider',
    rdns: [],
    flags: [],
  },
];


const svgToDataUri = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const INLINE_WALLET_ICONS = {
  metamask: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#fff3e6"/><path d="M11 18l17-9 8 7-5 8-9-2z" fill="#e27625"/><path d="M53 18L36 9l-8 7 5 8 9-2z" fill="#e27625"/><path d="M22 23l9 4-3 8-10-3z" fill="#f6851b"/><path d="M42 23l-9 4 3 8 10-3z" fill="#f6851b"/><path d="M28 35l4 3 4-3 7 4-5 8-6-3-6 3-5-8z" fill="#c0ad9e"/><path d="M18 32l10 3-2 12-8-6z" fill="#763d16"/><path d="M46 32l-10 3 2 12 8-6z" fill="#763d16"/><path d="M26 47l6-3 6 3-2 5h-8z" fill="#f6851b"/></svg>`),
  trust: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#3375bb"/><path d="M32 10l17 7v12c0 11-6.7 20.5-17 24.8C21.7 49.5 15 40 15 29V17z" fill="#fff"/><path d="M32 18l10 4v7c0 6.4-3.7 12.4-10 15.7C25.7 41.4 22 35.4 22 29v-7z" fill="#3375bb"/></svg>`),
  coinbase: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0052ff"/><circle cx="32" cy="32" r="20" fill="#fff"/><circle cx="32" cy="32" r="9" fill="#0052ff"/></svg>`),
  rabby: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#6c5ce7"/><path d="M22 23c-4-8 0-14 5-14 4 0 5 5 3 13z" fill="#fff"/><path d="M42 23c4-8 0-14-5-14-4 0-5 5-3 13z" fill="#fff"/><circle cx="32" cy="36" r="15" fill="#fff"/><circle cx="27" cy="34" r="2.5" fill="#6c5ce7"/><circle cx="37" cy="34" r="2.5" fill="#6c5ce7"/><path d="M27 42c3.2 2.2 6.8 2.2 10 0" stroke="#6c5ce7" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`),
  rainbow: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#fff"/><path d="M14 41a18 18 0 0136 0" stroke="#ff4d4d" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M20 41a12 12 0 0124 0" stroke="#ffb84d" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M26 41a6 6 0 0112 0" stroke="#4d79ff" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`),
  okx: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#111"/><g fill="#fff"><rect x="14" y="14" width="11" height="11" rx="2"/><rect x="39" y="14" width="11" height="11" rx="2"/><rect x="26.5" y="26.5" width="11" height="11" rx="2"/><rect x="14" y="39" width="11" height="11" rx="2"/><rect x="39" y="39" width="11" height="11" rx="2"/></g></svg>`),
  zerion: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2962ff"/><path d="M18 21h29L18 43h29" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`),
  browser: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0f172a"/><rect x="12" y="16" width="40" height="32" rx="8" fill="#fff"/><circle cx="21" cy="24" r="2.5" fill="#60a5fa"/><circle cx="28" cy="24" r="2.5" fill="#34d399"/><circle cx="35" cy="24" r="2.5" fill="#f59e0b"/><path d="M19 33h26M19 39h17" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/></svg>`),
  walletconnect: svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#3b99fc"/><path d="M19 27c7.3-7.1 18.7-7.1 26 0l3 3a2 2 0 010 2.8l-3 3a1.4 1.4 0 01-2 0l-4-4c-4-3.9-10-3.9-14 0l-4 4a1.4 1.4 0 01-2 0l-3-3a2 2 0 010-2.8z" fill="#fff"/><path d="M26 36c3.5-3.2 8.5-3.2 12 0l1 1-4 4-1-1a3 3 0 00-4 0l-1 1-4-4z" fill="#fff"/></svg>`),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeWalletIconSrc(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:image\/|https:\/\/|http:\/\/)/i.test(raw)) return raw;
  return '';
}

function walletIconFor(wallet, installedProvider) {
  const providerIcon = safeWalletIconSrc(installedProvider?.info?.icon || installedProvider?.provider?.icon);
  if (providerIcon) return providerIcon;

  const id = normalize(wallet?.id || wallet?.name);
  if (id.includes('metamask')) return INLINE_WALLET_ICONS.metamask;
  if (id.includes('trust')) return INLINE_WALLET_ICONS.trust;
  if (id.includes('coinbase')) return INLINE_WALLET_ICONS.coinbase;
  if (id.includes('rabby')) return INLINE_WALLET_ICONS.rabby;
  if (id.includes('rainbow')) return INLINE_WALLET_ICONS.rainbow;
  if (id.includes('okx')) return INLINE_WALLET_ICONS.okx;
  if (id.includes('zerion')) return INLINE_WALLET_ICONS.zerion;
  if (id.includes('walletconnect')) return INLINE_WALLET_ICONS.walletconnect;
  return INLINE_WALLET_ICONS.browser;
}

let walletConnectProvider = null;
let discoveredProviders = [];
let discoveryPromise = null;
let removeProviderListeners = [];
let pickerRoot = null;
let pickerState = {
  isConnecting: false,
  selectedWalletId: '',
  message: '',
};

const toHexChainId = (chainId) => `0x${Number(chainId).toString(16)}`;
const normalize = (value) => String(value || '').toLowerCase();

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isMobile() {
  if (!isBrowser()) return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function currentDappUrl() {
  if (!isBrowser()) return 'https://jefmark.github.io/base-quest-milestones/';
  return window.location.href;
}

function stripProtocol(url) {
  return String(url).replace(/^https?:\/\//i, '');
}

function openMobileWalletDeepLink(url) {
  if (!isBrowser()) return;

  // Mobile browsers are strict about popups. Navigating the current tab is the
  // most reliable way to trigger MetaMask/Trust/Coinbase universal links.
  const link = String(url);
  const anchor = document.createElement('a');
  anchor.href = link;
  anchor.target = '_self';
  anchor.rel = 'noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    try {
      window.location.assign(link);
    } catch {
      window.location.href = link;
    }
  }, 80);
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


function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function isMobileInjectedWallet() {
  if (!isMobile()) return false;
  const provider = walletState.eip1193Provider;
  const name = normalize(walletState.walletName);
  const ua = isBrowser() ? normalize(window.navigator.userAgent) : '';

  return Boolean(
    provider?.isTrust ||
    provider?.isTrustWallet ||
    provider?.isMetaMask ||
    provider?.isCoinbaseWallet ||
    name.includes('trust') ||
    name.includes('metamask') ||
    name.includes('coinbase') ||
    ua.includes('trust') ||
    ua.includes('metamask') ||
    ua.includes('coinbase')
  );
}

async function readAlreadyMintedWithFallback(contract, account, milestone) {
  try {
    return await withTimeout(
      contract.hasMintedMilestone(account, milestone),
      12000,
      'Could not check previous mint status quickly enough. Please check your connection and try again.'
    );
  } catch (err) {
    // Mobile wallet in-app browsers sometimes have weak eth_call implementations.
    // For the first mint attempt, do not permanently block the user here; the contract
    // will still revert if the NFT was already minted, and the wallet will show/return it.
    if (isMobileInjectedWallet()) {
      console.warn('hasMintedMilestone read failed on mobile wallet browser; continuing to send tx:', err);
      return false;
    }

    throw err;
  }
}

async function sendMintTransactionDirect(milestone, score, playSeconds) {
  const provider = walletState.eip1193Provider;
  if (!provider?.request) {
    throw new Error('Wallet RPC provider is not ready. Disconnect, reconnect, and try again.');
  }

  const iface = new Interface(CONTRACT_ABI);
  const data = iface.encodeFunctionData('mintMilestone', [milestone, score, playSeconds]);

  const txParams = {
    from: walletState.account,
    to: CONFIG.contractAddress,
    data,
    value: '0x0',
  };

  let hash;
  try {
    hash = await withTimeout(
      provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }),
      90000,
      'Wallet did not return a transaction. Open the wallet app, check if a confirmation is waiting, then try again.'
    );
  } catch (err) {
    throw normalizeRpcError(err, 'Wallet rejected or failed to send the mint transaction.');
  }

  if (!hash || typeof hash !== 'string') {
    throw new Error('Wallet did not return a transaction hash. Try WalletConnect or reconnect the wallet.');
  }

  if (!walletState.provider) {
    walletState.provider = new BrowserProvider(provider);
  }

  const receipt = await withTimeout(
    walletState.provider.waitForTransaction(hash, 1),
    180000,
    `Transaction was submitted but confirmation is taking too long. Check it on ${CONFIG.explorerUrl}/tx/${hash}`
  );

  return { hash: receipt?.hash || hash };
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

function providerKey(provider, info = {}) {
  const rdns = info.rdns || provider?.rdns || '';
  const name = info.name || provider?.name || '';
  return `${rdns}|${name}|${provider?.isMetaMask ? 'metamask' : ''}|${provider?.isCoinbaseWallet ? 'coinbase' : ''}`;
}

function addProviderCandidate(candidates, provider, info = {}) {
  if (!provider?.request) return;

  const key = providerKey(provider, info);
  const exists = candidates.some((item) => item.key === key || item.provider === provider);
  if (exists) return;

  candidates.push({
    key,
    provider,
    info: {
      name: info.name || provider?.name || 'Browser Wallet',
      rdns: info.rdns || provider?.rdns || '',
      icon: info.icon || '',
      uuid: info.uuid || '',
    },
  });
}

export async function discoverWalletProviders() {
  if (!isBrowser()) return [];
  if (discoveryPromise) return discoveryPromise;

  discoveryPromise = new Promise((resolve) => {
    const candidates = [];

    const onAnnounce = (event) => {
      const detail = event?.detail;
      addProviderCandidate(candidates, detail?.provider, detail?.info || {});
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);

      const eth = window.ethereum;
      if (Array.isArray(eth?.providers)) {
        for (const provider of eth.providers) {
          addProviderCandidate(candidates, provider, {
            name: provider?.name || inferProviderName(provider),
            rdns: inferProviderRdns(provider),
          });
        }
      } else if (eth?.request) {
        addProviderCandidate(candidates, eth, {
          name: eth?.name || inferProviderName(eth),
          rdns: inferProviderRdns(eth),
        });
      }

      discoveredProviders = candidates;
      resolve(candidates);
      discoveryPromise = null;
    }, 500);
  });

  return discoveryPromise;
}

function inferProviderName(provider) {
  if (provider?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider?.isTrust || provider?.isTrustWallet) return 'Trust Wallet';
  if (provider?.isRabby) return 'Rabby Wallet';
  if (provider?.isMetaMask) return 'MetaMask-compatible Wallet';
  return 'Browser Wallet';
}

function inferProviderRdns(provider) {
  if (provider?.isCoinbaseWallet) return 'com.coinbase.wallet';
  if (provider?.isTrust || provider?.isTrustWallet) return 'com.trustwallet.app';
  if (provider?.isRabby) return 'io.rabby';
  // Do not infer io.metamask from isMetaMask only. Some wallets imitate MetaMask.
  return provider?.rdns || '';
}

function findInstalledProvider(walletId) {
  const wallet = KNOWN_WALLETS.find((item) => item.id === walletId);
  if (!wallet) return null;

  if (walletId === BROWSER_WALLET_ID) {
    return discoveredProviders[0] || null;
  }

  const rdnsMatched = discoveredProviders.find((item) => {
    const rdns = normalize(item.info?.rdns);
    return wallet.rdns.some((known) => rdns === normalize(known) || rdns.includes(normalize(known)));
  });

  if (rdnsMatched) return rdnsMatched;

  // Fallback by provider flags only for non-MetaMask wallets.
  // MetaMask is intentionally excluded to prevent Keplr or other wallets that imitate MetaMask from opening.
  if (walletId !== 'metamask') {
    return discoveredProviders.find((item) =>
      wallet.flags.some((flag) => Boolean(item.provider?.[flag]))
    ) || null;
  }

  return null;
}

function walletConnectMetadata() {
  const basePath = import.meta.env.BASE_URL || '/';
  const origin = isBrowser() ? window.location.origin : 'https://jefmark.github.io';
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const appUrl = `${origin}${normalizedBase}`;
  const iconUrl = `${appUrl}favicon.svg`;

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
      chains: [BASE_CHAIN_ID],
      optionalChains: [BASE_CHAIN_ID],
      methods: REQUIRED_METHODS,
      optionalMethods: REQUIRED_METHODS,
      events: REQUIRED_EVENTS,
      optionalEvents: REQUIRED_EVENTS,
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
        enableExplorer: true,
        explorerRecommendedWalletIds: 'NONE',
        themeVariables: {
          '--wcm-z-index': '2147483647',
          '--wcm-accent-color': '#3b82f6',
          '--wcm-background-color': '#0b1220',
        },
      },
      rpcMap: {
        [BASE_CHAIN_ID]: CONFIG.rpcUrl,
      },
      metadata: walletConnectMetadata(),
    });
  }

  return walletConnectProvider;
}

async function connectWithProvider(provider, label = 'Wallet', type = 'injected') {
  if (!provider?.request) {
    throw new Error(`${label} provider is not available.`);
  }

  walletState.eip1193Provider = provider;
  walletState.connectionType = type;
  walletState.walletName = label;
  walletState.provider = new BrowserProvider(provider);

  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  walletState.account = accounts?.[0] || '';

  if (!walletState.account) {
    throw new Error(`${label} did not return an account.`);
  }

  attachProviderListeners(provider);
  await ensureCorrectNetwork();

  walletState.signer = await walletState.provider.getSigner();
  createContractIfReady();
  emitWalletChanged();

  return { ...walletState };
}

async function connectWalletConnect() {
  let provider = await getWalletConnectProvider();

  // If there is an actually usable session, reuse it. If the session is stale,
  // destroy it so WalletConnect opens a fresh QR/mobile modal instead of doing nothing.
  if (provider.session) {
    const existingAccounts = await provider
      .request({ method: 'eth_accounts' })
      .catch(() => []);

    if (existingAccounts?.[0]) {
      return connectWithProvider(provider, 'WalletConnect', 'walletconnect');
    }

    try {
      await provider.disconnect();
    } catch (err) {
      console.warn('Could not clear stale WalletConnect session:', err);
    }
    walletConnectProvider = null;
    provider = await getWalletConnectProvider();
  }

  const openWalletConnect = typeof provider.enable === 'function'
    ? provider.enable.bind(provider)
    : provider.connect.bind(provider);

  await withTimeout(
    openWalletConnect(),
    120000,
    'WalletConnect modal did not open. Refresh the page and check that VITE_WALLETCONNECT_PROJECT_ID is set correctly.'
  );

  return connectWithProvider(provider, 'WalletConnect', 'walletconnect');
}

function installPickerStyles() {
  if (!isBrowser() || document.getElementById('bqm-wallet-picker-styles')) return;

  const style = document.createElement('style');
  style.id = 'bqm-wallet-picker-styles';
  style.textContent = `
    .bqm-wallet-overlay {
      position: fixed;
      inset: 0;
      z-index: 999900;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(2, 6, 23, 0.72);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .bqm-wallet-modal {
      width: min(500px, 100%);
      max-height: min(790px, 92vh);
      overflow: auto;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 24px;
      background: linear-gradient(180deg, #0b1220, #060b16);
      color: #e5e7eb;
      box-shadow: 0 30px 100px rgba(0, 0, 0, 0.58);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .bqm-wallet-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 20px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    }
    .bqm-wallet-title {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      color: #f8fafc;
      letter-spacing: -0.02em;
    }
    .bqm-wallet-subtitle {
      margin: 6px 0 0;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.45;
    }
    .bqm-wallet-close {
      width: 38px;
      height: 38px;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 999px;
      color: #e5e7eb;
      background: rgba(15, 23, 42, 0.95);
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
    .bqm-wallet-list {
      display: grid;
      gap: 11px;
      padding: 16px;
    }
    .bqm-wallet-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 13px;
      padding: 13px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.72));
      color: #e5e7eb;
      text-align: left;
      cursor: pointer;
    }
    .bqm-wallet-row:hover,
    .bqm-wallet-row:focus-visible {
      border-color: rgba(59, 130, 246, 0.8);
      background: linear-gradient(180deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.92));
      outline: none;
    }
    .bqm-wallet-row[disabled] {
      opacity: 0.62;
      cursor: progress;
    }
    .bqm-wallet-icon {
      width: 50px;
      height: 50px;
      flex: 0 0 50px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 10px 28px rgba(0,0,0,.22), inset 0 0 0 1px rgba(15, 23, 42, 0.04);
    }
    .bqm-wallet-icon img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      padding: 6px;
      border-radius: 15px;
    }
    .bqm-wallet-row[data-wallet-id='okx'] .bqm-wallet-icon,
    .bqm-wallet-row[data-wallet-id='browser'] .bqm-wallet-icon {
      background: #0f172a;
    }
    .bqm-wallet-row[data-wallet-id='walletconnect'] .bqm-wallet-icon {
      background: #3b99fc;
    }
    .bqm-wallet-main {
      min-width: 0;
      flex: 1;
    }
    .bqm-wallet-name {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 15px;
      font-weight: 900;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    .bqm-wallet-desc {
      margin-top: 4px;
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.35;
    }
    .bqm-wallet-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 900;
      background: rgba(34, 197, 94, 0.14);
      color: #86efac;
      border: 1px solid rgba(34, 197, 94, 0.22);
      white-space: nowrap;
    }
    .bqm-wallet-badge.install {
      background: rgba(251, 191, 36, 0.12);
      color: #fde68a;
      border-color: rgba(251, 191, 36, 0.24);
    }
    .bqm-wallet-status {
      min-height: 18px;
      padding: 0 20px 18px;
      color: #bfdbfe;
      font-size: 13px;
      line-height: 1.45;
    }
    @media (max-width: 520px) {
      .bqm-wallet-overlay {
        align-items: flex-end;
        padding: 0;
      }
      .bqm-wallet-modal {
        width: 100%;
        max-height: 92vh;
        border-radius: 24px 24px 0 0;
      }
      .bqm-wallet-head {
        padding: 18px 18px 12px;
      }
      .bqm-wallet-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 12px;
      }
      .bqm-wallet-row {
        min-height: 142px;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        text-align: center;
        gap: 9px;
        padding: 12px 8px;
        border-radius: 18px;
      }
      .bqm-wallet-icon {
        width: 58px;
        height: 58px;
        flex-basis: 58px;
        border-radius: 18px;
      }
      .bqm-wallet-icon img {
        padding: 6px;
        border-radius: 17px;
      }
      .bqm-wallet-main {
        width: 100%;
      }
      .bqm-wallet-name {
        justify-content: center;
        gap: 6px;
        font-size: 13.5px;
      }
      .bqm-wallet-desc {
        display: none;
      }
      .bqm-wallet-badge {
        padding: 3px 7px;
        font-size: 10px;
      }
      .bqm-wallet-status {
        padding: 2px 16px 16px;
        font-size: 12.5px;
      }
    }
  `;

  document.head.appendChild(style);
}

function closeWalletPicker() {
  if (pickerRoot) {
    pickerRoot.remove();
    pickerRoot = null;
  }
}

function walletInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('') || 'W';
}

function walletStatusLabel(wallet, installed) {
  if (wallet.id === WALLETCONNECT_ID) return 'Mobile / QR';
  if (installed) return 'Installed';
  if (isMobile() && wallet.mobileOpenUrl) return 'Mobile ready';
  if (wallet.id === BROWSER_WALLET_ID) return installed ? 'Detected' : 'Unavailable';
  return 'Install';
}

function walletDescription(wallet, installed) {
  if (wallet.id === 'rabby') return installed ? 'Detected in this browser. Rabby may show a reputation warning for new GitHub Pages domains; this is controlled by Rabby, not by the dapp code.' : 'Rabby desktop wallet. New GitHub Pages domains may show Rabby reputation warnings until the site gains reputation/listings.';
  if (wallet.id === WALLETCONNECT_ID) return 'Connect MetaMask, Trust Wallet, Coinbase Wallet and other EVM wallets by mobile deep link or QR.';
  if (wallet.id === BROWSER_WALLET_ID) return installed ? 'Uses the currently active injected EVM provider.' : 'No injected EVM provider was detected in this browser.';
  if (installed) return `${wallet.subtitle}. Detected in this browser.`;
  if (isMobile() && wallet.mobileOpenUrl) return `${wallet.subtitle}. Opens the installed wallet app/browser on mobile.`;
  return `${wallet.subtitle}. Not installed in this browser.`;
}

function renderWalletPicker() {
  if (!pickerRoot) return;

  const walletRows = [
    ...KNOWN_WALLETS,
    {
      id: WALLETCONNECT_ID,
      name: 'WalletConnect',
      subtitle: 'All EVM mobile wallets',
      rdns: [],
      flags: [],
    },
  ];

  const rowsHtml = walletRows.map((wallet) => {
    const installedProvider = wallet.id === WALLETCONNECT_ID ? null : findInstalledProvider(wallet.id);
    const installed = Boolean(installedProvider) || wallet.id === WALLETCONNECT_ID;
    const badgeClass = installed || (isMobile() && wallet.mobileOpenUrl) ? '' : ' install';
    const disabled = pickerState.isConnecting ? 'disabled' : '';
    const iconSrc = walletIconFor(wallet, installedProvider);
    const status = walletStatusLabel(wallet, installedProvider || wallet.id === WALLETCONNECT_ID);
    const description = walletDescription(wallet, installedProvider || wallet.id === WALLETCONNECT_ID);

    return `
      <button class="bqm-wallet-row" type="button" data-wallet-id="${escapeHtml(wallet.id)}" ${disabled}>
        <span class="bqm-wallet-icon" aria-hidden="true">
          <img src="${escapeHtml(iconSrc)}" alt="" loading="lazy" decoding="async">
        </span>
        <span class="bqm-wallet-main">
          <span class="bqm-wallet-name">
            ${escapeHtml(wallet.name)}
            <span class="bqm-wallet-badge${badgeClass}">${escapeHtml(status)}</span>
          </span>
          <span class="bqm-wallet-desc">${escapeHtml(description)}</span>
        </span>
      </button>
    `;
  }).join('');

  pickerRoot.innerHTML = `
    <div class="bqm-wallet-overlay" role="presentation">
      <section class="bqm-wallet-modal" role="dialog" aria-modal="true" aria-label="Connect wallet">
        <header class="bqm-wallet-head">
          <div>
            <h2 class="bqm-wallet-title">Connect EVM wallet</h2>
            <p class="bqm-wallet-subtitle">Choose a Base/Ethereum wallet. Non-EVM wallet flows are not used for this game.</p>
          </div>
          <button class="bqm-wallet-close" type="button" aria-label="Close wallet picker">×</button>
        </header>
        <div class="bqm-wallet-list">${rowsHtml}</div>
        <div class="bqm-wallet-status">${pickerState.message || 'Select a wallet. On Android Chrome, MetaMask/Trust/Coinbase open their wallet app; WalletConnect stays inside this page.'}</div>
      </section>
    </div>
  `;

  pickerRoot.querySelector('.bqm-wallet-close')?.addEventListener('click', closeWalletPicker);
  pickerRoot.querySelector('.bqm-wallet-overlay')?.addEventListener('click', (event) => {
    if (event.target === pickerRoot.querySelector('.bqm-wallet-overlay')) closeWalletPicker();
  });

  for (const button of pickerRoot.querySelectorAll('[data-wallet-id]')) {
    button.addEventListener('click', () => handleWalletPick(button.dataset.walletId));
  }
}

function setPickerMessage(message) {
  pickerState.message = message;
  renderWalletPicker();
}

async function handleWalletPick(walletId) {
  if (pickerState.isConnecting) return;

  const wallet = KNOWN_WALLETS.find((item) => item.id === walletId);
  pickerState.isConnecting = true;
  pickerState.selectedWalletId = walletId;
  pickerState.message = 'Preparing wallet connection...';
  renderWalletPicker();

  try {
    if (walletId === WALLETCONNECT_ID) {
      setPickerMessage('Opening WalletConnect. Choose your mobile wallet or scan the QR code.');
      // Critical: the custom wallet picker overlay used a very high z-index and
      // could cover the WalletConnect QR modal. Close it before opening WalletConnect.
      closeWalletPicker();
      await connectWalletConnect();
      return;
    }

    if (!wallet) throw new Error('Unknown wallet selected.');

    const installed = findInstalledProvider(wallet.id);

    if (installed) {
      const riskNote = wallet.id === 'rabby'
        ? ' Rabby may show a site popularity warning for new GitHub Pages domains; confirm only if the URL is correct.'
        : '';
      setPickerMessage(`Opening ${wallet.name}...${riskNote}`);
      await connectWithProvider(installed.provider, wallet.name, 'injected');
      closeWalletPicker();
      return;
    }

    if (isMobile() && wallet.mobileOpenUrl) {
      const deepLink = wallet.mobileOpenUrl(currentDappUrl());
      setPickerMessage(`Opening ${wallet.name} app. If it opens the game inside the wallet browser, tap Connect Wallet again there. If nothing opens, return here and choose WalletConnect.`);
      openMobileWalletDeepLink(deepLink);
      return;
    }

    if (wallet.desktopInstallUrl) {
      setPickerMessage(`${wallet.name} is not installed. Opening install page in a new tab.`);
      window.open(wallet.desktopInstallUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    throw new Error(`${wallet.name} is not available in this browser. Use WalletConnect instead.`);
  } catch (err) {
    console.error(err);
    const message = err.shortMessage || err.message || 'Wallet connection failed.';
    if (pickerRoot) setPickerMessage(message);
    else if (isBrowser()) window.alert(message);
  } finally {
    pickerState.isConnecting = false;
    renderWalletPicker();
  }
}

export async function openWalletModal() {
  if (!isBrowser()) return;

  installPickerStyles();
  await discoverWalletProviders();

  closeWalletPicker();
  pickerState = {
    isConnecting: false,
    selectedWalletId: '',
    message: '',
  };

  pickerRoot = document.createElement('div');
  pickerRoot.id = 'bqm-wallet-picker-root';
  document.body.appendChild(pickerRoot);
  renderWalletPicker();
}

export async function connectWallet() {
  await openWalletModal();
}

export function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function ensureCorrectNetwork() {
  const activeProvider = walletState.eip1193Provider;

  if (!activeProvider?.request) return false;

  const target = toHexChainId(BASE_CHAIN_ID);
  const current = await activeProvider.request({ method: 'eth_chainId' }).catch(() => null);

  if (normalize(current) === normalize(target)) {
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

  walletState.chainOk = normalize(afterSwitch) === normalize(target);

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
    console.info('Wallet permission revoke is not supported or was rejected by this wallet:', err);
    return false;
  }
}

export async function disconnectWallet() {
  const provider = walletState.eip1193Provider;
  const connectionType = walletState.connectionType;

  clearProviderListeners();

  const revoked = await bestEffortRevokePermissions(provider);

  if (connectionType === 'walletconnect' || provider === walletConnectProvider) {
    try {
      if (walletConnectProvider?.disconnect) {
        await walletConnectProvider.disconnect();
      }
    } catch (err) {
      console.warn('WalletConnect disconnect failed:', err);
    }

    walletConnectProvider = null;
  }

  try {
    if (provider?.disconnect) await provider.disconnect();
    else if (provider?.close) await provider.close();
  } catch (err) {
    console.warn('Provider disconnect/close failed:', err);
  }

  resetWalletState(false);
  emitWalletChanged();

  return { revoked };
}

export async function getBalanceText() {
  if (!walletState.provider || !walletState.account) return '';

  const balance = await walletState.provider.getBalance(walletState.account);
  return `${Number(formatUnits(balance, 18)).toFixed(5)} ETH`;
}

export async function hasMintedMilestone(milestone) {
  if (!walletState.account || !CONFIG.contractAddress) return false;

  await ensureCorrectNetwork();
  await refreshSignerAndContract();

  if (!walletState.contract) return false;

  const safeMilestone = Math.floor(Number(milestone));
  if (!Number.isFinite(safeMilestone) || safeMilestone < 1) return false;

  return readAlreadyMintedWithFallback(
    walletState.contract,
    walletState.account,
    safeMilestone
  );
}

export async function mintMilestone(milestone, score, playSeconds) {
  if (!walletState.account) {
    throw new Error('Connect your wallet first.');
  }

  if (!CONFIG.contractAddress) {
    throw new Error('Contract address is not configured yet.');
  }

  await ensureCorrectNetwork();
  await refreshSignerAndContract();

  if (!walletState.eip1193Provider?.request) {
    throw new Error('Wallet provider is not ready. Disconnect, reconnect, and try mint again.');
  }

  if (!walletState.contract || !walletState.signer) {
    throw new Error('Wallet signer is not ready. Disconnect, reconnect, and try mint again.');
  }

  const safeMilestone = Math.floor(Number(milestone));
  const safeScore = Math.floor(Number(score));
  const safePlaySeconds = Math.floor(Number(playSeconds));

  if (!Number.isFinite(safeMilestone) || safeMilestone < 1) {
    throw new Error('Invalid milestone number.');
  }

  const alreadyMinted = await readAlreadyMintedWithFallback(
    walletState.contract,
    walletState.account,
    safeMilestone
  );

  if (alreadyMinted) {
    throw new Error('You already minted this milestone.');
  }

  // Important mobile fix:
  // Trust Wallet / MetaMask in-app browsers can fail silently when ethers runs
  // preflight gas estimation before opening the wallet sheet. Sending the raw
  // EIP-1193 eth_sendTransaction request lets the wallet itself show the gas
  // confirmation UI. This works on desktop too, but it is especially important
  // inside mobile wallet browsers.
  return sendMintTransactionDirect(safeMilestone, safeScore, safePlaySeconds);
}
