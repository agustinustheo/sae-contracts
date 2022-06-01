// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from 'hardhat';

async function main() {
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
  await erc20Deployed.transfer(first.address, "1000000");

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

  let saeStakingSigner;
  const nftIds = [];
  for (let i = 0; i < 3; i++) {
    console.log('Connecting the first account to ERC20 contract...');
    const erc20WithSigner = erc20Deployed.connect(first);

    const approveTx = await erc20WithSigner.approve(saeFtmStakingV1Deployed.address, "1000000");
    await approveTx.wait();
    console.log('Approved ERC20 to be used by smart contract');

    saeStakingSigner = saeFtmStakingV1Deployed.connect(first);
    if (i == 2) await saeStakingSigner.deposit("10000", "FTM", "5000", false);
    else await saeStakingSigner.deposit("10000", "FTM", "5000", true);
    
    console.log('Connecting the first account to ERC721 contract...');
    const erc721WithSigner = erc721Deployed.connect(first);

    const approveTx2 = await erc721WithSigner.safeMint(first.address, "tokenUri");
    await approveTx2.wait();
    console.log('Minted ERC721 tokens');

    const nftLngth = await erc721WithSigner.balanceOf(first.address);
    console.log(`Number of NFTs by ${first.address}: ${nftLngth}`)

    const nftId = await erc721WithSigner.getTokenOwnerByIndex(first.address, i);
    await saeStakingSigner.convertInvestorDepositToNftValue(first.address, nftId, "10000");
    console.log("NFT Token ID ", i + 1, " : ", nftId);

    if (i == 1) {
      const reqDivestTrx = await saeStakingSigner.requestDivestmentNextMonth(nftId, "FTM");
      await reqDivestTrx.wait();
    }
    nftIds.push(nftId);
  }
  await saeStakingSigner?.assignRewards("5", "2022", "1", "100");

  await saeStakingSigner?.convertNftValueDivestmentToInvestor(first.address, nftIds[1], "1000", "FTM");
  await saeStakingSigner?.convertNftValueRewardToInvestor(first.address, nftIds[2], "100");
  
  const nftValueOf4 = await saeStakingSigner?.nftValueOf(nftIds[0]);
  console.log(nftValueOf4);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
