// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProofOfAchievement
 * @dev Decentralized, tamper-resistant achievement credential registry on Monad.
 *      Supports optional on-chain MON rewards locked until recipient claims.
 */
contract ProofOfAchievement is Ownable, ReentrancyGuard {
    struct Achievement {
        uint256 id;
        string studentName;
        address studentWallet;
        string title;
        string description;
        address issuer;
        uint256 issuedAt;
        uint256 reward;       // MON reward locked in contract (wei)
        bool rewardClaimed;   // true once student has claimed
        bool exists;
        bool revoked;
    }

    uint256 private _nextAchievementId = 1;

    // achievementId => Achievement
    mapping(uint256 => Achievement) public achievements;

    // studentWallet => list of achievement IDs
    mapping(address => uint256[]) private _userAchievements;

    // issuerWallet => list of achievement IDs
    mapping(address => uint256[]) private _issuerAchievements;

    // authorized issuers mapping
    mapping(address => bool) public authorizedIssuers;

    // Events
    event AchievementIssued(
        uint256 indexed achievementId,
        address indexed studentWallet,
        address indexed issuer,
        string title,
        uint256 issuedAt,
        uint256 reward
    );

    event AchievementRevoked(
        uint256 indexed achievementId,
        address indexed issuer,
        uint256 revokedAt
    );

    event IssuerStatusChanged(
        address indexed issuer,
        bool isAuthorized
    );

    event RewardClaimed(
        uint256 indexed achievementId,
        address indexed student,
        uint256 amount
    );

    modifier onlyIssuer() {
        require(
            msg.sender == owner() || authorizedIssuers[msg.sender],
            "ProofOfAchievement: Caller is not an authorized issuer"
        );
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        authorizedIssuers[initialOwner] = true;
    }

    /**
     * @dev Issue a new credential achievement with an optional MON reward.
     *      Send MON with the transaction to attach a reward.
     */
    function issueAchievement(
        string memory studentName,
        address studentWallet,
        string memory title,
        string memory description
    ) external payable onlyIssuer returns (uint256) {
        require(studentWallet != address(0), "ProofOfAchievement: Invalid student wallet address");
        require(bytes(studentName).length > 0, "ProofOfAchievement: Student name cannot be empty");
        require(bytes(title).length > 0, "ProofOfAchievement: Title cannot be empty");

        uint256 achievementId = _nextAchievementId++;

        achievements[achievementId] = Achievement({
            id: achievementId,
            studentName: studentName,
            studentWallet: studentWallet,
            title: title,
            description: description,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            reward: msg.value,        // store any attached MON in the struct
            rewardClaimed: false,
            exists: true,
            revoked: false
        });

        _userAchievements[studentWallet].push(achievementId);
        _issuerAchievements[msg.sender].push(achievementId);

        emit AchievementIssued(
            achievementId,
            studentWallet,
            msg.sender,
            title,
            block.timestamp,
            msg.value
        );

        return achievementId;
    }

    /**
     * @dev Claim the MON reward for an achievement.
     *      Only the registered student wallet may call this.
     *      Follows checks-effects-interactions pattern.
     */
    function claimReward(uint256 achievementId) external nonReentrant {
        Achievement storage ach = achievements[achievementId];

        require(ach.exists, "ProofOfAchievement: Achievement does not exist");
        require(ach.reward > 0, "ProofOfAchievement: No reward for this achievement");
        require(!ach.rewardClaimed, "ProofOfAchievement: Reward already claimed");
        require(
            msg.sender == ach.studentWallet,
            "ProofOfAchievement: Only recipient can claim reward"
        );
        require(
            address(this).balance >= ach.reward,
            "ProofOfAchievement: Insufficient contract balance"
        );

        // Effects
        uint256 amount = ach.reward;
        ach.rewardClaimed = true;

        // Interactions
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ProofOfAchievement: Reward transfer failed");

        emit RewardClaimed(achievementId, msg.sender, amount);
    }

    /**
     * @dev Fetch single achievement details by ID
     */
    function getAchievement(uint256 achievementId) external view returns (Achievement memory) {
        require(achievements[achievementId].exists, "ProofOfAchievement: Achievement does not exist");
        return achievements[achievementId];
    }

    /**
     * @dev Revoke an existing achievement (Only owner or original issuer)
     */
    function revokeAchievement(uint256 achievementId) external {
        require(achievements[achievementId].exists, "ProofOfAchievement: Achievement does not exist");
        require(!achievements[achievementId].revoked, "ProofOfAchievement: Achievement already revoked");
        require(
            msg.sender == owner() || msg.sender == achievements[achievementId].issuer,
            "ProofOfAchievement: Not authorized to revoke this achievement"
        );

        achievements[achievementId].revoked = true;

        emit AchievementRevoked(achievementId, msg.sender, block.timestamp);
    }

    /**
     * @dev Set authorized issuer status
     */
    function setAuthorizedIssuer(address issuer, bool status) external onlyOwner {
        require(issuer != address(0), "ProofOfAchievement: Invalid issuer address");
        authorizedIssuers[issuer] = status;
        emit IssuerStatusChanged(issuer, status);
    }

    /**
     * @dev Alias kept for backwards compatibility with frontend
     */
    function authorizeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "ProofOfAchievement: Invalid issuer address");
        authorizedIssuers[issuer] = true;
        emit IssuerStatusChanged(issuer, true);
    }

    /**
     * @dev Get total achievements issued
     */
    function getTotalAchievements() external view returns (uint256) {
        return _nextAchievementId - 1;
    }

    /**
     * @dev Get list of achievement IDs received by a student
     */
    function getAchievementsByStudent(address student) external view returns (uint256[] memory) {
        return _userAchievements[student];
    }

    /**
     * @dev Get list of achievement IDs issued by an issuer
     */
    function getAchievementsByIssuer(address issuer) external view returns (uint256[] memory) {
        return _issuerAchievements[issuer];
    }

    /**
     * @dev Return the contract's current MON balance (for UI display)
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Accept plain MON deposits (should not be needed normally)
    receive() external payable {}
}
