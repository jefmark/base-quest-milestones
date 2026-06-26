// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title BaseQuestMilestones
/// @notice A no-payment ERC-721 milestone NFT contract for a browser game.
/// @dev No approvals, no token transfers from players, no payable mint. Use a fresh deployer wallet.
contract BaseQuestMilestones is ERC721, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;

    struct Milestone {
        uint32 requiredScore;
        uint32 minPlaySeconds;
        bool active;
        string name;
    }

    uint256 public constant MAX_MILESTONE = 12;
    uint256 public totalMinted;
    uint256 public mintCooldown = 60;
    string private baseTokenURI;

    mapping(uint256 => Milestone) public milestones;
    mapping(address => mapping(uint256 => bool)) public hasMintedMilestone;
    mapping(uint256 => uint256) public tokenMilestone;
    mapping(address => uint256) public lastMintAt;

    event MilestoneConfigured(uint256 indexed milestone, uint32 requiredScore, uint32 minPlaySeconds, bool active, string name);
    event MilestoneMinted(address indexed player, uint256 indexed milestone, uint256 indexed tokenId, uint256 clientScore, uint256 playSeconds);
    event BaseTokenURIUpdated(string newBaseTokenURI);
    event MintCooldownUpdated(uint256 newCooldown);

    constructor(address initialOwner, string memory initialBaseURI)
        ERC721("Base Quest Milestones", "BQM")
        Ownable(initialOwner)
    {
        baseTokenURI = initialBaseURI;
        _setMilestone(1, 1200, 20, true, "Rookie Runner");
        _setMilestone(2, 2600, 35, true, "Chain Jumper");
        _setMilestone(3, 4500, 50, true, "Base Sprinter");
        _setMilestone(4, 7000, 70, true, "Gasless Ghost");
        _setMilestone(5, 10000, 90, true, "Block Master");
        _setMilestone(6, 13500, 110, true, "Onchain Legend");
    }

    function mintMilestone(uint256 milestone, uint256 clientScore, uint256 playSeconds)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 tokenId)
    {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        Milestone memory m = milestones[milestone];
        require(m.active, "MILESTONE_OFF");
        require(!hasMintedMilestone[msg.sender][milestone], "ALREADY_MINTED");
        require(block.timestamp >= lastMintAt[msg.sender] + mintCooldown, "COOLDOWN");
        require(clientScore >= m.requiredScore, "SCORE_TOO_LOW");
        require(playSeconds >= m.minPlaySeconds, "TOO_FAST");

        lastMintAt[msg.sender] = block.timestamp;
        hasMintedMilestone[msg.sender][milestone] = true;

        tokenId = ++totalMinted;
        tokenMilestone[tokenId] = milestone;
        _safeMint(msg.sender, tokenId);

        emit MilestoneMinted(msg.sender, milestone, tokenId, clientScore, playSeconds);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ownerOf(tokenId); // reverts for nonexistent token
        uint256 milestone = tokenMilestone[tokenId];
        return string.concat(baseTokenURI, milestone.toString(), ".json");
    }

    function getMilestone(uint256 milestone) external view returns (Milestone memory) {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        return milestones[milestone];
    }

    function setMilestone(
        uint256 milestone,
        uint32 requiredScore,
        uint32 minPlaySeconds,
        bool active,
        string calldata name
    ) external onlyOwner {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        _setMilestone(milestone, requiredScore, minPlaySeconds, active, name);
    }

    function setBaseTokenURI(string calldata newBaseTokenURI) external onlyOwner {
        baseTokenURI = newBaseTokenURI;
        emit BaseTokenURIUpdated(newBaseTokenURI);
    }

    function setMintCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown <= 1 days, "TOO_LONG");
        mintCooldown = newCooldown;
        emit MintCooldownUpdated(newCooldown);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setMilestone(
        uint256 milestone,
        uint32 requiredScore,
        uint32 minPlaySeconds,
        bool active,
        string memory name
    ) internal {
        milestones[milestone] = Milestone(requiredScore, minPlaySeconds, active, name);
        emit MilestoneConfigured(milestone, requiredScore, minPlaySeconds, active, name);
    }

    receive() external payable {
        revert("NO_ETH_ACCEPTED");
    }

    fallback() external payable {
        revert("NO_ETH_ACCEPTED");
    }
}
