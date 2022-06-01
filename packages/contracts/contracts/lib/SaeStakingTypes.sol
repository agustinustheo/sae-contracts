//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

library SaeStakingTypes {
  struct Activity {
    uint256 timestamp;
    string activity;
    string mutation;
  }

  enum NftStatus{ ACTIVE, BURNED, BURNING_NEXT_PROCESS }
  enum NftStrategy{ COMPOUND, DIVEST, CLAIM_REWARDS }

  struct Transaction {
    uint256 nftId;
    address investorAddr;

    bool isValue;

    uint256 saeBalance;
    uint256 saeDivestment;
    uint256 saeRewardsThisPeriod;
    string divestmentTokenType;

    bytes32 periodId;

    NftStatus nftStatus;
    NftStrategy nftStrategy;

    bool accrue;
    
    uint256 createdTimestamp;
  }
  
  struct NftValue {
    uint256 nftId;
    address nftOwner;

    uint256 initialDepositTokenAmount;
    string initialDepositTokenType;
    uint256 usdInitialDeposit;

    uint256 saeReward;
    uint256 saeBalance;
    uint256 saeDivestment;
    string divestmentTokenType;

    bool isCompound;
    bool isDivesting;
    bool isTransferred;
    bool isBurned;
    
    bool isValue;

    uint256 monthlyRewardPercentage; // Depends on the time staked
    
    uint256 purchaseTimestamp;

    Activity[] history;
  }

  struct Investor {
    uint256 depositTokenAmount;
    string depositTokenType;
    uint256 usdInitialDeposit;
    
    uint256 ftmReward;
    mapping(string => uint256) divestmentTokenAmount;

    uint256[] burnedNftIds;
    uint256 purchaseTimestamp;

    bool isCompound;

    bool isValue;
  }

  struct PubInvestor {
    uint256 depositTokenAmount;
    string depositTokenType;
    uint256 usdInitialDeposit;
    
    uint256 ftmReward;
    uint256 divestmentTokenAmount;
    string divestmentTokenType;

    uint256[] burnedNftIds;
    uint256 purchaseTimestamp;

    bool isCompound;

    bool isValue;
  }

  struct PayoutPerToken {
    uint256 saeDivestment;
    uint256 saeRewardsThisPeriod;
    string divestmentTokenType;
  }

  struct Payout {
    uint256 totalSaePayout;
    PayoutPerToken[20] totalPayoutPerToken;
  }
}