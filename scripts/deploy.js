const hre = require("hardhat");
const {formatUnits} = ethers.utils;

async function main() {
  const {owner, signers} = {
    rinkeby: {
      signers: ["0x0113713f91dd6a7c179a038e66e5919a9a0a9d1d"],
      owner: "0x6bDCC3608e8DF882096A1b4b106C727bd28F141D",
    },
    mainnet: {
      signers: ["0x418b993b7d17b45937ef4f69a06a3433cd30b5ce"],
      owner: "0x5510f178A57C4f4B456d747CdbfcD0A5b1b5473b",
    },
  }[hre.network.name];
  const Bridge = await ethers.getContractFactory("Bridge");
  const deployTransaction = await Bridge.getDeployTransaction(signers, owner);
  const accounts = await ethers.getSigners();
  console.log(
    (await accounts[0].provider.estimateGas(deployTransaction)).toNumber()
  );
  console.log(await accounts[0].getAddress())
  const bridge = await Bridge.deploy(signers, owner, {
    gasPrice: ethers.utils.parseUnits("118", "gwei"),
  });
  let tx = await bridge.deployed();

  console.log("Bridge deployed to:", bridge.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
