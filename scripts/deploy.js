const {formatUnits} = ethers.utils;

async function main() {
  const owner = "0xAAa1b967F4E3D67c4946eC6816b05f0207AaD9Cd";
  const Bridge = await ethers.getContractFactory("Bridge");
  const accounts = await ethers.getSigners();
  const bridge = await Bridge.deploy(["0xAAa1b967F4E3D67c4946eC6816b05f0207AaD9Cd"], owner);
  let tx = await bridge.deployed();

  console.log("Bridge deployed to:", bridge.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
