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
    IWETH public immutable WETH;
    WELC public immutable _WELC;
    address[] public signers;
    mapping(uint256 => bool) public redeemedTransactions;

    event Mint(
        ERC20 indexed token,
        bytes32 ellipticoinAddress,
        uint256 amount
    );

    constructor(address[] memory _signers, IWETH _WETH) public {
        signers = _signers;
        WETH = _WETH;
        _WELC = new WELC("Wrapped Ellipticoin", "WELC");
    }

    function setSigners(
        address[] memory _signers
    ) public onlyOwner {
        signers = _signers;
    }

    function getSigners() public view returns (address[] memory) {
        return signers;
    }

    receive() external payable {
        assert(msg.sender == address(WETH));
    }

    function mintWETH(bytes32 ellipticoinAddress) public payable {
        WETH.deposit{value: msg.value}();
        ERC20(address(WETH)).transfer(address(this), msg.value);
        Mint(ERC20(address(WETH)), ellipticoinAddress, msg.value);
    }

    function mint(
        ERC20 token,
        bytes32 ellipticoinAddress,
        uint256 amount
    ) public {
        token.transferFrom(msg.sender, address(this), amount);
        if (token == _WELC) {
            _WELC.burn(amount);
        }
        Mint(token, ellipticoinAddress, amount);
    }

    function releaseWETH(
        address to,
        uint256 amount,
        uint32 foreignTransactionId,
        bytes[] memory signatures
    ) public {
        release(ERC20(address(WETH)), address(this), amount, foreignTransactionId, signatures);
        IWETH(WETH).withdraw(amount);
        (bool success, ) = to.call{value: amount}(new bytes(0));
        require(success, "Ether transfer failed");
    }

    function release(
        ERC20 token,
        address to,
        uint256 amount,
        uint32 foreignTransactionId,
        bytes[] memory signatures
    ) public {
        require(!redeemedTransactions[foreignTransactionId], "invalid foreignTransactionId");
        redeemedTransactions[foreignTransactionId] = true;
        bytes32 hash = keccak256(
            abi.encodePacked(address(token), msg.sender, amount, foreignTransactionId, this)
        );
        requireValidSignatures(hash, signatures);

        if (token == _WELC) {
            _WELC.mint(address(this), amount);
        }

        token.transfer(to, amount);
    }

    function requireValidSignatures(bytes32 hash, bytes[] memory signatures)
        internal
        view
    {
        require(signers.length == signatures.length, "invalid number of signatures");
        for (uint i=0; i<signers.length; i++) {
            require(hash.recover(signatures[i]) == signers[i], "invalid signature");
        }
    }
}
