import hre from "hardhat";
import { expect } from "chai";

require('dotenv').config(); // eslint-disable-line

describe('SaeStakingV1 Unit Tests', function () {
  before('get factories', async function () {
    /**
     * @dev reset hardhat network
     */
    await hre.network.provider.send("hardhat_reset");
    
    /**
     * @dev get contract factories
     * */
    this.saeStakingTypes = await hre.ethers.getContractFactory('SaeStakingTypes');
    this.saeStakingTypesDeployed = await this.saeStakingTypes.deploy();
    await this.saeStakingTypesDeployed.deployed();

    this.saeStakingFunctions = await hre.ethers.getContractFactory('SaeStakingFunctions');
    this.saeStakingFunctionsDeployed = await this.saeStakingFunctions.deploy();
    await this.saeStakingFunctionsDeployed.deployed();

    this.saeConvert = await hre.ethers.getContractFactory('SaeConvert');
    this.saeConvertDeployed = await this.saeConvert.deploy();
    await this.saeConvertDeployed.deployed();

    this.saeViews = await hre.ethers.getContractFactory('SaeViews');
    this.saeViewsDeployed = await this.saeViews.deploy();
    await this.saeViewsDeployed.deployed();

    /**
     * @dev get contract factories
     * */
    this.saeStakingV1 = await hre.ethers.getContractFactory('SaeFtmStakingV1', {
      libraries: {
        SaeStakingFunctions: this.saeStakingFunctionsDeployed.address,
        SaeConvert: this.saeConvertDeployed.address,
        SaeViews: this.saeViewsDeployed.address
      },
    });
    this.saeStakingV2 = await hre.ethers.getContractFactory('MockSaeFtmStakingV2', {
      libraries: {
        SaeStakingFunctions: this.saeStakingFunctionsDeployed.address,
        SaeConvert: this.saeConvertDeployed.address,
        SaeViews: this.saeViewsDeployed.address
      },
    });
    
    this.erc20Contract = await hre.ethers.getContractFactory("MockUsdcToken");
    this.erc721Contract = await hre.ethers.getContractFactory('SaeNft');
    
    /**
     * @dev deploy ERC20 mock token
     * */
    this.erc20Deployed = await this.erc20Contract.deploy();
    await this.erc20Deployed.deployed();
    
    /**
     * @dev deploy ERC721 mock token
     * */
    this.erc721Deployed = await this.erc721Contract.deploy();
    await this.erc721Deployed.deployed();

    /**
     * @dev get test accounts
     * */
    const accounts = await hre.ethers.getSigners();
    this.deployer = accounts[0]
    this.investorAccount = accounts[1];
    this.investorAccount2 = accounts[2];
    this.investorAccount3 = accounts[3];
    this.inactiveInvestorAccount = accounts[4];

    /**
     * Transfer some ERC20s to investorAccount
     * */
     const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "20000000000000000000");
     await transferTx.wait();

     const transferTx2 = await this.erc20Deployed.transfer(this.investorAccount2.address, "20000000000000000000");
     await transferTx2.wait();

     const transferTx3 = await this.erc20Deployed.transfer(this.investorAccount3.address, "20000000000000000000");
     await transferTx3.wait();
  });

  it('deploy proxy', async function () {
    // Act
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();

    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);
    
    const approveTx = await this.erc20WithSigner.approve(this.saeStakingV1Deployed.address, "20000000000000000000");
    await approveTx.wait();

    this.erc20WithSigner2 = this.erc20Deployed.connect(this.investorAccount2);

    const approveTx2 = await this.erc20WithSigner2.approve(this.saeStakingV1Deployed.address, "20000000000000000000");
    await approveTx2.wait();

    this.erc20WithSigner3 = this.erc20Deployed.connect(this.investorAccount3);

    const approveTx3 = await this.erc20WithSigner3.approve(this.saeStakingV1Deployed.address, "20000000000000000000");
    await approveTx3.wait();
  });

  it('upgrade proxy', async function () {
    // Act
    this.saeStakingV2Deployed = await hre.upgrades.upgradeProxy(this.saeStakingV1Deployed, this.saeStakingV2, { unsafeAllowLinkedLibraries: true });
    await this.saeStakingV2Deployed.deployed();
    
    this.saeStakingWithSigner = this.saeStakingV2Deployed.connect(this.investorAccount);

    // Assert
    expect(await this.saeStakingWithSigner.version()).to.be.eq("v2!");
  });

  it(`deposit function should revert 'Deposit amount cannot be 0'`, async function () {
    // Assert
    await expect(this.saeStakingWithSigner.deposit("000", "FTM", "000", true))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Deposit amount cannot be 0'`);
  });

  it(`deposit function should revert 'ERC20: insufficient allowance'`, async function () {
    // Assert
    await expect(this.saeStakingWithSigner.deposit("90000000000000000000", "FTM", "90000000000000000000", true))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'ERC20: insufficient allowance'`);
  });

  it('deposit function should return', async function () {
    // Assert
    await expect(this.saeStakingWithSigner.deposit("10000000000000000000", "FTM", "10000000000000000000", true))
      .to.emit(this.saeStakingWithSigner, "DepositEvent")
      .withArgs(this.investorAccount.address, "10000000000000000000", "FTM", "10000000000000000000", true);
  });

  it('withdraw function should return error', async function () {
    // Assert
    await expect(this.saeStakingWithSigner.withdraw(this.investorAccount.address))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'`);
  });

  it('withdraw function should return', async function () {
    // Arrange
    this.saeStakingWithOwnerSigner = this.saeStakingV2Deployed.connect(this.deployer);

    // Assert
    await this.saeStakingWithOwnerSigner.withdraw(this.investorAccount.address);
  });

  it('convertInvestorDepositToNftValue function should return', async function () {
    // Arrange
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);

    this.tokenId = await this.erc721WithSigner.nextTokenId();
    
    const approveTx = await this.erc721OwnerWithSigner.safeMint(this.investorAccount.address, "tokenUri");
    await approveTx.wait();

    // Assert
    await this.saeStakingWithOwnerSigner.convertInvestorDepositToNftValue(this.investorAccount.address, this.tokenId, "10000000000000000000");
  });

  it(`convertInvestorDepositToNftValue function should revert 'Ownable: caller is not the owner'`, async function () {
    // Assert
    await expect(this.saeStakingWithSigner.convertInvestorDepositToNftValue(this.investorAccount.address, this.tokenId, "10000000000000000000"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'`);
  });

  it(`convertInvestorDepositToNftValue function should revert 'Amount cannot be 0'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertInvestorDepositToNftValue(this.investorAccount.address, this.tokenId, "0"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Amount cannot be 0'`);
  });

  it(`convertInvestorDepositToNftValue function should revert 'Investor not found'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertInvestorDepositToNftValue(this.inactiveInvestorAccount.address, this.tokenId, "10000000000000000000"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Investor not found'`);
  });

  it(`transferErc721 function should revert 'Sender is not NFT address'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.transferErc721(this.investorAccount.address, this.tokenId))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Sender is not NFT address'`);
  });

  it('updateCompoundStatus function should return', async function () {
    // Assert
    await this.saeStakingWithSigner.updateCompoundStatus(this.tokenId, false);
  });

  it(`updateCompoundStatus function should revert 'Not owner of Nft'`, async function () {
    // Arrange
    this.saeStakingWithInactiveInvestorSigner = this.saeStakingV2Deployed.connect(this.inactiveInvestorAccount);

    // Assert
    await expect(this.saeStakingWithInactiveInvestorSigner.updateCompoundStatus(this.tokenId, false))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Not owner of Nft'`);
  });

  it('requestDivestmentNextMonth function should return', async function () {
    // Assert
    await this.saeStakingWithSigner.requestDivestmentNextMonth(this.tokenId, "FTM");
  });

  it(`requestDivestmentNextMonth function should revert 'NftValue not found'`, async function () {
    // Assert
    await expect(this.saeStakingWithInactiveInvestorSigner.requestDivestmentNextMonth(this.tokenId, "FTM"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'NftValue not found'`);
  });

  it('assignRewards function should return', async function () {
    // Arrange
    this.saeStakingWithSigner2 = this.saeStakingV2Deployed.connect(this.investorAccount2);

    await this.saeStakingWithSigner2.deposit("10000000000000000000", "FTM", "10000000000000000000", false);

    this.erc721WithSigner2 = this.erc721Deployed.connect(this.investorAccount2);

    this.tokenId2 = await this.erc721WithSigner.nextTokenId();
    
    const approveTx = await this.erc721OwnerWithSigner.safeMint(this.investorAccount2.address, "tokenUri");
    await approveTx.wait();

    // Assert
    await this.saeStakingWithOwnerSigner.assignRewards(5, 2022, 1, 100);
  });

  it(`convertNftValueDivestmentToInvestor function should return`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueDivestmentToInvestor(this.investorAccount.address, this.tokenId, "10000000000000000000", "FTM"));
  });

  it(`convertNftValueDivestmentToInvestor function should revert 'Investor not found'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueDivestmentToInvestor(this.inactiveInvestorAccount.address, this.tokenId, "10000000000000000000", "FTM"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Investor not found'`);
  });

  it(`convertNftValueDivestmentToInvestor function should revert 'Amount cannot be 0'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueDivestmentToInvestor(this.investorAccount.address, this.tokenId, "0", "FTM"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Amount cannot be 0'`);
  });

  it(`convertNftValueDivestmentToInvestor function should revert 'ERC721: Not owner of NFT'`, async function () {
    // Arrange
    this.saeStakingWithSigner3 = this.saeStakingV2Deployed.connect(this.investorAccount3);

    await this.saeStakingWithSigner3.deposit("10000000000000000000", "FTM", "10000000000000000000", false);

    this.erc721WithSigner3 = this.erc721Deployed.connect(this.investorAccount2);

    this.tokenId3 = await this.erc721WithSigner.nextTokenId();
    
    const approveTx = await this.erc721OwnerWithSigner.safeMint(this.investorAccount2.address, "tokenUri");
    await approveTx.wait();

    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueDivestmentToInvestor(this.investorAccount3.address, this.tokenId, "10000000000000000000", "FTM"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'ERC721: Not owner of NFT'`);
  });

  it(`convertNftValueRewardToInvestor function should return`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueRewardToInvestor(this.investorAccount2.address, this.tokenId2, "10000000000000000000"));
  });

  it(`convertNftValueRewardToInvestor function should revert 'Investor not found'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueRewardToInvestor(this.inactiveInvestorAccount.address, this.tokenId, "10000000000000000000"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Investor not found'`);
  });

  it(`convertNftValueRewardToInvestor function should revert 'Amount cannot be 0'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueRewardToInvestor(this.investorAccount2.address, this.tokenId, "0"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Amount cannot be 0'`);
  });

  it(`convertNftValueRewardToInvestor function should revert 'ERC721: Not owner of NFT'`, async function () {
    // Assert
    await expect(this.saeStakingWithOwnerSigner.convertNftValueRewardToInvestor(this.investorAccount3.address, this.tokenId, "10000000000000000000"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'ERC721: Not owner of NFT'`);
  });

  it('retrieveDivestment function should return', async function () {
    // Assert
    await expect(this.saeStakingWithSigner.retrieveDivestment("FTM"))
      .to.emit(this.saeStakingWithSigner, "RetrieveDivestmentEvent")
      .withArgs(this.investorAccount.address, "10000000000000000000", "FTM");
  });

  it(`retrieveDivestment function should revert 'Investor not found'`, async function () {
    // Assert
    await expect(this.saeStakingWithInactiveInvestorSigner.retrieveDivestment("FTM"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Investor not found'`);
  });

  it(`retrieveDivestment function should revert 'Divestment empty'`, async function () {
    // Assert
    await expect(this.saeStakingWithSigner.retrieveDivestment("FTM"))
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Divestment empty'`);
  });

  it('claimRewards function should return', async function () {
    // Assert
    await expect(this.saeStakingWithSigner2.claimRewards());
  });

  it(`claimRewards function should revert 'Investor not found'`, async function () {
    // Assert
    await expect(this.saeStakingWithInactiveInvestorSigner.claimRewards())
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Investor not found'`);
  });

  it(`claimRewards function should revert 'Reward empty'`, async function () {
    // Assert
    await expect(this.saeStakingWithSigner.claimRewards())
      .to.be
      .revertedWith(`VM Exception while processing transaction: reverted with reason string 'Rewards empty'`);
  });
});
