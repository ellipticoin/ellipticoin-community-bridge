const {formatUnits} = ethers.utils

async function main() {
  console.log((await (await ethers.getSigners())[0].getGasPrice()).toNumber())
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy("0xd0a1e359811322d97991e03f863a0c30c2cf029c");
  let tx = await bridge.deployed();

  console.log("Bridge deployed to:", bridge.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
