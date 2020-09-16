// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IWETH.sol";
import "./MockERC20.sol";

contract MockWETH is MockERC20 {
    mapping(address => uint256) public balanceOf;
    struct Withdrawal {
        address to;
        uint256 wad;
    }
    struct Deposit {
        address to;
        uint256 wad;
    }
    Withdrawal lastWithdrawal;
    Deposit lastDeposit;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
        lastDeposit = Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        require(balanceOf[msg.sender] >= wad, "Insufficient balance");
        balanceOf[msg.sender] -= wad;
        msg.sender.transfer(wad);
        lastWithdrawal = Withdrawal(msg.sender, wad);
    }

    function getLastWithdrawal() public view returns (address, uint256) {
        return (lastWithdrawal.to, lastWithdrawal.wad);
    }

    function getLastDeposit() public view returns (address, uint256) {
        return (lastDeposit.to, lastDeposit.wad);
    }
}
