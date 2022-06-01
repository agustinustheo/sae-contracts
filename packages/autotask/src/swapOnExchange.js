const { buyDAGWithUSDTAndGetBalance, sellDepositCurrencyToUSDTAndGetBalance } = require('./helper/kucoinHelper');
const { abi } = require("./abi/SaeNft.sol/SaeNft.json");
const { convertTo18Points, convertFrom18Points } =  require("./helper/utils");
const { parseUnits } = require('ethers');

require('dotenv').config();

async function swapOnExchange(
  ethers,
  signer,
  stakingContract,
  supabase,
  exchange,
  investorAddress,
  depositAmount,
  exchangeDepositTxId
) {
  try {
    console.log('** Start swap on exchange...');
    
    const depositCurrency = 'FTM';
    depositAmount = convertFrom18Points(depositAmount);
    
    /**
     * @dev For development only! Set the current ethers environment to Hardhat.
     */
    if (process.env.hasOwnProperty("ENVIRONMENT_TYPE") && process.env.ENVIRONMENT_TYPE == "development") { // eslint-disable-line
      depositAmount = 1;
    }
  
    console.log(`** Transaction ID: ${exchangeDepositTxId}`);
  
    console.log(
      `** Moving balance from main to trading: ${exchange.id} ${JSON.stringify(await exchange.transfer(depositCurrency, depositAmount, 'main', 'trading'))}`
    );
  
    const { supabaseTrx: supabaseTrx1, usdtBalance, saeBalance: saeInitialBalance } = await sellDepositCurrencyToUSDTAndGetBalance(
      exchange,
      supabase,
      depositCurrency,
      depositAmount,
      exchangeDepositTxId
    );
  
    const { supabaseTrx: supabaseTrx2, saeTradeBalance } = await buyDAGWithUSDTAndGetBalance(
      exchange,
      supabase,
      usdtBalance,
      saeInitialBalance,
      exchangeDepositTxId
    );
  
    console.log(
      `** Moving balance from trading to main: ${exchange.id} ${JSON.stringify(await exchange.transfer('DAG', saeTradeBalance, 'trading', 'main'))}`
    );

    console.log(
      `** ${depositAmount} ${depositCurrency} was traded for ${saeTradeBalance} DAG`,
    );

    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const nftContract = new ethers.Contract(
      contractAddress, 
      abi, 
      signer
    );

    const tokenId = await nftContract.nextTokenId();
    await nftContract.safeMint(investorAddress, "tokenUri");

    console.log(
      `** Minted NFT ${tokenId} for ${saeTradeBalance} DAG. Investor ${investorAddress}`,
    );
    
    await stakingContract.convertInvestorDepositToNftValue(
      investorAddress,
      tokenId,
      `${convertTo18Points(saeTradeBalance)}`
    );

    return {
      data: [
        supabaseTrx1,
        supabaseTrx2
      ]
    };
  }
  catch(err) {
    console.error(err.message);
    return;
  }
}

module.exports = {
  swapOnExchange
}