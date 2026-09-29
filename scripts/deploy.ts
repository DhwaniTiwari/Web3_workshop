import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("==================================================");
  console.log("Deploying ProofOfAchievement Smart Contract...");
  console.log("Network:", networkName, `(Chain ID: ${chainId})`);
  console.log("Deployer Address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "ETH/MON");
  console.log("==================================================");

  const ProofOfAchievement = await ethers.getContractFactory("ProofOfAchievement");
  const contract = await ProofOfAchievement.deploy(deployer.address);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction()?.hash || "N/A";

  console.log("\n✅ Deployment Successful!");
  console.log("Contract Address:", contractAddress);
  console.log("Transaction Hash:", deploymentTx);
  console.log("==================================================\n");

  // Save artifact & deployment info for frontend sync
  const deploymentInfo = {
    contractAddress,
    transactionHash: deploymentTx,
    network: networkName,
    chainId: Number(chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const frontendContractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  // Save deployment info JSON
  fs.writeFileSync(
    path.join(frontendContractsDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Save ABI JSON
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "ProofOfAchievement.sol", "ProofOfAchievement.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    fs.writeFileSync(
      path.join(frontendContractsDir, "ProofOfAchievementABI.json"),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log("📄 Saved Contract ABI and Deployment info to frontend/src/contracts/");
  }
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
