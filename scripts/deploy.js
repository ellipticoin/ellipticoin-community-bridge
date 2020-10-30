const {formatUnits} = ethers.utils

async function main() {
  console.log((await (await ethers.getSigners())[0].getGasPrice()).toNumber())
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  let tx = await bridge.deployed();

  console.log("Bridge deployed to:", bridge.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
