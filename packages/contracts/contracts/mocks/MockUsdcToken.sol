
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUsdcToken is Context, ERC20 {
  constructor() ERC20("MockUsdcToken", "MOCK") {
    _mint(_msgSender(), 100000000 * 10 ** decimals());
  }
}