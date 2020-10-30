require("@nomiclabs/hardhat-waffle");

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

module.exports = {
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${ETH_PRIVATE_KEY}`],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${ETH_PRIVATE_KEY}`],
    },
  },
  solidity: "0.6.12",
};
