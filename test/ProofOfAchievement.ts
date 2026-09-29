import { expect } from "chai";
import { ethers } from "hardhat";
import { ProofOfAchievement } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ProofOfAchievement Smart Contract", function () {
  let proofOfAchievement: ProofOfAchievement;
  let owner: SignerWithAddress;
  let issuer: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;

  beforeEach(async function () {
    [owner, issuer, student1, student2, unauthorizedUser] = await ethers.getSigners();

    const ProofOfAchievementFactory = await ethers.getContractFactory("ProofOfAchievement");
    proofOfAchievement = await ProofOfAchievementFactory.deploy(owner.address);
    await proofOfAchievement.waitForDeployment();
  });

  describe("1. Deployment", function () {
    it("Should set the correct owner and initial state", async function () {
      expect(await proofOfAchievement.owner()).to.equal(owner.address);
      expect(await proofOfAchievement.getTotalAchievements()).to.equal(0);
      expect(await proofOfAchievement.authorizedIssuers(owner.address)).to.be.true;
    });
  });

  describe("2. Achievement Issuance", function () {
    it("Should allow owner to issue achievement with correct data and event", async function () {
      const tx = await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Web3 SkillBuildZ 2026",
        "Successfully completed the Web3 SkillBuildZ buildathon."
      );

      const receipt = await tx.wait();
      expect(await proofOfAchievement.getTotalAchievements()).to.equal(1);

      const achievement = await proofOfAchievement.getAchievement(1);
      expect(achievement.id).to.equal(1);
      expect(achievement.studentName).to.equal("Rahul Sharma");
      expect(achievement.studentWallet).to.equal(student1.address);
      expect(achievement.title).to.equal("Web3 SkillBuildZ 2026");
      expect(achievement.description).to.equal("Successfully completed the Web3 SkillBuildZ buildathon.");
      expect(achievement.issuer).to.equal(owner.address);
      expect(achievement.issuedAt).to.be.greaterThan(0);
      expect(achievement.exists).to.be.true;
      expect(achievement.revoked).to.be.false;
      expect(achievement.reward).to.equal(0);
      expect(achievement.rewardClaimed).to.be.false;
    });

    it("Should assign unique sequential IDs to multiple achievements", async function () {
      await proofOfAchievement.issueAchievement(
        "Alice Smith",
        student1.address,
        "React Mastery",
        "Completed course"
      );

      await proofOfAchievement.issueAchievement(
        "Bob Jones",
        student2.address,
        "Solidity Advanced",
        "Completed course"
      );

      expect(await proofOfAchievement.getTotalAchievements()).to.equal(2);
      const ach1 = await proofOfAchievement.getAchievement(1);
      const ach2 = await proofOfAchievement.getAchievement(2);

      expect(ach1.id).to.equal(1);
      expect(ach2.id).to.equal(2);
      expect(ach1.studentWallet).to.equal(student1.address);
      expect(ach2.studentWallet).to.equal(student2.address);
    });

    it("Should reject issuance with zero address student wallet", async function () {
      await expect(
        proofOfAchievement.issueAchievement(
          "Rahul Sharma",
          ethers.ZeroAddress,
          "Web3 SkillBuildZ 2026",
          "Completed buildathon"
        )
      ).to.be.revertedWith("ProofOfAchievement: Invalid student wallet address");
    });

    it("Should reject issuance with empty student name or title", async function () {
      await expect(
        proofOfAchievement.issueAchievement(
          "",
          student1.address,
          "Web3 SkillBuildZ 2026",
          "Completed buildathon"
        )
      ).to.be.revertedWith("ProofOfAchievement: Student name cannot be empty");

      await expect(
        proofOfAchievement.issueAchievement(
          "Rahul Sharma",
          student1.address,
          "",
          "Completed buildathon"
        )
      ).to.be.revertedWith("ProofOfAchievement: Title cannot be empty");
    });
  });

  describe("3. Access Control & Authorization", function () {
    it("Should prevent unauthorized users from issuing achievements", async function () {
      await expect(
        proofOfAchievement.connect(unauthorizedUser).issueAchievement(
          "Rahul Sharma",
          student1.address,
          "Hackathon Winner",
          "First place"
        )
      ).to.be.revertedWith("ProofOfAchievement: Caller is not an authorized issuer");
    });

    it("Should allow owner to authorize a new issuer and allow them to issue", async function () {
      await proofOfAchievement.setAuthorizedIssuer(issuer.address, true);
      expect(await proofOfAchievement.authorizedIssuers(issuer.address)).to.be.true;

      await expect(
        proofOfAchievement.connect(issuer).issueAchievement(
          "Charlie",
          student1.address,
          "Monad Developer Certificate",
          "Certified Builder"
        )
      ).to.emit(proofOfAchievement, "AchievementIssued");

      const ach = await proofOfAchievement.getAchievement(1);
      expect(ach.issuer).to.equal(issuer.address);
    });
  });

  describe("4. Verification & Retrieval", function () {
    it("Should fail when querying non-existent achievement ID", async function () {
      await expect(proofOfAchievement.getAchievement(999)).to.be.revertedWith(
        "ProofOfAchievement: Achievement does not exist"
      );
    });

    it("Should return correct achievements for student and issuer queries", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Achievement 1",
        "Desc 1"
      );
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Achievement 2",
        "Desc 2"
      );

      const studentAchs = await proofOfAchievement.getAchievementsByStudent(student1.address);
      expect(studentAchs.length).to.equal(2);
      expect(studentAchs[0]).to.equal(1);
      expect(studentAchs[1]).to.equal(2);
    });
  });

  describe("5. Revocation Feature", function () {
    it("Should allow owner/issuer to revoke an achievement", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Temporary Award",
        "Issued by mistake"
      );

      await expect(proofOfAchievement.revokeAchievement(1))
        .to.emit(proofOfAchievement, "AchievementRevoked");

      const ach = await proofOfAchievement.getAchievement(1);
      expect(ach.revoked).to.be.true;
    });

    it("Should prevent unauthorized users from revoking achievements", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Award",
        "Desc"
      );

      await expect(
        proofOfAchievement.connect(unauthorizedUser).revokeAchievement(1)
      ).to.be.revertedWith("ProofOfAchievement: Not authorized to revoke this achievement");
    });
  });

  describe("6. On-Chain Reward Feature", function () {
    const rewardAmount = ethers.parseEther("0.01");

    it("Should issue achievement without reward (zero value)", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "No Reward Certificate",
        "Issued with no MON reward"
      );
      const ach = await proofOfAchievement.getAchievement(1);
      expect(ach.reward).to.equal(0);
      expect(ach.rewardClaimed).to.be.false;
    });

    it("Should issue achievement WITH reward and lock MON in contract", async function () {
      await expect(
        proofOfAchievement.issueAchievement(
          "Rahul Sharma",
          student1.address,
          "Web3 SkillBuildZ 2026",
          "Hackathon finalist",
          { value: rewardAmount }
        )
      ).to.emit(proofOfAchievement, "AchievementIssued");

      const ach = await proofOfAchievement.getAchievement(1);
      expect(ach.reward).to.equal(rewardAmount);
      expect(ach.rewardClaimed).to.be.false;

      // Contract should hold the MON
      const contractBalance = await proofOfAchievement.getContractBalance();
      expect(contractBalance).to.equal(rewardAmount);
    });

    it("Should allow the correct student to claim the reward", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Web3 SkillBuildZ 2026",
        "Hackathon winner",
        { value: rewardAmount }
      );

      const balanceBefore = await ethers.provider.getBalance(student1.address);

      const claimTx = await proofOfAchievement.connect(student1).claimReward(1);
      const receipt = await claimTx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(student1.address);

      // Student should receive reward minus gas
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(rewardAmount);

      // Reward should be marked as claimed
      const ach = await proofOfAchievement.getAchievement(1);
      expect(ach.rewardClaimed).to.be.true;

      // Contract balance should now be 0
      expect(await proofOfAchievement.getContractBalance()).to.equal(0);
    });

    it("Should emit RewardClaimed event on successful claim", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Award",
        "Desc",
        { value: rewardAmount }
      );

      await expect(proofOfAchievement.connect(student1).claimReward(1))
        .to.emit(proofOfAchievement, "RewardClaimed")
        .withArgs(1, student1.address, rewardAmount);
    });

    it("Should prevent incorrect wallet from claiming reward", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Award",
        "Desc",
        { value: rewardAmount }
      );

      await expect(
        proofOfAchievement.connect(unauthorizedUser).claimReward(1)
      ).to.be.revertedWith("ProofOfAchievement: Only recipient can claim reward");
    });

    it("Should prevent reward from being claimed twice", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Award",
        "Desc",
        { value: rewardAmount }
      );

      await proofOfAchievement.connect(student1).claimReward(1);

      await expect(
        proofOfAchievement.connect(student1).claimReward(1)
      ).to.be.revertedWith("ProofOfAchievement: Reward already claimed");
    });

    it("Should revert claimReward when achievement has no reward", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "No Reward Award",
        "Desc"
      );

      await expect(
        proofOfAchievement.connect(student1).claimReward(1)
      ).to.be.revertedWith("ProofOfAchievement: No reward for this achievement");
    });

    it("Should revert claimReward for non-existent achievement", async function () {
      await expect(
        proofOfAchievement.connect(student1).claimReward(999)
      ).to.be.revertedWith("ProofOfAchievement: Achievement does not exist");
    });

    it("Should correctly store reward amount against the achievement ID", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma", student1.address, "Ach 1", "Desc", { value: rewardAmount }
      );
      await proofOfAchievement.issueAchievement(
        "Ananya Patel", student2.address, "Ach 2", "Desc 2"
      );

      const ach1 = await proofOfAchievement.getAchievement(1);
      const ach2 = await proofOfAchievement.getAchievement(2);

      expect(ach1.reward).to.equal(rewardAmount);
      expect(ach2.reward).to.equal(0);
    });

    it("Should correctly handle reward status after claim (CLAIMED vs AVAILABLE)", async function () {
      await proofOfAchievement.issueAchievement(
        "Rahul Sharma",
        student1.address,
        "Award",
        "Desc",
        { value: rewardAmount }
      );

      let ach = await proofOfAchievement.getAchievement(1);
      expect(ach.rewardClaimed).to.be.false;

      await proofOfAchievement.connect(student1).claimReward(1);

      ach = await proofOfAchievement.getAchievement(1);
      expect(ach.rewardClaimed).to.be.true;
    });
  });
});
