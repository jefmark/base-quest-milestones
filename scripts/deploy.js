import "dotenv/config";
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("Missing deployer. Set DEPLOYER_PRIVATE_KEY in .env");

  const baseUri = process.env.NFT_METADATA_BASE_URI || "https://example.com/metadata/";
  console.log("Deploying with:", deployer.address);
  console.log("Metadata base URI:", baseUri);

  const Contract = await hre.ethers.getContractFactory("BaseQuestMilestones");
  const contract = await Contract.deploy(deployer.address, baseUri);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("BaseQuestMilestones deployed to:", address);
  console.log("Add this to .env as VITE_CONTRACT_ADDRESS=", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
