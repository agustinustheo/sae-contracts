// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat

import { Address } from "cluster";

// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require('hardhat');

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const erc20Contract = await ethers.getContractFactory('MockUsdcToken');
  console.log('Deploying MockUsdcToken...');
  const erc20Deployed = await erc20Contract.deploy();
  await erc20Deployed.deployed();

  const erc721Contract = await ethers.getContractFactory('SaeNft');
  console.log('Deploying SaeNft...');
  const erc721Deployed = await erc721Contract.deploy();
  await erc721Deployed.deployed();
  console.log('Sae NFT Address', erc721Deployed.address);

  const saeStakingTypesContract = await ethers.getContractFactory('SaeStakingTypes');
  console.log('Deploying SaeStakingTypes...');
  const saeStakingTypesDeployed = await saeStakingTypesContract.deploy();
  await saeStakingTypesDeployed.deployed();

  const saeStakingFunctionsContract = await ethers.getContractFactory('SaeStakingFunctions');
  console.log('Deploying SaeStakingFunctions...');
  const saeStakingFunctionsDeployed = await saeStakingFunctionsContract.deploy();
  await saeStakingFunctionsDeployed.deployed();

  const saeConvert = await ethers.getContractFactory('SaeConvert');
  const saeConvertDeployed = await saeConvert.deploy();
  await saeConvertDeployed.deployed();

  const saeViews = await ethers.getContractFactory('SaeViews');
  const saeViewsDeployed = await saeViews.deploy();
  await saeViewsDeployed.deployed();

  const [first] = await ethers.getSigners();

  console.log(first.address, "given")
  await erc20Deployed.transfer(first.address, 1000);

  console.log('MockUsdcToken deployed to:', erc20Deployed.address);

  const saeFtmStakingV1 = await ethers.getContractFactory('SaeFtmStakingV1', {
    libraries: {
      SaeStakingFunctions: saeStakingFunctionsDeployed.address,
      SaeConvert: saeConvertDeployed.address,
      SaeViews: saeViewsDeployed.address
    },
  });
  console.log('Deploying SaeFtmStakingV1...');
  const saeFtmStakingV1Deployed = await upgrades.deployProxy(saeFtmStakingV1, [erc20Deployed.address, erc721Deployed.address], { initializer: 'initialize', unsafeAllowLinkedLibraries: true });
  await saeFtmStakingV1Deployed.deployed();
  console.log('SaeFtmStakingV1 deployed to:', saeFtmStakingV1Deployed.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
