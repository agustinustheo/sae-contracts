//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface ISaeNft is IERC721 {
  function exists(uint256 tokenId) external view returns (bool);
  function burn(uint256 tokenId) external;
  function getTokenOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}