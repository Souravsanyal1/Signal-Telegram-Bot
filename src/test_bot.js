process.env.DISABLE_POLLING = 'true';
const telegram = require('./telegram');

async function runTests() {
  console.log('🧪 Starting Upgraded Bot Delivery Test...');

  // Wait a short moment to ensure bot identity is fetched
  await new Promise(resolve => setTimeout(resolve, 2000));

  const testBuySignal = {
    asset: 'EUR/USD (UPGRADED)',
    type: 'BUY',
    price: 1.08076,
    confidence: 93,
    reason: 'Fast Bullish Breakout: Price broke above Bollinger Upper Band with high velocity.'
  };

  const testSellSignal = {
    asset: 'EUR/USD (UPGRADED)',
    type: 'SELL',
    price: 1.08076,
    confidence: 93,
    reason: 'Fast Bearish Breakout: Price dropped below Bollinger Lower Band with high velocity.'
  };

  console.log('📤 Sending BUY signal...');
  await telegram.sendSignal(testBuySignal);

  // Wait 12 seconds to bypass duplicate and cooldown protections
  await new Promise(resolve => setTimeout(resolve, 12000));

  console.log('📤 Sending SELL signal...');
  await telegram.sendSignal(testSellSignal);
}

runTests();
