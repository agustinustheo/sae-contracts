//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./SaeStakingTypes.sol";

library SaeViews {
  function investorOf(
    address msgSender,
    mapping(address => SaeStakingTypes.Investor) storage investorMap
  ) external view returns(SaeStakingTypes.PubInvestor memory) {
    require(investorMap[msgSender].isValue, "Investor not found");

    SaeStakingTypes.PubInvestor memory investor;
    investor.depositTokenAmount = investorMap[msgSender].depositTokenAmount;
    investor.depositTokenType = investorMap[msgSender].depositTokenType;
    investor.usdInitialDeposit = investorMap[msgSender].usdInitialDeposit;
    investor.ftmReward = investorMap[msgSender].ftmReward;
    investor.burnedNftIds = investorMap[msgSender].burnedNftIds;
    investor.purchaseTimestamp = investorMap[msgSender].purchaseTimestamp;
    investor.isCompound = investorMap[msgSender].isCompound;
    investor.isValue = investorMap[msgSender].isValue;
    
    return investor;
  }

  function investorOfWithDivestmentAmount(
    address msgSender,
    mapping(address => SaeStakingTypes.Investor) storage investorMap,
    string memory divestmentTokenType
  ) external view returns(SaeStakingTypes.PubInvestor memory) {
    require(investorMap[msgSender].isValue, "Investor not found");

    SaeStakingTypes.PubInvestor memory investor;
    investor.depositTokenAmount = investorMap[msgSender].depositTokenAmount;
    investor.depositTokenType = investorMap[msgSender].depositTokenType;
    investor.usdInitialDeposit = investorMap[msgSender].usdInitialDeposit;
    investor.ftmReward = investorMap[msgSender].ftmReward;
    investor.divestmentTokenAmount = investorMap[msgSender].divestmentTokenAmount[divestmentTokenType];
    investor.divestmentTokenType = divestmentTokenType;
    investor.burnedNftIds = investorMap[msgSender].burnedNftIds;
    investor.purchaseTimestamp = investorMap[msgSender].purchaseTimestamp;
    investor.isCompound = investorMap[msgSender].isCompound;
    investor.isValue = investorMap[msgSender].isValue;
    
    return investor;
  }

  function nftValueOf(
    uint256 nftId,
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap
  ) external view returns(SaeStakingTypes.NftValue memory) {
    require(nftValueMap[nftId].isValue, "NftValue not found");
    return nftValueMap[nftId];
  }

  function transactionOf(
    int month, 
    int year,
    mapping(bytes32 => bool) storage existingTransactions,
    mapping(bytes32 => SaeStakingTypes.Transaction[]) storage payouts
  ) external view returns(SaeStakingTypes.Transaction[] memory) {
    // Get the hash of the tuple
    bytes32 hashPrd = keccak256(abi.encodePacked(month, year));

    // Check if rewards have been calculated
    require(existingTransactions[hashPrd], "Period does not exist");

    return payouts[hashPrd];
  }

  function _findArrayIndex(
    string memory val,
    SaeStakingTypes.PayoutPerToken[20] memory arr
  ) internal pure returns(uint) {
    for(uint i = 0; i < 20; i++) {
      if (keccak256(abi.encode(arr[i].divestmentTokenType)) == keccak256(abi.encode(val))) {
        return i + 1;
      }
    }
    return 0;
  }

  function totalSaePayoutOf(
    int month, 
    int year,
    mapping(bytes32 => bool) storage existingTransactions,
    mapping(bytes32 => SaeStakingTypes.Transaction[]) storage payouts
  ) external view returns(SaeStakingTypes.Payout memory) {
    // Get the hash of the tuple
    bytes32 hashPrd = keccak256(abi.encodePacked(month, year));

    // Check if rewards have been calculated
    require(existingTransactions[hashPrd], "Period does not exist");

    SaeStakingTypes.Transaction[] memory array = payouts[hashPrd];
    
    uint tokenIndex = 0;
    uint arrayLength = array.length;
    SaeStakingTypes.Payout memory payout;
    for (uint i=0; i < arrayLength; i++) {
        if (array[i].investorAddr == address(0) || array[i].nftStrategy == SaeStakingTypes.NftStrategy.COMPOUND) {
          continue;
        }

        uint index = _findArrayIndex(array[i].divestmentTokenType, payout.totalPayoutPerToken);
        if (index == 0) {
          payout.totalPayoutPerToken[tokenIndex].saeDivestment += array[i].saeDivestment;
          payout.totalPayoutPerToken[tokenIndex].saeRewardsThisPeriod += array[i].saeRewardsThisPeriod;
          payout.totalPayoutPerToken[tokenIndex].divestmentTokenType = array[i].divestmentTokenType;
          tokenIndex++;
        }
        else {
          payout.totalPayoutPerToken[index - 1].saeDivestment += array[i].saeDivestment;
          payout.totalPayoutPerToken[index - 1].saeRewardsThisPeriod += array[i].saeRewardsThisPeriod;
        }

        payout.totalSaePayout += array[i].saeDivestment;
        payout.totalSaePayout += array[i].saeRewardsThisPeriod;
    }

    return payout;
  }
}