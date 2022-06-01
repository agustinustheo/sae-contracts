const { sleep } = require('./utils');

async function findKuCoinTrxId(exchange, depositTrxId) {
    const transactions = await exchange.fetchDeposits();
  
    if (!transactions.length) { 
      throw new Error('Transactions not found!');
    }

    return transactions.find(
        ({ txid }) => txid === depositTrxId,
    );
}

async function sellDepositCurrencyToUSDTAndGetBalance(exchange, supabase, depositCurrency, depositAmount, depositTrxId) {
    // Create order to exchange tokens to USDT
    const toUSDTOrder = await exchange.createMarketSellOrder(
      `${depositCurrency}/USDT`,
      depositAmount,
    );
  
    console.log(`** Order executed: ${JSON.stringify(toUSDTOrder)}`);
  
    // eslint-disable-next-line
    const { trx1 , error } = await supabase
      .from('saetrades')
      .update({ tradeid1: toUSDTOrder.id })
      .eq('exchangedeposittxid', depositTrxId);
  
    if (error) {
        throw new Error(error.message);
    }
  
    await sleep(1000);
  
    const tradeToUSDT = await exchange.fetchOrder(toUSDTOrder.id);
    console.log(
      tradeToUSDT.id +
        ': executed a ' +
        tradeToUSDT.type +
        ' ' +
        tradeToUSDT.side +
        ' order for ' +
        tradeToUSDT.amount +
        ` ${depositCurrency} for ` +
        tradeToUSDT.amount * tradeToUSDT.average +
        ' USDT',
    );
  
    const USDTBalance = (await exchange.fetchBalance(
        (params = { currency: 'USDT' })
    )).free.USDT;
  
    const DAGBalance = (await exchange.fetchBalance(
        (params = { currency: 'DAG' })
    )).free.DAG;

    return {
        usdtBalance: USDTBalance,
        saeBalance: DAGBalance
    };
}

async function buyDAGWithUSDTAndGetBalance(exchange, supabase, usdtBalance, saeInitialBalance, depositTrxId) {
  const USDTtoDAGOrder = await exchange.createMarketBuyOrder('DAG/USDT', 0, {
    cost: usdtBalance - 0.01,
  });

  // eslint-disable-next-line
  const { trx1, _error } = await supabase
    .from('saetrades')
    .update({ tradeid2: USDTtoDAGOrder.id })
    .eq('exchangedeposittxid', depositTrxId);

  if (_error) {
    throw new Error(_error.message);
  }

  await sleep(1000);

  const tradeToDAG = await exchange.fetchOrder(USDTtoDAGOrder.id);
  console.log(
    tradeToDAG.id +
      ': executed a ' +
      tradeToDAG.type +
      ' ' +
      tradeToDAG.side +
      ' order for ' +
      tradeToDAG.amount * tradeToDAG.average +
      ' USDT for ' +
      tradeToDAG.amount +
      ' DAG',
  );

  saeEndBalance = (await exchange.fetchBalance(
    (params = { currency: 'DAG' })
  )).free.DAG;
  saeTradeBalance = saeEndBalance - saeInitialBalance;

  const { trx2, error } = await supabase
    .from('saetrades')
    .update({ saeamount: saeTradeBalance })
    .eq('exchangedeposittxid', depositTrxId);
    
  if (error) {
    throw new Error(error.message);
  }

  return {
      supabaseTrx: [trx1, trx2],
      saeTradeBalance
  }
}

module.exports = {
  findKuCoinTrxId,
  sellDepositCurrencyToUSDTAndGetBalance,
  buyDAGWithUSDTAndGetBalance
}