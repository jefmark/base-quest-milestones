import { BrowserProvider, Contract, formatUnits } from 'ethers';
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
    subtitle: 'Desktop EVM wallet',
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
      chains: [BASE_CHAIN_ID],
      optionalChains: [BASE_CHAIN_ID],
      methods: REQUIRED_METHODS,
      optionalMethods: REQUIRED_METHODS,
      events: REQUIRED_EVENTS,
      optionalEvents: REQUIRED_EVENTS,
      showQrModal: true,
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
  const provider = await getWalletConnectProvider();

  if (!provider.session) {
    await provider.connect();
  } else {
    await provider.request({ method: 'eth_requestAccounts' }).catch(() => null);
  }

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
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(2, 6, 23, 0.72);
      backdrop-filter: blur(10px);
    }
    .bqm-wallet-modal {
      width: min(460px, 100%);
      max-height: min(760px, 92vh);
      overflow: auto;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 22px;
      background: #0b1220;
      color: #e5e7eb;
      box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55);
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
      font-weight: 800;
      color: #f8fafc;
    }
    .bqm-wallet-subtitle {
      margin: 6px 0 0;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.45;
    }
    .bqm-wallet-close {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 999px;
      color: #e5e7eb;
      background: rgba(15, 23, 42, 0.95);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }
    .bqm-wallet-list {
      display: grid;
      gap: 10px;
      padding: 16px;
    }
    .bqm-wallet-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.82);
      color: #e5e7eb;
      text-align: left;
      cursor: pointer;
    }
    .bqm-wallet-row:hover,
    .bqm-wallet-row:focus-visible {
      border-color: rgba(59, 130, 246, 0.78);
      background: rgba(30, 41, 59, 0.92);
      outline: none;
    }
    .bqm-wallet-row[disabled] {
      opacity: 0.62;
      cursor: progress;
    }
    .bqm-wallet-icon {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      font-weight: 900;
      color: white;
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
      font-weight: 800;
      color: #f8fafc;
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
      font-weight: 800;
      background: rgba(34, 197, 94, 0.14);
      color: #86efac;
      border: 1px solid rgba(34, 197, 94, 0.22);
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
        border-radius: 22px 22px 0 0;
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
  if (isMobile() && wallet.mobileOpenUrl) return 'Open app';
  if (wallet.id === BROWSER_WALLET_ID) return installed ? 'Detected' : 'Unavailable';
  return 'Install';
}

function walletDescription(wallet, installed) {
  if (wallet.id === WALLETCONNECT_ID) return 'Connect MetaMask, Trust Wallet, Coinbase Wallet and other EVM wallets by mobile deep link or QR.';
  if (wallet.id === BROWSER_WALLET_ID) return installed ? 'Uses the currently active injected EVM provider.' : 'No injected EVM provider was detected in this browser.';
  if (installed) return `${wallet.subtitle}. Detected in this browser.`;
  if (isMobile() && wallet.mobileOpenUrl) return `${wallet.subtitle}. Opens the wallet app browser for this dApp.`;
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
    return `
      <button class="bqm-wallet-row" type="button" data-wallet-id="${wallet.id}" ${disabled}>
        <span class="bqm-wallet-icon">${walletInitials(wallet.name)}</span>
        <span class="bqm-wallet-main">
          <span class="bqm-wallet-name">
            ${wallet.name}
            <span class="bqm-wallet-badge${badgeClass}">${walletStatusLabel(wallet, installedProvider || wallet.id === WALLETCONNECT_ID)}</span>
          </span>
          <span class="bqm-wallet-desc">${walletDescription(wallet, installedProvider || wallet.id === WALLETCONNECT_ID)}</span>
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
        <div class="bqm-wallet-status">${pickerState.message || 'Select a wallet. WalletConnect works best on Android Chrome and normal mobile browsers.'}</div>
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
      await connectWalletConnect();
      closeWalletPicker();
      return;
    }

    if (!wallet) throw new Error('Unknown wallet selected.');

    const installed = findInstalledProvider(wallet.id);

    if (installed) {
      setPickerMessage(`Opening ${wallet.name}...`);
      await connectWithProvider(installed.provider, wallet.name, 'injected');
      closeWalletPicker();
      return;
    }

    if (isMobile() && wallet.mobileOpenUrl) {
      setPickerMessage(`Opening ${wallet.name} app. If it is not installed, use WalletConnect.`);
      window.location.href = wallet.mobileOpenUrl(currentDappUrl());
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
    setPickerMessage(err.shortMessage || err.message || 'Wallet connection failed.');
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
