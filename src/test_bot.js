const TelegramBot = require('node-telegram-bot-api');

const token = '8803839815:AAGfidU7NFmAIgQb5OK7H7QRoC85ZM0SGQM';
const groupId = '-1003749201190';
const userId = '6314449877';

const bot = new TelegramBot(token, { polling: false });

async function runTests() {
  console.log('🧪 Starting Super Advanced Bot Delivery Test...');

  const buyMessage = `🟩🟩🟩 **VIP QUANT ALGO: BUY** 🟩🟩🟩\n\n` +
                     `🔥 **Asset Pair:** \`EUR/USD (SUPER-TEST)\`\n` +
                     `💵 **Strike Price:** \`1.08250\`\n` +
                     `🎯 **Take Profit (TP):** \`1.08500\`\n` +
                     `🛡 **Stop Loss (SL):** \`1.08050\`\n` +
                     `⏳ **Recommended Expiry:** \`1 MINUTE\`\n` +
                     `📈 **Signal Confidence:** \`96%\`\n\n` +
                     `📊 **Decision Engine Metrics:**\n` +
                     `👉 _MACD Golden Crossover detected. | Price broke above Upper Bollinger Band._\n\n` +
                     `👑 _Accuracy Score: 94.2%_`;

  const sellMessage = `🟥🟥🟥 **VIP QUANT ALGO: SELL** 🟥🟥🟥\n\n` +
                      `💥 **Asset Pair:** \`GBP/USD (SUPER-TEST)\`\n` +
                      `💵 **Strike Price:** \`1.25400\`\n` +
                      `🎯 **Take Profit (TP):** \`1.25150\`\n` +
                      `🛡 **Stop Loss (SL):** \`1.25600\`\n` +
                      `⏳ **Recommended Expiry:** \`5 MINUTES\`\n` +
                      `📉 **Signal Confidence:** \`93%\`\n\n` +
                      `📊 **Decision Engine Metrics:**\n` +
                      `👉 _MACD Death Crossover detected. | Stochastic Oscillator bearish rejection._\n\n` +
                      `👑 _Accuracy Score: 91.8%_`;

  // Test 1: Send to Group
  console.log(`\n📤 [Test 1] Sending BUY to Group: ${groupId}`);
  try {
    await bot.sendMessage(groupId, buyMessage, { parse_mode: 'Markdown' });
    console.log('✅ [Test 1] SUCCESS! BUY message delivered.');
  } catch (error) {
    console.error(`❌ [Test 1] FAILED:`, error.message);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Send to Group (Sell)
  console.log(`\n📤 [Test 2] Sending SELL to Group: ${groupId}`);
  try {
    await bot.sendMessage(groupId, sellMessage, { parse_mode: 'Markdown' });
    console.log('✅ [Test 2] SUCCESS! SELL message delivered.');
  } catch (error) {
    console.error(`❌ [Test 2] FAILED:`, error.message);
  }
}

runTests();
