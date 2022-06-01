//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../ISaeNft.sol";
import "./SaeStakingTypes.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

library SaeConvert {
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

  /**
    * @dev remove from investors list
    */
  function _removeFromInvestorList(address[] storage pendingInvestorList, uint index) internal {
    if (index >= pendingInvestorList.length) return;

    for (uint i = index; i<pendingInvestorList.length-1; i++){
      pendingInvestorList[i] = pendingInvestorList[i+1];
    }
    pendingInvestorList.pop();
  }

  function convertInvestorDepositToNftValue(
    address[] storage pendingInvestorList,
    mapping(address => uint) storage pendingInvestorIndex,
    mapping(address => SaeStakingTypes.Investor) storage investorMap, 
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap, 
    uint256[] storage nftValueIds, 
    address investorAddr, 
    uint256 nftId, 
    uint256 saeAmount
  ) external {
    // Escrow amount cannot be 0
    require(saeAmount != 0, "Amount cannot be 0");

    // SaeStakingTypes.NftValue must be found
    require(investorMap[investorAddr].isValue, "Investor not found");

    // Add to investor balance sheet
    nftValueMap[nftId].nftId = nftId;
    nftValueMap[nftId].nftOwner = investorAddr;

    nftValueMap[nftId].saeBalance += saeAmount;
    nftValueMap[nftId].initialDepositTokenAmount += investorMap[investorAddr].depositTokenAmount;
    nftValueMap[nftId].initialDepositTokenType = investorMap[investorAddr].depositTokenType;
    nftValueMap[nftId].usdInitialDeposit += investorMap[investorAddr].usdInitialDeposit;
    nftValueMap[nftId].divestmentTokenType = investorMap[investorAddr].depositTokenType;

    nftValueMap[nftId].isCompound = investorMap[investorAddr].isCompound;
    nftValueMap[nftId].isValue = true;

    nftValueMap[nftId].monthlyRewardPercentage = 80;

    nftValueMap[nftId].purchaseTimestamp = investorMap[investorAddr].purchaseTimestamp;

    nftValueMap[nftId].history.push(_createActivity(
      string(abi.encodePacked("$DAG NFT Purchased with ", Strings.toString(investorMap[investorAddr].depositTokenAmount), " ", investorMap[investorAddr].depositTokenType)),
      string(abi.encodePacked("+ $DAG ", Strings.toString(saeAmount)))
    ));

    nftValueIds.push(nftId);

    // Remove from pending list
    _removeFromInvestorList(pendingInvestorList, pendingInvestorIndex[investorAddr]-1);
    pendingInvestorIndex[investorAddr] = 0;
    
    // Reset investor map
    investorMap[investorAddr].depositTokenAmount = 0;
    investorMap[investorAddr].depositTokenType = "";
    investorMap[investorAddr].usdInitialDeposit = 0;
    investorMap[investorAddr].purchaseTimestamp = 0;
    
    investorMap[investorAddr].isCompound = false;
  }

  function convertNftValueDivestmentToInvestor(
    ISaeNft nft,
    mapping(address => SaeStakingTypes.Investor) storage investorMap, 
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap,
    address investorAddr, 
    uint256 nftId, 
    uint256 divestmentTokenAmount,
    string memory divestmentTokenType
  ) external {
    // Escrow amount cannot be 0
    require(divestmentTokenAmount != 0, "Amount cannot be 0");
    
    // SaeStakingTypes.NftValue must be found
    require(investorMap[investorAddr].isValue, "Investor not found");

    // Not owner of Nft
    require(investorAddr == nft.ownerOf(nftId), "ERC721: Not owner of NFT");

    nftValueMap[nftId].history.push(_createActivity(
      string(abi.encodePacked("$DAG NFT Divesting ", Strings.toString(divestmentTokenAmount), " ", divestmentTokenType)),
      string(abi.encodePacked("- $DAG ", Strings.toString(nftValueMap[nftId].saeDivestment)))
    ));

    // Add to investor balance sheet
    nftValueMap[nftId].saeDivestment = 0;
    nftValueMap[nftId].isDivesting = false;

    // Array for multiple divesting NFTs for an investor
    investorMap[investorAddr].divestmentTokenAmount[divestmentTokenType] += divestmentTokenAmount;
    investorMap[investorAddr].burnedNftIds.push(nftId);
  }

  function convertNftValueRewardToInvestor(
    ISaeNft nft,
    mapping(address => SaeStakingTypes.Investor) storage investorMap,
    mapping(uint256 => SaeStakingTypes.NftValue) storage nftValueMap,
    address investorAddr, 
    uint256 nftId, 
    uint256 ftmAmount
  ) external {
    // Escrow amount cannot be 0
    require(ftmAmount != 0, "Amount cannot be 0");
    
    // SaeStakingTypes.Investor must be found
    require(investorMap[investorAddr].isValue, "Investor not found");
    
    // Not owner of Nft
    require(investorAddr == nft.ownerOf(nftId), "ERC721: Not owner of NFT");

    // Add to investor balance sheet
    if (!nftValueMap[nftId].isCompound) {
      investorMap[investorAddr].ftmReward += ftmAmount;

      nftValueMap[nftId].history.push(_createActivity(
        string(abi.encodePacked("Convert $DAG Reward to ", Strings.toString(ftmAmount), " $FTM")),
        ""
      ));
    }
  }
}