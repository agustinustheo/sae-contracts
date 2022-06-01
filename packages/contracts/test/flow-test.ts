import hre from "hardhat";
import { expect } from "chai";

require('dotenv').config(); // eslint-disable-line

describe('SaeStakingV1 Unit Tests', function () {
  beforeEach('get factories', async function () {
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
    this.tempAccount = accounts[2];
  });

  it('happy flow deposit -> mint -> convert -> divest', async function () {
    /**
     * Transfer some ERC20s to investorAccount
     * */
    const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "1000");
    await transferTx.wait();

    // Deploy proxy
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();
    
    // Connect with owner of Staking contract
    this.saeStakingV1OwnerWithSigner = this.saeStakingV1Deployed.connect(this.deployer);
    
    // Connect with owner of ERC721
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);
    
    // Set proxy
    const setTrx = await this.erc721OwnerWithSigner.setProxy(this.saeStakingV1Deployed.address);
    await setTrx.wait();
    
    // Connect ERC20 contract
    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);
    
    // Approve ERC20 contract
    const approveTx = await this.erc20WithSigner.approve(this.saeStakingV1Deployed.address, "1000");
    await approveTx.wait();

    // Connect Escrow contract
    this.saeStakingV1WithSigner = this.saeStakingV1Deployed.connect(this.investorAccount);
    
    // Deposit sum
    const depositTrx = await this.saeStakingV1WithSigner.deposit("100", "FTM", "50", true);
    await depositTrx.wait();
    
    // Assert PendingInvestorList
    const pendingInvestorList = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList.length).to.equal(1);

    // Assert account balance
    const erc20BalanceOf = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf).to.equal("900");

    // Assert contract balance
    const contractBalanceOf = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf).to.equal("100");

    // Assert InvestorOf
    const investorOf = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf.depositTokenAmount).to.equal("100");
    expect(investorOf.isCompound).to.be.true;
    expect(investorOf.isValue).to.be.true;

    // Connect ERC721 contract
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);

    // Get Token ID
    this.tokenId = await this.erc721WithSigner.nextTokenId();
    
    // Mint
    const safeMintTrx = await this.erc721OwnerWithSigner.safeMint(this.investorAccount.address, "tokenUri");
    await safeMintTrx.wait();

    // Assert NFT Balance
    const nftBalanceOf = await this.erc721WithSigner.numberNftsOwned(this.investorAccount.address);
    expect(nftBalanceOf).to.equal("1");

    // Convert to NFT Value
    const convertTrx = await this.saeStakingV1OwnerWithSigner.convertInvestorDepositToNftValue(this.investorAccount.address, this.tokenId, "100");
    await convertTrx.wait();

    // Assert PendingInvestorList
    const pendingInvestorList2 = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList2.length).to.equal(0);

    // Assert InvestorOf
    const investorOf2 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf2.depositTokenAmount).to.equal("0");
    expect(investorOf2.isCompound).to.be.false;
    expect(investorOf2.isValue).to.be.true;

    // Assert NftValueOf
    const nftValueOf = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf.nftId).to.equal(this.tokenId);
    expect(nftValueOf.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf.usdInitialDeposit).to.equal("50");
    expect(nftValueOf.saeBalance).to.equal("100");
    expect(nftValueOf.history.length).to.equal(1);

    expect(nftValueOf.isCompound).to.be.true;
    expect(nftValueOf.isValue).to.be.true;

    expect(nftValueOf.monthlyRewardPercentage).to.equal("80");

    // Request divestment
    const reqDivestTrx = await this.saeStakingV1WithSigner.requestDivestmentNextMonth(this.tokenId, "FTM");
    await reqDivestTrx.wait();

    // Assert NftValueOf
    const nftValueOf2 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf2.nftId).to.equal(this.tokenId);
    expect(nftValueOf2.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf2.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf2.usdInitialDeposit).to.equal("50");
    expect(nftValueOf2.saeBalance).to.equal("0");
    expect(nftValueOf2.saeDivestment).to.equal("100");
    expect(nftValueOf2.history.length).to.equal(2);

    expect(nftValueOf2.isDivesting).to.be.true;
    expect(nftValueOf2.isCompound).to.be.true;
    expect(nftValueOf2.isValue).to.be.true;

    expect(nftValueOf2.monthlyRewardPercentage).to.equal("80");

    // Assign rewards
    const assignRewardsTrx = await this.saeStakingV1OwnerWithSigner.assignRewards("5", "2022", "1", "100");
    await assignRewardsTrx.wait();

    // Assert TransactionOf
    const transactionOf = await this.saeStakingV1OwnerWithSigner.transactionOf("5", "2022");
    const accountTransactionOf = transactionOf[0];

    expect(accountTransactionOf.nftId).to.equal(this.tokenId);
    expect(accountTransactionOf.investorAddr).to.equal(this.investorAccount.address);
    
    expect(accountTransactionOf.saeBalance).to.equal("0");
    expect(accountTransactionOf.saeDivestment).to.equal("100");
    expect(accountTransactionOf.saeRewardsThisPeriod).to.equal("0");
    
    expect(accountTransactionOf.nftStatus).to.equal(+2);
    expect(accountTransactionOf.nftStrategy).to.equal(+1);
    
    expect(accountTransactionOf.isValue).to.true;
    expect(accountTransactionOf.accrue).to.false;

    const adminTransactionOf = transactionOf[1];

    expect(adminTransactionOf.nftId).to.equal(this.tokenId);
    
    expect(adminTransactionOf.saeBalance).to.equal("0");
    expect(adminTransactionOf.saeDivestment).to.equal("0");
    expect(adminTransactionOf.saeRewardsThisPeriod).to.equal("1");
    
    expect(adminTransactionOf.nftStatus).to.equal(+2);
    expect(adminTransactionOf.nftStrategy).to.equal(+1);
    
    expect(adminTransactionOf.isValue).to.true;
    expect(adminTransactionOf.accrue).to.true;
    
    // Assert TotalSaePayoutOf
    const totalSaePayoutOf = await this.saeStakingV1OwnerWithSigner.totalSaePayoutOf("5", "2022");
    expect(totalSaePayoutOf.totalSaePayout).to.equal("100");

    // Convert divestment
    const convertDivestTrx = await this.saeStakingV1OwnerWithSigner.convertNftValueDivestmentToInvestor(this.investorAccount.address, this.tokenId, "100", "FTM");
    await convertDivestTrx.wait();

    // Assert NftValueOf
    const nftValueOf3 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf3.nftId).to.equal(this.tokenId);
    expect(nftValueOf3.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf3.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf3.usdInitialDeposit).to.equal("50");
    expect(nftValueOf3.saeBalance).to.equal("0");
    expect(nftValueOf3.saeDivestment).to.equal("0");
    expect(nftValueOf3.history.length).to.equal(3);

    expect(nftValueOf3.isDivesting).to.be.false;
    expect(nftValueOf3.isCompound).to.be.true;
    expect(nftValueOf3.isValue).to.be.true;

    expect(nftValueOf3.monthlyRewardPercentage).to.equal("80");

    // Assert InvestorOf
    const investorOf3 = await this.saeStakingV1WithSigner.investorOfWithDivestmentAmount(this.investorAccount.address, "FTM");
    expect(investorOf3.divestmentTokenAmount).to.equal("100");
    expect(investorOf3.depositTokenAmount).to.equal("0");

    expect(investorOf3.burnedNftIds[0]).to.equal(this.tokenId);
    
    expect(investorOf3.isCompound).to.be.false;
    expect(investorOf3.isValue).to.be.true;

    // Request divestment
    const divestmentTrx = await this.saeStakingV1WithSigner.retrieveDivestment("FTM");
    await divestmentTrx.wait();

    // Assert NftValueOf
    const nftValueOf4 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf4.nftId).to.equal(this.tokenId);
    expect(nftValueOf4.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf4.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf4.usdInitialDeposit).to.equal("50");
    expect(nftValueOf4.saeBalance).to.equal("0");
    expect(nftValueOf4.saeDivestment).to.equal("0");
    expect(nftValueOf4.history.length).to.equal(4);

    expect(nftValueOf4.isBurned).to.be.true;
    expect(nftValueOf4.isDivesting).to.be.false;
    expect(nftValueOf4.isCompound).to.be.true;
    expect(nftValueOf4.isValue).to.be.true;

    expect(nftValueOf4.monthlyRewardPercentage).to.equal("80");

    // Assert InvestorOf
    const investorOf4 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf4.divestmentTokenAmount).to.equal("0");
    expect(investorOf4.depositTokenAmount).to.equal("0");

    expect(investorOf4.burnedNftIds[0]).to.equal(this.tokenId);
    
    expect(investorOf4.isCompound).to.be.false;
    expect(investorOf4.isValue).to.be.true;

    // Assert account balance
    const erc20BalanceOf2 = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf2).to.equal("1000");

    // Assert contract balance
    const contractBalanceOf2 = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf2).to.equal("0");

    // Check if NFT exists
    expect(await this.erc721WithSigner.exists(this.tokenId)).to.be.false;
  });

  it('happy flow deposit -> mint -> convert -> claim', async function () {
    /**
     * Transfer some ERC20s to investorAccount
     * */
    const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "100000");
    await transferTx.wait();

    // Deploy proxy
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();
    
    // Connect with owner of Staking contract
    this.saeStakingV1OwnerWithSigner = this.saeStakingV1Deployed.connect(this.deployer);
    
    // Connect with owner of ERC721
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);
    
    // Set proxy
    const setTrx = await this.erc721OwnerWithSigner.setProxy(this.saeStakingV1Deployed.address);
    await setTrx.wait();
    
    // Connect ERC20 contract
    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);
    
    // Approve ERC20 contract
    const approveTx = await this.erc20WithSigner.approve(this.saeStakingV1Deployed.address, "100000");
    await approveTx.wait();

    // Connect Escrow contract
    this.saeStakingV1WithSigner = this.saeStakingV1Deployed.connect(this.investorAccount);

    // Deposit sum
    const depositTrx = await this.saeStakingV1WithSigner.deposit("1000", "FTM", "500", false);
    await depositTrx.wait();
    
    // Assert PendingInvestorList
    const pendingInvestorList = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList.length).to.equal(1);

    // Assert account balance
    const erc20BalanceOf = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf).to.equal("99000");

    // Assert contract balance
    const contractBalanceOf = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf).to.equal("1000");

    // Assert InvestorOf
    const investorOf = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf.depositTokenAmount).to.equal("1000");
    expect(investorOf.isCompound).to.be.false;
    expect(investorOf.isValue).to.be.true;

    // Connect ERC721 contract
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);

    // Get Token ID
    this.tokenId = await this.erc721WithSigner.nextTokenId();
    
    // Mint
    const safeMintTrx = await this.erc721OwnerWithSigner.safeMint(this.investorAccount.address, "tokenUri");
    await safeMintTrx.wait();

    // Assert NFT Balance
    const nftBalanceOf = await this.erc721WithSigner.numberNftsOwned(this.investorAccount.address);
    expect(nftBalanceOf).to.equal("1");

    // Convert to NFT Value
    const convertTrx = await this.saeStakingV1OwnerWithSigner.convertInvestorDepositToNftValue(this.investorAccount.address, this.tokenId, "10000");
    await convertTrx.wait();

    // Assert PendingInvestorList
    const pendingInvestorList2 = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList2.length).to.equal(0);

    // Assert InvestorOf
    const investorOf2 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf2.depositTokenAmount).to.equal("0");
    expect(investorOf2.isCompound).to.be.false;
    expect(investorOf2.isValue).to.be.true;

    // Assert NftValueOf
    const nftValueOf = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf.nftId).to.equal(this.tokenId);
    expect(nftValueOf.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf.initialDepositTokenAmount).to.equal("1000");
    expect(nftValueOf.usdInitialDeposit).to.equal("500");
    expect(nftValueOf.saeBalance).to.equal("10000");

    expect(nftValueOf.isCompound).to.be.false;
    expect(nftValueOf.isValue).to.be.true;

    expect(nftValueOf.monthlyRewardPercentage).to.equal("80");

    // Assign rewards
    const assignRewardsTrx = await this.saeStakingV1OwnerWithSigner.assignRewards("5", "2022", "1", "100");
    await assignRewardsTrx.wait();

    // Assert TransactionOf
    const transactionOf = await this.saeStakingV1OwnerWithSigner.transactionOf("5", "2022");
    const accountTransactionOf = transactionOf[0];

    expect(accountTransactionOf.nftId).to.equal(this.tokenId);
    expect(accountTransactionOf.investorAddr).to.equal(this.investorAccount.address);
    
    expect(accountTransactionOf.saeBalance).to.equal("10000");
    expect(accountTransactionOf.saeDivestment).to.equal("0");
    expect(accountTransactionOf.saeRewardsThisPeriod).to.equal("80");
    
    expect(accountTransactionOf.nftStatus).to.equal(+0);
    expect(accountTransactionOf.nftStrategy).to.equal(+2);
    
    expect(accountTransactionOf.isValue).to.true;
    expect(accountTransactionOf.accrue).to.true;

    const adminTransactionOf = transactionOf[1];

    expect(adminTransactionOf.nftId).to.equal(this.tokenId);
    
    expect(adminTransactionOf.saeBalance).to.equal("0");
    expect(adminTransactionOf.saeDivestment).to.equal("0");
    expect(adminTransactionOf.saeRewardsThisPeriod).to.equal("20");
    
    expect(adminTransactionOf.nftStatus).to.equal(+0);
    expect(adminTransactionOf.nftStrategy).to.equal(+2);
    
    expect(adminTransactionOf.isValue).to.true;
    expect(adminTransactionOf.accrue).to.true;
    
    // Assert TotalSaePayoutOf
    const totalSaePayoutOf = await this.saeStakingV1OwnerWithSigner.totalSaePayoutOf("5", "2022");
    expect(totalSaePayoutOf.totalSaePayout).to.equal("80");

    // Assert NftValueOf
    const nftValueOf3 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf3.nftId).to.equal(this.tokenId);
    expect(nftValueOf3.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf3.initialDepositTokenAmount).to.equal("1000");
    expect(nftValueOf3.usdInitialDeposit).to.equal("500");
    expect(nftValueOf3.saeBalance).to.equal("10000");
    expect(nftValueOf3.saeReward).to.equal("80");

    expect(nftValueOf3.isCompound).to.be.false;
    expect(nftValueOf3.isValue).to.be.true;

    expect(nftValueOf3.monthlyRewardPercentage).to.equal("80");

    // Assign rewards
    const convertRewardsTrx = await this.saeStakingV1OwnerWithSigner.convertNftValueRewardToInvestor(this.investorAccount.address, this.tokenId, "80");
    await convertRewardsTrx.wait();

    // Assert InvestorOf
    const investorOf3 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf3.depositTokenAmount).to.equal("0");
    expect(investorOf3.ftmReward).to.equal("80");
    expect(investorOf3.isCompound).to.be.false;
    expect(investorOf3.isValue).to.be.true;

    // Assert InvestorOf
    const claimTrx = await this.saeStakingV1WithSigner.claimRewards();
    await claimTrx.wait();

    // Assert account balance
    const erc20BalanceOf2 = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf2).to.equal("99080");

    // Assert contract balance
    const contractBalanceOf2 = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf2).to.equal("920");
  });

  it('happy flow deposit -> mint -> convert -> compound', async function () {
    /**
     * Transfer some ERC20s to investorAccount
     * */
    const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "100000");
    await transferTx.wait();

    // Deploy proxy
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();

    // Connect with owner of Staking contract
    this.saeStakingV1OwnerWithSigner = this.saeStakingV1Deployed.connect(this.deployer);

    // Connect with owner of ERC721
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);

    // Set proxy
    const setTrx = await this.erc721OwnerWithSigner.setProxy(this.saeStakingV1Deployed.address);
    await setTrx.wait();

    // Connect ERC20 contract
    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);

    // Approve ERC20 contract
    const approveTx = await this.erc20WithSigner.approve(this.saeStakingV1Deployed.address, "100000");
    await approveTx.wait();

    // Connect Escrow contract
    this.saeStakingV1WithSigner = this.saeStakingV1Deployed.connect(this.investorAccount);

    // Deposit sum
    const depositTrx = await this.saeStakingV1WithSigner.deposit("10000", "FTM", "5000", true);
    await depositTrx.wait();
    
    // Assert PendingInvestorList
    const pendingInvestorList = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList.length).to.equal(1);

    // Assert account balance
    const erc20BalanceOf = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf).to.equal("90000");

    // Assert contract balance
    const contractBalanceOf = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf).to.equal("10000");

    // Assert InvestorOf
    const investorOf = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf.depositTokenAmount).to.equal("10000");
    expect(investorOf.isCompound).to.be.true;
    expect(investorOf.isValue).to.be.true;

    // Connect ERC721 contract
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);

    // Get Token ID
    this.tokenId = await this.erc721WithSigner.nextTokenId();

    // Mint
    const safeMintTrx = await this.erc721OwnerWithSigner.safeMint(this.investorAccount.address, "tokenUri");
    await safeMintTrx.wait();

    // Assert NFT Balance
    const nftBalanceOf = await this.erc721WithSigner.numberNftsOwned(this.investorAccount.address);
    expect(nftBalanceOf).to.equal("1");

    // Convert to NFT Value
    const convertTrx = await this.saeStakingV1OwnerWithSigner.convertInvestorDepositToNftValue(this.investorAccount.address, this.tokenId, "10000");
    await convertTrx.wait();

    // Assert PendingInvestorList
    const pendingInvestorList2 = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList2.length).to.equal(0);

    // Assert InvestorOf
    const investorOf2 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf2.depositTokenAmount).to.equal("0");
    expect(investorOf2.isCompound).to.be.false;
    expect(investorOf2.isValue).to.be.true;

    // Assert NftValueOf
    const nftValueOf = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf.nftId).to.equal(this.tokenId);
    expect(nftValueOf.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf.initialDepositTokenAmount).to.equal("10000");
    expect(nftValueOf.usdInitialDeposit).to.equal("5000");
    expect(nftValueOf.saeBalance).to.equal("10000");

    expect(nftValueOf.isCompound).to.be.true;
    expect(nftValueOf.isValue).to.be.true;

    expect(nftValueOf.monthlyRewardPercentage).to.equal("80");

    // Assign rewards
    const assignRewardsTrx = await this.saeStakingV1OwnerWithSigner.assignRewards("5", "2022", "1", "100");
    await assignRewardsTrx.wait();

    // Assert TransactionOf
    const transactionOf = await this.saeStakingV1OwnerWithSigner.transactionOf("5", "2022");
    const accountTransactionOf = transactionOf[0];

    expect(accountTransactionOf.nftId).to.equal(this.tokenId);
    expect(accountTransactionOf.investorAddr).to.equal(this.investorAccount.address);

    expect(accountTransactionOf.saeBalance).to.equal("10000");
    expect(accountTransactionOf.saeDivestment).to.equal("0");
    expect(accountTransactionOf.saeRewardsThisPeriod).to.equal("80");

    expect(accountTransactionOf.nftStatus).to.equal(+0);
    expect(accountTransactionOf.nftStrategy).to.equal(+0);

    expect(accountTransactionOf.isValue).to.true;
    expect(accountTransactionOf.accrue).to.true;

    const adminTransactionOf = transactionOf[1];

    expect(adminTransactionOf.nftId).to.equal(this.tokenId);

    expect(adminTransactionOf.saeBalance).to.equal("0");
    expect(adminTransactionOf.saeDivestment).to.equal("0");
    expect(adminTransactionOf.saeRewardsThisPeriod).to.equal("20");

    expect(adminTransactionOf.nftStatus).to.equal(+0);
    expect(adminTransactionOf.nftStrategy).to.equal(+0);

    expect(adminTransactionOf.isValue).to.true;
    expect(adminTransactionOf.accrue).to.true;

    // Assert TotalSaePayoutOf
    const totalSaePayoutOf = await this.saeStakingV1OwnerWithSigner.totalSaePayoutOf("5", "2022");
    expect(totalSaePayoutOf.totalSaePayout).to.equal("0");

    // Assert NftValueOf
    const nftValueOf3 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf3.nftId).to.equal(this.tokenId);
    expect(nftValueOf3.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf3.initialDepositTokenAmount).to.equal("10000");
    expect(nftValueOf3.usdInitialDeposit).to.equal("5000");
    expect(nftValueOf3.saeBalance).to.equal("10080");
    expect(nftValueOf3.saeReward).to.equal("0");

    expect(nftValueOf3.isCompound).to.be.true;
    expect(nftValueOf3.isValue).to.be.true;

    expect(nftValueOf3.monthlyRewardPercentage).to.equal("80");

    // Assign rewards
    const convertRewardsTrx = await this.saeStakingV1OwnerWithSigner.convertNftValueRewardToInvestor(this.investorAccount.address, this.tokenId, "80");
    await convertRewardsTrx.wait();

    // Assert InvestorOf
    const investorOf3 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf3.depositTokenAmount).to.equal("0");
    expect(investorOf3.ftmReward).to.equal("0");
    expect(investorOf3.isCompound).to.be.false;
    expect(investorOf3.isValue).to.be.true;
  });

  it('happy flow deposit -> mint -> convert -> transfer -> divest', async function () {
    /**
     * Transfer some ERC20s to investorAccount
     * */
    const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "1000");
    await transferTx.wait();

    /**
     * Transfer some ERC20s to tempAccount
     * */
    const transferTx2 = await this.erc20Deployed.transfer(this.tempAccount.address, "1000");
    await transferTx2.wait();

    // Deploy proxy
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();

    // Connect with owner of Staking contract
    this.saeStakingV1OwnerWithSigner = this.saeStakingV1Deployed.connect(this.deployer);

    // Connect with owner of ERC721
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);

    // Set proxy
    const setTrx = await this.erc721OwnerWithSigner.setProxy(this.saeStakingV1Deployed.address);
    await setTrx.wait();

    // Connect ERC20 contract
    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);
    this.erc20WithSigner2 = this.erc20Deployed.connect(this.tempAccount);

    // Approve ERC20 contract
    const approveTx = await this.erc20WithSigner2.approve(this.saeStakingV1Deployed.address, "1000");
    await approveTx.wait();

    // Connect Escrow contract
    this.saeStakingV1WithSigner = this.saeStakingV1Deployed.connect(this.investorAccount);
    this.saeStakingV1WithSigner2 = this.saeStakingV1Deployed.connect(this.tempAccount);

    // Deposit sum
    const depositTrx = await this.saeStakingV1WithSigner2.deposit("100", "FTM", "50", true);
    await depositTrx.wait();
    
    // Assert PendingInvestorList
    const pendingInvestorList = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList.length).to.equal(1);

    // Assert account balance
    const erc20BalanceOf = await this.erc20WithSigner2.balanceOf(this.tempAccount.address);
    expect(erc20BalanceOf).to.equal("900");

    // Assert contract balance
    const contractBalanceOf = await this.erc20WithSigner2.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf).to.equal("100");

    // Assert InvestorOf
    const investorOf = await this.saeStakingV1WithSigner2.investorOf(this.tempAccount.address);
    expect(investorOf.depositTokenAmount).to.equal("100");
    expect(investorOf.isCompound).to.be.true;
    expect(investorOf.isValue).to.be.true;

    // Connect ERC721 contract
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);
    this.erc721WithSigner2 = this.erc721Deployed.connect(this.tempAccount);

    // Get Token ID
    this.tokenId = await this.erc721WithSigner2.nextTokenId();

    // Mint
    const safeMintTrx = await this.erc721OwnerWithSigner.safeMint(this.tempAccount.address, "tokenUri");
    await safeMintTrx.wait();

    // Assert NFT Balance
    const nftBalanceOf = await this.erc721WithSigner2.balanceOf(this.tempAccount.address);
    expect(nftBalanceOf).to.equal("1");

    // Convert to NFT Value
    const convertTrx = await this.saeStakingV1OwnerWithSigner.convertInvestorDepositToNftValue(this.tempAccount.address, this.tokenId, "100");
    await convertTrx.wait();

    // Assert PendingInvestorList
    const pendingInvestorList2 = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList2.length).to.equal(0);

    // Assert InvestorOf
    const investorOf2 = await this.saeStakingV1WithSigner2.investorOf(this.tempAccount.address);
    expect(investorOf2.depositTokenAmount).to.equal("0");
    expect(investorOf2.isCompound).to.be.false;
    expect(investorOf2.isValue).to.be.true;

    // Assert NftValueOf
    const nftValueOf = await this.saeStakingV1WithSigner2.nftValueOf(this.tokenId);
    expect(nftValueOf.nftId).to.equal(this.tokenId);
    expect(nftValueOf.nftOwner).to.equal(this.tempAccount.address);

    expect(nftValueOf.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf.usdInitialDeposit).to.equal("50");
    expect(nftValueOf.saeBalance).to.equal("100");

    expect(nftValueOf.isCompound).to.be.true;
    expect(nftValueOf.isValue).to.be.true;

    expect(nftValueOf.monthlyRewardPercentage).to.equal("80");

    // Transfer token
    const trfTokenTrx = await this.erc721WithSigner2.transferFrom(this.tempAccount.address, this.investorAccount.address, this.tokenId);
    await trfTokenTrx.wait();

    // Request divestment
    const reqDivestTrx = await this.saeStakingV1WithSigner.requestDivestmentNextMonth(this.tokenId, "FTM");
    await reqDivestTrx.wait();

    // Assert NftValueOf
    const nftValueOf2 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf2.nftId).to.equal(this.tokenId);
    expect(nftValueOf2.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf2.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf2.usdInitialDeposit).to.equal("50");
    expect(nftValueOf2.saeBalance).to.equal("0");
    expect(nftValueOf2.saeDivestment).to.equal("100");

    expect(nftValueOf2.isDivesting).to.be.true;
    expect(nftValueOf2.isCompound).to.be.true;
    expect(nftValueOf2.isValue).to.be.true;

    expect(nftValueOf2.monthlyRewardPercentage).to.equal("80");

    // Assert InvestorOf
    const investorOf3 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf3.isValue).to.be.true;

    // Assign rewards
    const assignRewardsTrx = await this.saeStakingV1OwnerWithSigner.assignRewards("5", "2022", "1", "100");
    await assignRewardsTrx.wait();

    // Assert TransactionOf
    const transactionOf = await this.saeStakingV1OwnerWithSigner.transactionOf("5", "2022");
    const accountTransactionOf = transactionOf[0];

    expect(accountTransactionOf.nftId).to.equal(this.tokenId);
    expect(accountTransactionOf.investorAddr).to.equal(this.investorAccount.address);

    expect(accountTransactionOf.saeBalance).to.equal("0");
    expect(accountTransactionOf.saeDivestment).to.equal("100");
    expect(accountTransactionOf.saeRewardsThisPeriod).to.equal("0");

    expect(accountTransactionOf.nftStatus).to.equal(+2);
    expect(accountTransactionOf.nftStrategy).to.equal(+1);

    expect(accountTransactionOf.isValue).to.true;
    expect(accountTransactionOf.accrue).to.false;

    const adminTransactionOf = transactionOf[1];

    expect(adminTransactionOf.nftId).to.equal(this.tokenId);

    expect(adminTransactionOf.saeBalance).to.equal("0");
    expect(adminTransactionOf.saeDivestment).to.equal("0");
    expect(adminTransactionOf.saeRewardsThisPeriod).to.equal("1");

    expect(adminTransactionOf.nftStatus).to.equal(+2);
    expect(adminTransactionOf.nftStrategy).to.equal(+1);

    expect(adminTransactionOf.isValue).to.true;
    expect(adminTransactionOf.accrue).to.true;

    // Assert TotalSaePayoutOf
    const totalSaePayoutOf = await this.saeStakingV1OwnerWithSigner.totalSaePayoutOf("5", "2022");
    expect(totalSaePayoutOf.totalSaePayout).to.equal("100");

    // Convert divestment
    const convertDivestTrx = await this.saeStakingV1OwnerWithSigner.convertNftValueDivestmentToInvestor(this.investorAccount.address, this.tokenId, "100", "FTM");
    await convertDivestTrx.wait();

    // Assert NftValueOf
    const nftValueOf3 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf3.nftId).to.equal(this.tokenId);
    expect(nftValueOf3.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf3.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf3.usdInitialDeposit).to.equal("50");
    expect(nftValueOf3.saeBalance).to.equal("0");
    expect(nftValueOf3.saeDivestment).to.equal("0");

    expect(nftValueOf3.isDivesting).to.be.false;
    expect(nftValueOf3.isTransferred).to.be.false;
    expect(nftValueOf3.isCompound).to.be.true;
    expect(nftValueOf3.isValue).to.be.true;

    expect(nftValueOf3.monthlyRewardPercentage).to.equal("80");

    // Assert InvestorOf
    const investorOf4 = await this.saeStakingV1WithSigner.investorOfWithDivestmentAmount(this.investorAccount.address, "FTM");
    expect(investorOf4.divestmentTokenAmount).to.equal("100");
    expect(investorOf4.depositTokenAmount).to.equal("0");

    expect(investorOf4.burnedNftIds[0]).to.equal(this.tokenId);

    expect(investorOf4.isCompound).to.be.false;
    expect(investorOf4.isValue).to.be.true;

    // Request divestment
    const divestmentTrx = await this.saeStakingV1WithSigner.retrieveDivestment("FTM");
    await divestmentTrx.wait();

    // Assert NftValueOf
    const nftValueOf4 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf4.nftId).to.equal(this.tokenId);
    expect(nftValueOf4.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf4.initialDepositTokenAmount).to.equal("100");
    expect(nftValueOf4.usdInitialDeposit).to.equal("50");
    expect(nftValueOf4.saeBalance).to.equal("0");
    expect(nftValueOf4.saeDivestment).to.equal("0");

    expect(nftValueOf4.isBurned).to.be.true;
    expect(nftValueOf4.isDivesting).to.be.false;
    expect(nftValueOf4.isCompound).to.be.true;
    expect(nftValueOf4.isValue).to.be.true;

    expect(nftValueOf4.monthlyRewardPercentage).to.equal("80");

    // Assert InvestorOf
    const investorOf5 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf5.divestmentTokenAmount).to.equal("0");
    expect(investorOf5.depositTokenAmount).to.equal("0");

    expect(investorOf5.burnedNftIds[0]).to.equal(this.tokenId);

    expect(investorOf5.isCompound).to.be.false;
    expect(investorOf5.isValue).to.be.true;

    // Assert account balance
    const erc20BalanceOf2 = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf2).to.equal("1100");

    // Assert contract balance
    const contractBalanceOf2 = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf2).to.equal("0");

    // Check if NFT exists
    expect(await this.erc721WithSigner.exists(this.tokenId)).to.be.false;
  });

  it('happy flow deposit -> mint -> convert -> transfer -> claim', async function () {
    /**
     * Transfer some ERC20s to investorAccount
     * */
    const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "100000");
    await transferTx.wait();

    /**
     * Transfer some ERC20s to tempAccount
     * */
    const transferTx2 = await this.erc20Deployed.transfer(this.tempAccount.address, "100000");
    await transferTx2.wait();

    // Deploy proxy
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();

    // Connect with owner of Staking contract
    this.saeStakingV1OwnerWithSigner = this.saeStakingV1Deployed.connect(this.deployer);

    // Connect with owner of ERC721
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);

    // Set proxy
    const setTrx = await this.erc721OwnerWithSigner.setProxy(this.saeStakingV1Deployed.address);
    await setTrx.wait();

    // Connect ERC20 contract
    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);
    this.erc20WithSigner2 = this.erc20Deployed.connect(this.tempAccount);

    // Approve ERC20 contract
    const approveTx = await this.erc20WithSigner2.approve(this.saeStakingV1Deployed.address, "100000");
    await approveTx.wait();

    // Connect Escrow contract
    this.saeStakingV1WithSigner = this.saeStakingV1Deployed.connect(this.investorAccount);
    this.saeStakingV1WithSigner2 = this.saeStakingV1Deployed.connect(this.tempAccount);

    // Deposit sum
    const depositTrx = await this.saeStakingV1WithSigner2.deposit("10000", "FTM", "5000", false);
    await depositTrx.wait();
    
    // Assert PendingInvestorList
    const pendingInvestorList = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList.length).to.equal(1);

    // Assert account balance
    const erc20BalanceOf = await this.erc20WithSigner2.balanceOf(this.tempAccount.address);
    expect(erc20BalanceOf).to.equal("90000");

    // Assert contract balance
    const contractBalanceOf = await this.erc20WithSigner2.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf).to.equal("10000");

    // Assert InvestorOf
    const investorOf = await this.saeStakingV1WithSigner2.investorOf(this.tempAccount.address);
    expect(investorOf.depositTokenAmount).to.equal("10000");
    expect(investorOf.isCompound).to.be.false;
    expect(investorOf.isValue).to.be.true;

    // Connect ERC721 contract
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);
    this.erc721WithSigner2 = this.erc721Deployed.connect(this.tempAccount);

    // Get Token ID
    this.tokenId = await this.erc721WithSigner2.nextTokenId();

    // Mint
    const safeMintTrx = await this.erc721OwnerWithSigner.safeMint(this.tempAccount.address, "tokenUri");
    await safeMintTrx.wait();

    // Assert NFT Balance
    const nftBalanceOf = await this.erc721WithSigner2.balanceOf(this.tempAccount.address);
    expect(nftBalanceOf).to.equal("1");

    // Convert to NFT Value
    const convertTrx = await this.saeStakingV1OwnerWithSigner.convertInvestorDepositToNftValue(this.tempAccount.address, this.tokenId, "10000");
    await convertTrx.wait();

    // Assert PendingInvestorList
    const pendingInvestorList2 = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList2.length).to.equal(0);

    // Assert InvestorOf
    const investorOf2 = await this.saeStakingV1WithSigner2.investorOf(this.tempAccount.address);
    expect(investorOf2.depositTokenAmount).to.equal("0");
    expect(investorOf2.isCompound).to.be.false;
    expect(investorOf2.isValue).to.be.true;

    // Assert NftValueOf
    const nftValueOf = await this.saeStakingV1WithSigner2.nftValueOf(this.tokenId);
    expect(nftValueOf.nftId).to.equal(this.tokenId);
    expect(nftValueOf.nftOwner).to.equal(this.tempAccount.address);

    expect(nftValueOf.initialDepositTokenAmount).to.equal("10000");
    expect(nftValueOf.usdInitialDeposit).to.equal("5000");
    expect(nftValueOf.saeBalance).to.equal("10000");

    expect(nftValueOf.isCompound).to.be.false;
    expect(nftValueOf.isValue).to.be.true;

    expect(nftValueOf.monthlyRewardPercentage).to.equal("80");

    // Transfer token
    const trfTokenTrx = await this.erc721WithSigner2.transferFrom(this.tempAccount.address, this.investorAccount.address, this.tokenId);
    await trfTokenTrx.wait();

    // Assign rewards
    const assignRewardsTrx = await this.saeStakingV1OwnerWithSigner.assignRewards("5", "2022", "1", "100");
    await assignRewardsTrx.wait();

    // Assert TransactionOf
    const transactionOf = await this.saeStakingV1OwnerWithSigner.transactionOf("5", "2022");
    const accountTransactionOf = transactionOf[0];

    expect(accountTransactionOf.nftId).to.equal(this.tokenId);
    expect(accountTransactionOf.investorAddr).to.equal(this.investorAccount.address);

    expect(accountTransactionOf.saeBalance).to.equal("10000");
    expect(accountTransactionOf.saeDivestment).to.equal("0");
    expect(accountTransactionOf.saeRewardsThisPeriod).to.equal("0");

    expect(accountTransactionOf.nftStatus).to.equal(+0);
    expect(accountTransactionOf.nftStrategy).to.equal(+0);

    expect(accountTransactionOf.isValue).to.true;
    expect(accountTransactionOf.accrue).to.false;

    const adminTransactionOf = transactionOf[1];

    expect(adminTransactionOf.nftId).to.equal(this.tokenId);

    expect(adminTransactionOf.saeBalance).to.equal("0");
    expect(adminTransactionOf.saeDivestment).to.equal("0");
    expect(adminTransactionOf.saeRewardsThisPeriod).to.equal("100");

    expect(adminTransactionOf.nftStatus).to.equal(+0);
    expect(adminTransactionOf.nftStrategy).to.equal(+0);

    expect(adminTransactionOf.isValue).to.true;
    expect(adminTransactionOf.accrue).to.true;

    // Assert TotalSaePayoutOf
    const totalSaePayoutOf = await this.saeStakingV1OwnerWithSigner.totalSaePayoutOf("5", "2022");
    expect(totalSaePayoutOf.totalSaePayout).to.equal("0");

    // Assert NftValueOf
    const nftValueOf3 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf3.nftId).to.equal(this.tokenId);
    expect(nftValueOf3.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf3.initialDepositTokenAmount).to.equal("10000");
    expect(nftValueOf3.usdInitialDeposit).to.equal("5000");
    expect(nftValueOf3.saeBalance).to.equal("10000");
    expect(nftValueOf3.saeReward).to.equal("0");

    expect(nftValueOf3.isCompound).to.be.false;
    expect(nftValueOf3.isValue).to.be.true;

    expect(nftValueOf3.monthlyRewardPercentage).to.equal("80");

    // Assert InvestorOf
    const investorOf3 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf3.depositTokenAmount).to.equal("0");
    expect(investorOf3.ftmReward).to.equal("0");
    expect(investorOf3.isCompound).to.be.false;
    expect(investorOf3.isValue).to.be.true;

    // Assert account balance
    const erc20BalanceOf2 = await this.erc20WithSigner.balanceOf(this.investorAccount.address);
    expect(erc20BalanceOf2).to.equal("100000");

    // Assert account 2 balance
    const erc20BalanceOf3 = await this.erc20WithSigner.balanceOf(this.tempAccount.address);
    expect(erc20BalanceOf3).to.equal("90000");

    // Assert contract balance
    const contractBalanceOf2 = await this.erc20WithSigner.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf2).to.equal("10000");
  });

  it('happy flow deposit -> mint -> convert -> transfer -> compound', async function () {
    /**
     * Transfer some ERC20s to investorAccount
     * */
    const transferTx = await this.erc20Deployed.transfer(this.investorAccount.address, "100000");
    await transferTx.wait();

    /**
     * Transfer some ERC20s to tempAccount
     * */
    const transferTx2 = await this.erc20Deployed.transfer(this.tempAccount.address, "100000");
    await transferTx2.wait();

    // Deploy proxy
    this.saeStakingV1Deployed = await hre.upgrades.deployProxy(this.saeStakingV1, [this.erc20Deployed.address, this.erc721Deployed.address], { kind: 'uups', initializer: 'initialize', unsafeAllowLinkedLibraries: true });
    await this.saeStakingV1Deployed.deployed();

    // Connect with owner of Staking contract
    this.saeStakingV1OwnerWithSigner = this.saeStakingV1Deployed.connect(this.deployer);

    // Connect with owner of ERC721
    this.erc721OwnerWithSigner = this.erc721Deployed.connect(this.deployer);

    // Set proxy
    const setTrx = await this.erc721OwnerWithSigner.setProxy(this.saeStakingV1Deployed.address);
    await setTrx.wait();

    // Connect ERC20 contract
    this.erc20WithSigner = this.erc20Deployed.connect(this.investorAccount);
    this.erc20WithSigner2 = this.erc20Deployed.connect(this.tempAccount);

    // Approve ERC20 contract
    const approveTx = await this.erc20WithSigner2.approve(this.saeStakingV1Deployed.address, "100000");
    await approveTx.wait();

    // Connect Escrow contract
    this.saeStakingV1WithSigner = this.saeStakingV1Deployed.connect(this.investorAccount);
    this.saeStakingV1WithSigner2 = this.saeStakingV1Deployed.connect(this.tempAccount);

    // Deposit sum
    const depositTrx = await this.saeStakingV1WithSigner2.deposit("10000", "FTM", "5000", true);
    await depositTrx.wait();
    
    // Assert PendingInvestorList
    const pendingInvestorList = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList.length).to.equal(1);

    // Assert account balance
    const erc20BalanceOf = await this.erc20WithSigner2.balanceOf(this.tempAccount.address);
    expect(erc20BalanceOf).to.equal("90000");

    // Assert contract balance
    const contractBalanceOf = await this.erc20WithSigner2.balanceOf(this.saeStakingV1Deployed.address);
    expect(contractBalanceOf).to.equal("10000");

    // Assert InvestorOf
    const investorOf = await this.saeStakingV1WithSigner2.investorOf(this.tempAccount.address);
    expect(investorOf.depositTokenAmount).to.equal("10000");
    expect(investorOf.isCompound).to.be.true;
    expect(investorOf.isValue).to.be.true;

    // Connect ERC721 contract
    this.erc721WithSigner = this.erc721Deployed.connect(this.investorAccount);
    this.erc721WithSigner2 = this.erc721Deployed.connect(this.tempAccount);

    // Get Token ID
    this.tokenId = await this.erc721WithSigner2.nextTokenId();

    // Mint
    const safeMintTrx = await this.erc721OwnerWithSigner.safeMint(this.tempAccount.address, "tokenUri");
    await safeMintTrx.wait();

    // Assert NFT Balance
    const nftBalanceOf = await this.erc721WithSigner2.balanceOf(this.tempAccount.address);
    expect(nftBalanceOf).to.equal("1");

    // Convert to NFT Value
    const convertTrx = await this.saeStakingV1OwnerWithSigner.convertInvestorDepositToNftValue(this.tempAccount.address, this.tokenId, "10000");
    await convertTrx.wait();

    // Assert PendingInvestorList
    const pendingInvestorList2 = await this.saeStakingV1WithSigner.pendingInvestorList();
    expect(pendingInvestorList2.length).to.equal(0);

    // Assert InvestorOf
    const investorOf2 = await this.saeStakingV1WithSigner2.investorOf(this.tempAccount.address);
    expect(investorOf2.depositTokenAmount).to.equal("0");
    expect(investorOf2.isCompound).to.be.false;
    expect(investorOf2.isValue).to.be.true;

    // Assert NftValueOf
    const nftValueOf = await this.saeStakingV1WithSigner2.nftValueOf(this.tokenId);
    expect(nftValueOf.nftId).to.equal(this.tokenId);
    expect(nftValueOf.nftOwner).to.equal(this.tempAccount.address);

    expect(nftValueOf.initialDepositTokenAmount).to.equal("10000");
    expect(nftValueOf.usdInitialDeposit).to.equal("5000");
    expect(nftValueOf.saeBalance).to.equal("10000");

    expect(nftValueOf.isCompound).to.be.true;
    expect(nftValueOf.isValue).to.be.true;

    expect(nftValueOf.monthlyRewardPercentage).to.equal("80");

    // Transfer token
    const trfTokenTrx = await this.erc721WithSigner2.transferFrom(this.tempAccount.address, this.investorAccount.address, this.tokenId);
    await trfTokenTrx.wait();

    // Assign rewards
    const assignRewardsTrx = await this.saeStakingV1OwnerWithSigner.assignRewards("5", "2022", "1", "100");
    await assignRewardsTrx.wait();

    // Assert TransactionOf
    const transactionOf = await this.saeStakingV1OwnerWithSigner.transactionOf("5", "2022");
    const accountTransactionOf = transactionOf[0];

    expect(accountTransactionOf.nftId).to.equal(this.tokenId);
    expect(accountTransactionOf.investorAddr).to.equal(this.investorAccount.address);

    expect(accountTransactionOf.saeBalance).to.equal("10000");
    expect(accountTransactionOf.saeDivestment).to.equal("0");
    expect(accountTransactionOf.saeRewardsThisPeriod).to.equal("0");

    expect(accountTransactionOf.nftStatus).to.equal(+0);
    expect(accountTransactionOf.nftStrategy).to.equal(+0);

    expect(accountTransactionOf.isValue).to.true;
    expect(accountTransactionOf.accrue).to.false;

    const adminTransactionOf = transactionOf[1];

    expect(adminTransactionOf.nftId).to.equal(this.tokenId);

    expect(adminTransactionOf.saeBalance).to.equal("0");
    expect(adminTransactionOf.saeDivestment).to.equal("0");
    expect(adminTransactionOf.saeRewardsThisPeriod).to.equal("100");

    expect(adminTransactionOf.nftStatus).to.equal(+0);
    expect(adminTransactionOf.nftStrategy).to.equal(+0);

    expect(adminTransactionOf.isValue).to.true;
    expect(adminTransactionOf.accrue).to.true;

    // Assert TotalSaePayoutOf
    const totalSaePayoutOf = await this.saeStakingV1OwnerWithSigner.totalSaePayoutOf("5", "2022");
    expect(totalSaePayoutOf.totalSaePayout).to.equal("0");

    // Assert NftValueOf
    const nftValueOf3 = await this.saeStakingV1WithSigner.nftValueOf(this.tokenId);
    expect(nftValueOf3.nftId).to.equal(this.tokenId);
    expect(nftValueOf3.nftOwner).to.equal(this.investorAccount.address);

    expect(nftValueOf3.initialDepositTokenAmount).to.equal("10000");
    expect(nftValueOf3.usdInitialDeposit).to.equal("5000");
    expect(nftValueOf3.saeBalance).to.equal("10000");
    expect(nftValueOf3.saeReward).to.equal("0");

    expect(nftValueOf3.isCompound).to.be.true;
    expect(nftValueOf3.isValue).to.be.true;

    expect(nftValueOf3.monthlyRewardPercentage).to.equal("80");

    // Assign rewards
    const convertRewardsTrx = await this.saeStakingV1OwnerWithSigner.convertNftValueRewardToInvestor(this.investorAccount.address, this.tokenId, "80");
    await convertRewardsTrx.wait();

    // Assert InvestorOf
    const investorOf3 = await this.saeStakingV1WithSigner.investorOf(this.investorAccount.address);
    expect(investorOf3.depositTokenAmount).to.equal("0");
    expect(investorOf3.ftmReward).to.equal("0");
    expect(investorOf3.isCompound).to.be.false;
    expect(investorOf3.isValue).to.be.true;
  });
});
