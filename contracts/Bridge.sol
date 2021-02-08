// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./WELC.sol";

contract Bridge is Ownable {
    event TransferETH(address indexed from, address indexed to, uint256 value);
    event Redeem(ERC20 indexed from, uint64 value);
    using ECDSA for bytes32;
    WELC public immutable _WELC;
    address[] public signers;
    mapping(uint64 => bool) public redeemedTransactions;

    constructor(address[] memory _signers, address owner) public {
        signers = _signers;
        _WELC = new WELC("Wrapped Ellipticoin", "WELC");
        transferOwnership(owner);
    }

    function setSigners(address[] memory _signers) public onlyOwner {
        signers = _signers;
    }

    function redeem(
        uint64 amount,
        ERC20 token,
        uint64 experationBlockNumber,
        uint64 redemptionId,
        bytes memory signature,
        uint16 signerId
    ) public {
        require(block.number <= experationBlockNumber, "signature expired");
        require(!redeemedTransactions[redemptionId], "already redeemed");
        require(
            validSignature(
                msg.sender,
                amount,
                token,
                experationBlockNumber,
                redemptionId,
                address(this),
                signers[signerId],
                signature
            ),
            "invalid signature"
        );
        redeemedTransactions[redemptionId] = true;
        uint256 scaledAmount = scaleUp(amount, token);

        if (address(token) == address(0)) {
            (bool success, ) = msg.sender.call{value: scaledAmount}(
                new bytes(0)
            );
            require(success, "Ether transfer failed");
            emit TransferETH(address(this), msg.sender, scaledAmount);
        } else if (address(token) == address(1)) {
            _WELC.mint(msg.sender, scaledAmount);
        } else {
            token.transfer(msg.sender, scaledAmount);
        }
        emit Redeem(token, amount);
    }

    function scaleUp(uint64 amount, ERC20 token)
        internal
        view
        returns (uint256)
    {
        return amount * uint256(10)**(tokenDecimals(token) - 6);
    }

    function tokenDecimals(ERC20 token) internal view returns (uint8) {
        if (address(token) == address(1)) {
            return _WELC.decimals();
        } else if (address(token) == address(1)) {
            return 18;
        } else {
            return token.decimals();
        }
    }

    function validSignature(
        address sender,
        uint64 amount,
        ERC20 token,
        uint64 experationBlockNumber,
        uint64 redemptionId,
        address contractAddress,
        address signer,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                sender,
                amount,
                address(token),
                experationBlockNumber,
                redemptionId,
                contractAddress
            )
        );
        return hash.recover(signature) == signer;
    }

    function undoTransactions(uint64 lastRedemptionId) public onlyOwner {
        for (uint64 i = 0; i <= lastRedemptionId; i++) {
            redeemedTransactions[i] = false;
        }
    }

    function withdraw(uint256 amount, ERC20 token) public onlyOwner {
        token.transfer(owner(), amount);
    }

    function withdrawETH(uint256 amount) public onlyOwner {
        (bool success, ) = owner().call{value: amount}(new bytes(0));
        require(success, "Ether transfer failed");
        emit TransferETH(address(this), owner(), amount);
    }

    receive() external payable {
        emit TransferETH(msg.sender, address(this), msg.value);
    }
}
