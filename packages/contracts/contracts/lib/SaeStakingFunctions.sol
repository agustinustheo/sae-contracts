//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../ISaeNft.sol";
import "./SaeStakingTypes.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SaeStakingFunctions {
  function _calcPayout(
    SaeStakingTypes.NftValue memory nftValue, 
    bytes32 hashPrd,
    uint256 totalSaeRewardThisPeriod,
    uint256 totalSaeStaked
  ) internal view returns (SaeStakingTypes.Transaction memory) {
      SaeStakingTypes.Transaction memory _payout;

      _payout.nftId = nftValue.nftId;
      _payout.investorAddr = nftValue.nftOwner;
      _payout.saeBalance = nftValue.saeBalance;
      _payout.divestmentTokenType = nftValue.divestmentTokenType;
      _payout.periodId = hashPrd;
      _payout.createdTimestamp = block.timestamp;
      _payout.isValue = true;

      if(nftValue.isDivesting) {
        _payout.saeDivestment = nftValue.saeDivestment;
        _payout.accrue = false;

        _payout.nftStatus = SaeStakingTypes.NftStatus.BURNING_NEXT_PROCESS;
        _payout.nftStrategy = SaeStakingTypes.NftStrategy.DIVEST;
        return _payout;
      }

      _payout.nftStatus = SaeStakingTypes.NftStatus.ACTIVE;

      if(nftValue.isTransferred) {
        _payout.accrue = false;

        _payout.nftStrategy = SaeStakingTypes.NftStrategy.COMPOUND;
        return _payout;
      }

      // Payout 80% of the 1% interest
      _payout.accrue = true;
      _payout.saeRewardsThisPeriod = nftValue.saeBalance * nftValue.monthlyRewardPercentage / 100 * totalSaeRewardThisPeriod / totalSaeStaked;

      if(nftValue.isCompound) {
        _payout.nftStrategy = SaeStakingTypes.NftStrategy.COMPOUND;
        return _payout;
      }

      _payout.nftStrategy = SaeStakingTypes.NftStrategy.CLAIM_REWARDS;

      return _payout;
  }

  function _calcPayoutAdmin(
    SaeStakingTypes.NftValue memory nftValue, 
    bytes32 hashPrd,
    uint256 totalSaeRewardThisPeriod,
    uint256 totalSaeStaked
  ) internal view returns (SaeStakingTypes.Transaction memory) {
      SaeStakingTypes.Transaction memory _payout;

      _payout.nftId = nftValue.nftId;
      _payout.periodId = hashPrd;
      _payout.divestmentTokenType = nftValue.divestmentTokenType;
      _payout.isValue = true;
      _payout.createdTimestamp = block.timestamp;
      _payout.accrue = true;

      if(nftValue.isDivesting) {
        // Payout all of the 1% interest
        _payout.saeRewardsThisPeriod = nftValue.saeDivestment * totalSaeRewardThisPeriod / totalSaeStaked;

        _payout.nftStatus = SaeStakingTypes.NftStatus.BURNING_NEXT_PROCESS;
        _payout.nftStrategy = SaeStakingTypes.NftStrategy.DIVEST;
        return _payout;
      }

      _payout.nftStatus = SaeStakingTypes.NftStatus.ACTIVE;

      if(nftValue.isTransferred) {
        // Payout all of the 1% interest
        _payout.saeRewardsThisPeriod = nftValue.saeBalance * totalSaeRewardThisPeriod / totalSaeStaked;

        _payout.nftStrategy = SaeStakingTypes.NftStrategy.COMPOUND;
        return _payout;
      }

      // Payout 20% of the 1% interest
      uint256 monthlyPercentage = 100 - nftValue.monthlyRewardPercentage;
      _payout.saeRewardsThisPeriod = nftValue.saeBalance * monthlyPercentage / 100 * totalSaeRewardThisPeriod / totalSaeStaked;

      if(nftValue.isCompound) {
        _payout.nftStrategy = SaeStakingTypes.NftStrategy.COMPOUND;
        return _payout;
      }

      _payout.nftStrategy = SaeStakingTypes.NftStrategy.CLAIM_REWARDS;
      return _payout;
  }

  function _createActivity(
    string memory activity,
    string memory mutation
  ) internal view returns (SaeStakingTypes.Activity memory) {
    SaeStakingTypes.Activity memory _activity;

    _activity.timestamp = block.timestamp;
    _activity.activity = activity;
    _activity.mutation = mutation;

    return _activity;
  }

  function transferErc721(
    address to,
    uint256 tokenId,
    mapping(address => SaeStakingTypes.Investor) storage investorMap, 
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap, 
    address msgSender,
    address nftAddress
  ) external {
    // Check if sender is the NFT contract
    require(msgSender == nftAddress, "Sender is not NFT address");

    // Check if NFT is divesting
    require(!nftValueMap[tokenId].isDivesting, "Cannot transfer divesting NFT");

    investorMap[to].isValue = true;
    nftValueMap[tokenId].nftOwner = to;
    nftValueMap[tokenId].isTransferred = true;
  }

  function deposit(
    IERC20 token,
    mapping(address => SaeStakingTypes.Investor) storage investorMap, 
    address msgSender, 
    address thisContract,
    address[] storage pendingInvestorList,
    mapping(address => uint) storage pendingInvestorIndex,
    uint256 depositTokenAmount,
    string memory depositTokenType,
    uint256 usdAmount, 
    bool autoCompound
  ) external {

    // Deposit cannot exist
    require(investorMap[msgSender].depositTokenAmount == 0, "Previous deposit needs to be converted to $DAG");

    // Escrow amount cannot be 0
    require(depositTokenAmount != 0, "Deposit amount cannot be 0");

    // Add investor to balance sheet
    investorMap[msgSender].usdInitialDeposit += usdAmount;
    investorMap[msgSender].depositTokenAmount += depositTokenAmount;
    investorMap[msgSender].depositTokenType = depositTokenType;
    investorMap[msgSender].isCompound = autoCompound;
    investorMap[msgSender].purchaseTimestamp = block.timestamp;
    investorMap[msgSender].isValue = true;

    // Set pending investor data
    pendingInvestorList.push(msgSender);
    pendingInvestorIndex[msgSender] = pendingInvestorList.length;

    // Transfer ERC20 token from sender to this contract
    require(token.transferFrom(msgSender, thisContract, depositTokenAmount), "Deposit failed");
  }

  function requestDivestmentNextMonth(
    ISaeNft nft,
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap,
    address investorAddr, 
    uint256 nftId,
    string memory divestmentTokenType
  ) external {
    // SaeStakingTypes.NftValue must be found
    require(nftValueMap[nftId].saeBalance != 0, "NftValue not found");

    // Not owner of Nft
    require(investorAddr == nft.ownerOf(nftId), "ERC721: Not owner of NFT");

    nftValueMap[nftId].isDivesting = true;

    uint256 divestAmount = nftValueMap[nftId].saeBalance;
    nftValueMap[nftId].saeBalance = 0;
    nftValueMap[nftId].saeDivestment = divestAmount;
    nftValueMap[nftId].divestmentTokenType = divestmentTokenType;

    nftValueMap[nftId].history.push(_createActivity(
      string(abi.encodePacked("Request Divestment Next Period ", Strings.toString(divestAmount), " $DAG in ", divestmentTokenType)),
      ""
    ));
  }

  function assignRewards(
    mapping(bytes32 => SaeStakingTypes.Transaction[]) storage payouts,
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap,
    mapping(bytes32 => bool) storage existingTransactions,
    uint256[] storage nftValueIds,
    uint256 totalSaeRewardThisPeriod,
    uint256 totalSaeStaked,
    int month,
    int year
  ) external {
    // Validate month
    require(month > 0, "Month cannot be 0");
    require(month < 13, "Month cannot exceed 12");

    // Validate year
    require(year > 2021, "Year cannot be lower than 2022");

    // Get the hash of the tuple
    bytes32 hashPrd = keccak256(abi.encodePacked(month, year));

    // Check if rewards have been calculated
    require(!existingTransactions[hashPrd], "Transaction have been calculated");

    for(uint i = 0; i < nftValueIds.length; i++) {
      uint _nftId = nftValueIds[i];

      SaeStakingTypes.NftValue memory _nftValue = nftValueMap[_nftId];
      SaeStakingTypes.Transaction memory _payout = _calcPayout(_nftValue, hashPrd, totalSaeRewardThisPeriod, totalSaeStaked);

      if (_payout.nftStrategy == SaeStakingTypes.NftStrategy.COMPOUND) {
        nftValueMap[_nftId].saeBalance += _payout.saeRewardsThisPeriod;

        nftValueMap[_nftId].history.push(_createActivity(
          string(abi.encodePacked("Rewards received")),
          string(abi.encodePacked("+ $DAG ", Strings.toString(_payout.saeRewardsThisPeriod)))
        ));
      }

      if (_payout.nftStrategy == SaeStakingTypes.NftStrategy.CLAIM_REWARDS) {
        nftValueMap[_nftId].saeReward += _payout.saeRewardsThisPeriod;

        nftValueMap[_nftId].history.push(_createActivity(
          string(abi.encodePacked("Rewards received")),
          string(abi.encodePacked("+ $DAG ", Strings.toString(_payout.saeRewardsThisPeriod)))
        ));

        nftValueMap[_nftId].history.push(_createActivity(
          string(abi.encodePacked("Take out rewards")),
          string(abi.encodePacked("- $DAG ", Strings.toString(_payout.saeRewardsThisPeriod)))
        ));
      }

      payouts[hashPrd].push(_payout);
      
      SaeStakingTypes.Transaction memory _payoutAdmin = _calcPayoutAdmin(_nftValue, hashPrd, totalSaeRewardThisPeriod, totalSaeStaked);
      payouts[hashPrd].push(_payoutAdmin);

      nftValueMap[_nftId].isTransferred = false;
    }

    existingTransactions[hashPrd] = true;
  }

  function retrieveDivestment(
    IERC20 token,
    ISaeNft nft,
    mapping(address => SaeStakingTypes.Investor) storage investorMap,
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap,
    address msgSender,
    string memory divestmentTokenType
  ) external returns(uint256 totalRetrievalAmount) {
    // SaeStakingTypes.NftValue must be found
    require(investorMap[msgSender].isValue, "Investor not found");

    // Divestment empty
    require(investorMap[msgSender].divestmentTokenAmount[divestmentTokenType] != 0, "Divestment empty");

    // Add the total staking deposit amount to reward balance
    totalRetrievalAmount = investorMap[msgSender].divestmentTokenAmount[divestmentTokenType];
    investorMap[msgSender].divestmentTokenAmount[divestmentTokenType] = 0;

    // Transfer ERC20 token from sender to this contract
    require(token.transfer(msgSender, totalRetrievalAmount), "Unstaking failed!");

    uint256 arrLength = investorMap[msgSender].burnedNftIds.length;
    uint256 nftId = investorMap[msgSender].burnedNftIds[arrLength - 1];
    nftValueMap[nftId].history.push(_createActivity(
      "Burn $DAG NFT",
      ""
    ));

    // Burn ERC721 token
    nftValueMap[nftId].isBurned = true;
    nft.burn(nftId);
  }

  function claimRewards(
    IERC20 token,
    mapping(address => SaeStakingTypes.Investor) storage investorMap,
    address msgSender
  ) external {
    // SaeStakingTypes.Investor not found
    require(investorMap[msgSender].isValue, "Investor not found");

    // Claimable rewards empty
    require(investorMap[msgSender].ftmReward > 0, "Rewards empty");

    // Set investor balance sheet to 0
    uint256 balanceAmount = investorMap[msgSender].ftmReward;
    investorMap[msgSender].ftmReward = 0;

    // Transfer ERC20 token from sender to this contract
    require(token.transfer(msgSender, balanceAmount), "Claim failed!");
  }
}