export const CONFIG = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 84532),
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Base Sepolia',
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://sepolia.base.org',
  explorerUrl: import.meta.env.VITE_EXPLORER_URL || 'https://sepolia.basescan.org',
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || '',
  maxMilestone: 6,
};

export const CONTRACT_ABI = [
  'function mintMilestone(uint256 milestone,uint256 clientScore,uint256 playSeconds) external returns (uint256)',
  'function hasMintedMilestone(address player,uint256 milestone) external view returns (bool)',
  'function getMilestone(uint256 milestone) external view returns (tuple(uint32 requiredScore,uint32 minPlaySeconds,bool active,string name))',
  'function paused() external view returns (bool)',
  'event MilestoneMinted(address indexed player,uint256 indexed milestone,uint256 indexed tokenId,uint256 clientScore,uint256 playSeconds)'
];
