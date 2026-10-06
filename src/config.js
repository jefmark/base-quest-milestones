export const NETWORKS = {
  BASE: {
    chainId: 8453,
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    contractAddress: ""
  },

  BOT: {
    chainId: 677,
    chainName: "BOT Chain",
    rpcUrl: "https://rpc.botchain.ai",
    explorerUrl: "https://scan.botchain.ai",
    contractAddress: ""
  }
};


export const CONFIG = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID || NETWORKS.BASE.chainId),

  chainName:
    import.meta.env.VITE_CHAIN_NAME || NETWORKS.BASE.chainName,

  rpcUrl:
    import.meta.env.VITE_RPC_URL || NETWORKS.BASE.rpcUrl,

  explorerUrl:
    import.meta.env.VITE_EXPLORER_URL || NETWORKS.BASE.explorerUrl,

  contractAddress:
    import.meta.env.VITE_CONTRACT_ADDRESS ||
    NETWORKS.BASE.contractAddress,

  walletConnectProjectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",

  maxMilestone: 6,
};


export const CONTRACT_ABI = [
  "function mintMilestone(uint256 milestone,uint256 clientScore,uint256 playSeconds) external returns (uint256)",

  "function hasMintedMilestone(address player,uint256 milestone) external view returns (bool)",

  "function getMilestone(uint256 milestone) external view returns (tuple(uint32 requiredScore,uint32 minPlaySeconds,bool active,string name))",

  "function paused() external view returns (bool)",

  "event MilestoneMinted(address indexed player,uint256 indexed milestone,uint256 indexed tokenId,uint256 clientScore,uint256 playSeconds)"
];
