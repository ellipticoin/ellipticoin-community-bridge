// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IWETH.sol";
import "./WELC.sol";

contract Bridge is Ownable {
    using ECDSA for bytes32;
    WELC public immutable _WELC;
    address[] public signers;
    mapping(uint256 => bool) public redeemedTransactions;

    constructor(address[] memory _signers) public {
        signers = _signers;
        _WELC = new WELC("Wrapped Ellipticoin", "WELC");
    }

    function setSigners(
        address[] memory _signers
    ) public onlyOwner {
        signers = _signers;
    }

    receive() external payable {}

    function redeem(
        ERC20 token,
        uint256 amount,
        uint32 foreignTransactionId,
        bytes memory signature,
        uint256 signerId
    ) public {
        require(!redeemedTransactions[foreignTransactionId], "invalid foreignTransactionId");
        redeemedTransactions[foreignTransactionId] = true;
        bytes32 hash = keccak256(
            abi.encodePacked(address(token), msg.sender, amount, foreignTransactionId, this)
        );
        requireValidSignatures(hash, signature, signerId);

        if (address(token) == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}(new bytes(0));
            require(success, "Ether transfer failed");
        } else if (address(token) == address(1)) {
            _WELC.mint(msg.sender, amount);
        } else {
            token.transfer(msg.sender, amount);
        }
    }

    function requireValidSignatures(bytes32 hash, bytes memory signature, uint256 signerId)
        internal
        view
    {
        require(hash.recover(signature) == signers[signerId], "invalid signature");
    }

    function undoTransactions(uint256[] calldata foreignTransactionIds) public onlyOwner {
        for (uint i=0; i<foreignTransactionIds.length; i++) {
            redeemedTransactions[foreignTransactionIds[i]] = false;
        }
    }

}
