//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ISaeStakingErc721Transfer {
  function transferErc721(
    address to,
    uint256 tokenId
  ) external;
}