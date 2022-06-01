const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");
const { depositWithdrawal } = require("./depositWithdrawal.js");

require("dotenv").config();

// Entrypoint for the Autotask
exports.handler = async function (event) {
  const {
    KUCOIN_API_KEY,
    KUCOIN_API_SECRET,
    KUCOIN_API_PASSWORD,
    SUPABASE_API_KEY_WRITE,
    SUPABASE_URL,
  } = process.env;

  // Setup Relayer
  let signer;
  if (!process.env.hasOwnProperty("ENVIRONMENT_TYPE") || process.env.ENVIRONMENT_TYPE == "production") { // eslint-disable-line
    const provider = new DefenderRelayProvider(event);
    signer = new DefenderRelaySigner(event, provider, { speed: 'fastest' });
  }

  await depositWithdrawal(
    event,
    signer,
    SUPABASE_API_KEY_WRITE,
    SUPABASE_URL,
    KUCOIN_API_KEY,
    KUCOIN_API_SECRET,
    KUCOIN_API_PASSWORD,
  );
};

// To run locally (this code will not be executed in Autotasks)
// Run via node ....
if (require.main === module) {
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;

  exports
    .handler({
      apiKey,
      apiSecret,
    })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
