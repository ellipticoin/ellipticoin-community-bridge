const {
  createPrivateKeySync,
  ecdsaSign,
} = require("ethereum-cryptography/secp256k1");
const {solidityKeccak256, hexlify, arrayify} = ethers.utils;

async function getBalance(ethers, address) {
  return ethers.provider.getBalance(await signer.getAddress());
}

async function signRelease(
  recipient,
  amount,
  token,
  experationBlockNumber,
  foreignTransactionId,
  contractAddress,
  signer
) {
  return sign(
    ["address", "uint64", "address", "uint64", "uint64", "address"],
    [
      recipient,
      amount,
      token,
      experationBlockNumber,
      foreignTransactionId,
      contractAddress,
    ],
    signer
  );
}
async function sign(types, values, signer) {
  let messageHash = solidityKeccak256(types, values);
  const privateKeyBytes = await getPrivateKey(signer);
  let {signature, recid} = ecdsaSign(arrayify(messageHash), privateKeyBytes);
  return Buffer.concat([Buffer.from(signature), Buffer.from([27 + recid])]);
}

async function getPrivateKey(signer) {
  let address = await signer.getAddress();
  return signer.provider._hardhatProvider._wrapped._wrapped._wrapped._wrapped._node._localAccounts.get(
    (await signer.getAddress()).toLowerCase()
  );
}

module.exports = {
  signRelease,
  sign,
  getBalance,
};
