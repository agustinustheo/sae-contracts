const ccxt = require("ccxt");
const hre = require("hardhat");
const { ethers } = require("ethers");
const { swapOnExchange } = require("./swapOnExchange");
const { createClient } = require("@supabase/supabase-js");
const { abi } = require("./abi/SaeFtmStakingV1.sol/SaeFtmStakingV1.json");

require("dotenv").config();

async function depositWithdrawal(
  payload,
  signer,
  SUPABASE_API_KEY_WRITE,
  SUPABASE_URL,
  KUCOIN_API_KEY,
  KUCOIN_API_SECRET,
  KUCOIN_API_PASSWORD,
) {
  /**
   * @dev Set default arguments
   */
  let events;
  let _ethers = ethers;
  let depositTrxId = 'depositTrxId';
  let depositCurrency = 'FTM';

  /**
   * @dev For development only! Set the current ethers environment to Hardhat.
   */
  if (process.env.hasOwnProperty("ENVIRONMENT_TYPE") && process.env.ENVIRONMENT_TYPE == "development") { // eslint-disable-line
    _ethers = hre.ethers;
    [signer] = await _ethers.getSigners();
  }

  if (payload.hasOwnProperty('request')) { // eslint-disable-line
    events = payload.request.body.events;
    console.log(`** Received events: ${events}`);
  }
  
  console.log('** Start deposit withdrawal...');

  let exchange = new ccxt.kucoin({
    apiKey: KUCOIN_API_KEY,
    secret: KUCOIN_API_SECRET,
    password: KUCOIN_API_PASSWORD,
  });

  const depositAddress = await exchange.fetchDepositAddress(depositCurrency);
  console.log(`** KuCoin deposit address: ${depositAddress.address}`);

  const contractAddress = process.env.DEPLOYED_CONTRACT_ADDRESS;
  const contract = new _ethers.Contract(
    contractAddress, 
    abi, 
    signer
  );

  const exchangeDepositTxId = await contract.withdraw(depositAddress.address);
  const pendingInvestorList = await contract.pendingInvestorList();

  const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY_WRITE);

  const result = [];
  for (let i = 0; i < pendingInvestorList.length; i++) {
    const investor = await contract.investorOf(pendingInvestorList[i]);

    console.log('** Insert data to Supabase');
    const { data, error: error } = await supabase
        .from('saetrades')
        .insert([
        {
          wallet: pendingInvestorList[i],
          depositamount: investor.depositTokenAmount.toNumber(),
          depositcurrency: investor.depositTokenType,
          exchangedeposittxid: exchangeDepositTxId.hash,
          investordeposittxid: depositTrxId,
        },
    ]);

    if (error) {
      throw new Error(error.message);
    }

    console.log(`** Insert data to Supabase successful: ${JSON.stringify(data)}`);

    console.log(
      `** Deposit processed! Transferred ${investor.ftmDeposit} ${depositCurrency} to ${depositAddress.address}`,
    );

    result.push(
      await swapOnExchange(
        _ethers,
        signer,
        contract,
        supabase,
        exchange,
        pendingInvestorList[i],
        investor.depositTokenAmount.toNumber(),
        exchangeDepositTxId.hash
      )
    );
  }

  return {
    data: result,
  };
}

module.exports = {
  depositWithdrawal
}