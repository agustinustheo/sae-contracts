//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./SaeNft.sol";
import "./ISaeNft.sol";
import "./lib/SaeViews.sol";
import "./lib/SaeConvert.sol";
import "./lib/SaeStakingTypes.sol";
import "./lib/SaeStakingFunctions.sol";
import "./ISaeStakingErc721Transfer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

contract SaeFtmStakingV1 is 
    Initializable,
    UUPSUpgradeable,
    ContextUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ISaeStakingErc721Transfer
{
  IERC20 private _token;
  ISaeNft private _nft;

  address private _tokenAddress;
  address private _nftAddress;
    
  // Initialize
  function initialize(address erc20Addr, address erc721Addr) external initializer {        
    __Context_init();
    __Ownable_init();
    __Pausable_init();
    
    _tokenAddress = erc20Addr;
    _nftAddress = erc721Addr;

    _token = IERC20(erc20Addr);
    _nft = SaeNft(erc721Addr);
  }

  mapping(bytes32 => SaeStakingTypes.Transaction[]) private _payouts;
  mapping(bytes32 => bool) private _existingTransactions;

  uint256[] private _nftValueIds;
  mapping(uint256 => SaeStakingTypes.NftValue) private _nftValueMap;

  address[] private _pendingInvestorList;
  mapping(address => uint) private _pendingInvestorIndex;

  mapping(address => SaeStakingTypes.Investor) private _investorMap;

  event DepositEvent(address msgSender, uint256 depositTokenAmount, string depositTokenType, uint256 usdAmount, bool autoCompound);
  event RetrieveDivestmentEvent(address msgSender, uint256 divestmentTokenAmount, string divestmentTokenType);

  /**
    * @dev override function when contract upgraded
    */
  function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {
    require(
      newImplementation != address(0),
      "Addr cannot be 0."
    );
  }

  /**
    * @dev executed when ERC721 is transferred
    */
  function transferErc721(
    address to,
    uint256 tokenId
  ) external override {
    SaeStakingFunctions.transferErc721(to, tokenId, _investorMap, _nftValueMap, _msgSender(), _nftAddress);
  }

  /**
    * @dev withdraw deposit currency from smart contract address
    */
  function withdraw(address withdrawalAddr) external virtual onlyOwner {
    // Transfer ERC20 token from contract to withdrawal address
    require(_token.transfer(withdrawalAddr, _token.balanceOf(address(this))), "Withdrawal failed!");
  }

  /**
    * @dev deposit deposit currency into smart contract address
    */
  function deposit(uint256 depositAmount, string memory depositToken, uint256 usdInitialAmount, bool autoCompound) external virtual {
    // Add to investor balance sheet
    SaeStakingFunctions.deposit(_token, _investorMap, _msgSender(), address(this), _pendingInvestorList, _pendingInvestorIndex, depositAmount, depositToken, usdInitialAmount, autoCompound);

    emit DepositEvent(_msgSender(), depositAmount, depositToken, usdInitialAmount, autoCompound);
  }

  /**
    * @dev convert existing deposit currency in the balance sheet to DAG
    */
  function convertInvestorDepositToNftValue(address investorAddr, uint256 nftId, uint256 saeAmount) external virtual onlyOwner {
    // Add to investor balance sheet
    SaeConvert.convertInvestorDepositToNftValue(_pendingInvestorList, _pendingInvestorIndex, _investorMap, _nftValueMap, _nftValueIds, investorAddr, nftId, saeAmount);
  }

  /**
    * @dev convert existing deposit currency in the balance sheet to DAG
    */
  function convertNftValueDivestmentToInvestor(address investorAddr, uint256 nftId, uint256 divestmentTokenAmount, string calldata divestmentTokenType) external virtual onlyOwner {
    SaeConvert.convertNftValueDivestmentToInvestor(_nft, _investorMap, _nftValueMap, investorAddr, nftId, divestmentTokenAmount, divestmentTokenType);
  }

  /**
    * @dev convert existing deposit currency in the balance sheet to DAG
    */
  function convertNftValueRewardToInvestor(address investorAddr, uint256 nftId, uint256 ftmAmount) external virtual onlyOwner {
    SaeConvert.convertNftValueRewardToInvestor(_nft, _investorMap, _nftValueMap, investorAddr, nftId, ftmAmount);
  }

  /**
    * @dev update the compounding (reward locking) status
    */
  function updateCompoundStatus(uint256 nftId, bool autoCompound) external virtual {
    // Not owner of Nft
    require(_msgSender() == _nft.ownerOf(nftId), "Not owner of Nft");
    _nftValueMap[nftId].isCompound = autoCompound;
  }

  /**
    * @dev request a divestment at the end of the month
    */
  function requestDivestmentNextMonth(uint256 nftId, string calldata divestmentTokenType) external virtual {
    SaeStakingFunctions.requestDivestmentNextMonth(_nft, _nftValueMap, _msgSender(), nftId, divestmentTokenType);
  }

  /**
    * @dev retrieve the deposit currency divestment balance from smart contract wallet
    */
  function retrieveDivestment(string memory divestmentTokenType) external virtual {
    uint256 r = SaeStakingFunctions.retrieveDivestment(_token, _nft, _investorMap, _nftValueMap, _msgSender(), divestmentTokenType);

    emit RetrieveDivestmentEvent(_msgSender(), r, divestmentTokenType);
  }

  /**
    * @dev claim rewards in deposit currency rewards balance
    */
  function claimRewards() external virtual {
    SaeStakingFunctions.claimRewards(_token, _investorMap, _msgSender());
  }

  /**
    * @dev contract owner saves the calculated DAG rewards to smart contract
    */
  function assignRewards(
    int month, 
    int year,
    uint256 totalSaeRewardThisPeriod,
    uint256 totalSaeStaked
  ) external virtual onlyOwner {
    SaeStakingFunctions.assignRewards(_payouts, _nftValueMap, _existingTransactions, _nftValueIds, totalSaeRewardThisPeriod, totalSaeStaked, month, year);
  }

  /**
    * @dev get investor struct
    */
  function investorOf(address investorAddr) external view returns(SaeStakingTypes.PubInvestor memory) {
    return SaeViews.investorOf(investorAddr, _investorMap);
  }

  /**
    * @dev get investor struct with divestment amount
    */
  function investorOfWithDivestmentAmount(address investorAddr, string memory divestmentType) external view returns(SaeStakingTypes.PubInvestor memory) {
    return SaeViews.investorOfWithDivestmentAmount(investorAddr, _investorMap, divestmentType);
  }

  /**
    * @dev get pending investor list array
    */
  function pendingInvestorList() external view returns(address[] memory) {
    return _pendingInvestorList;
  }

  /**
    * @dev get SaeStakingTypes.NftValueIds array
    */
  function nftValueIds() external view returns(uint256[] memory) {
    return _nftValueIds;
  }

  /**
    * @dev get SaeStakingTypes.NftValue struct
    */
  function nftValueOf(uint256 nftId) external view returns(SaeStakingTypes.NftValue memory) {
    return SaeViews.nftValueOf(nftId, _nftValueMap);
  }

  /**
    * @dev Executes IERC721Enumerable-tokenOfOwnerByIndex.
    */
  function tokenOfOwnerByIndex(address owner, uint256 index) external view virtual returns (uint256) {
    return _nft.getTokenOwnerByIndex(owner, index);
  }

  /**
    * @dev get the DAG payout balance receipts
    */
  function transactionOf(int month, int year) external view onlyOwner returns(SaeStakingTypes.Transaction[] memory) {
    return SaeViews.transactionOf(month, year, _existingTransactions, _payouts);
  }

  /**
    * @dev get the total $DAG payout balance receipts per token
    */
  function totalSaePayoutOf(int month, int year) external view onlyOwner returns(SaeStakingTypes.Payout memory) {
    return SaeViews.totalSaePayoutOf(month, year, _existingTransactions, _payouts);
  }
}
