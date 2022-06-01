// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../SaeFtmStakingV1.sol";

contract MockSaeFtmStakingV2 is SaeFtmStakingV1
{
    function version() public pure returns (string memory) {
        return "v2!";
    }
}
