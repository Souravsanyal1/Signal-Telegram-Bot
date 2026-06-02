const TelegramBot = require('node-telegram-bot-api');

const token = '8803839815:AAGfidU7NFmAIgQb5OK7H7QRoC85ZM0SGQM';
const groupId = '-1003749201190';
const userId = '6314449877';

const bot = new TelegramBot(token, { polling: false });

async function runTests() {
  console.log('🧪 Starting Multi-Target Bot Delivery Test...');

  const testMessage = `🚀 **REAL-TIME TRADING BOT TEST**\n` +
                      `Status: Active & Verified\n` +
                      `Time: ${new Date().toLocaleTimeString()}`;

  // Test 1: Send to Group
  console.log(`\n📤 [Test 1] Sending to Group: ${groupId}`);
  try {
    await bot.sendMessage(groupId, testMessage, { parse_mode: 'Markdown' });
    console.log('✅ [Test 1] SUCCESS! Message delivered to Group.');
  } catch (error) {
    console.error(`❌ [Test 1] FAILED:`, error.message);
  }

  // Test 2: Send to User ID (Direct Message)
  console.log(`\n📤 [Test 2] Sending to User: ${userId}`);
  try {
    await bot.sendMessage(userId, testMessage, { parse_mode: 'Markdown' });
    console.log('✅ [Test 2] SUCCESS! Message delivered to User directly.');
  } catch (error) {
    console.error(`❌ [Test 2] FAILED:`, error.message);
    console.log('💡 Note: The user must search for the bot and click "/start" before the bot can DM them.');
  }
}

runTests();
