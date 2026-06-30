export const CONFIG = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 8453),
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Base',
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://mainnet.base.org',
  explorerUrl: import.meta.env.VITE_EXPLORER_URL || 'https://basescan.org',
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || '',
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
  maxMilestone: 6,
};

export const CONTRACT_ABI = [
  'function mintMilestone(uint256 milestone,uint256 clientScore,uint256 playSeconds) external returns (uint256)',
  'function hasMintedMilestone(address player,uint256 milestone) external view returns (bool)',
  'function getMilestone(uint256 milestone) external view returns (tuple(uint32 requiredScore,uint32 minPlaySeconds,bool active,string name))',
  'function paused() external view returns (bool)',
  'event MilestoneMinted(address indexed player,uint256 indexed milestone,uint256 indexed tokenId,uint256 clientScore,uint256 playSeconds)',
];
