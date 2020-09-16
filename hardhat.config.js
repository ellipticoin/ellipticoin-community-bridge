require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-solhint");
require("@nomiclabs/hardhat-waffle");

const INFURA_PROJECT_ID = "28d900c929bf4df88e0a4adc9f790e22";
const KOVAN_PRIVATE_KEY = "29DF637D81F5A861B1C7668DB24A28ECE686302D87238B054D6B219305100B13";
const MAINNET_PRIVATE_KEY =
  "49183a102c95d413b21c68a3c4850772b8695fc1f0809f98e3a2e51269f44409";

// This is a sample Buidler task. To learn how to create your own go to
// https://hardhat.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://hardhat.dev/config/ to learn more
module.exports = {
  // This is a sample solc configuration that specifies which version of solc to use
  networks: {
    // hardhatevm: {
    //   blockGasLimit: 9508336,
    // },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${MAINNET_PRIVATE_KEY}`],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${KOVAN_PRIVATE_KEY}`],
    },
  },
  etherscan: {
    url: "https://api-kovan.etherscan.io/api",
    apiKey: "5GX8KUJB3RBPNIMT6VPY44T3NYJXWJIEHT",
  },
  solidity: "0.6.12",
};
