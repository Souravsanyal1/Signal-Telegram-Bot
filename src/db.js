const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'paid_users.json');
const SETTINGS_PATH = path.join(__dirname, '..', 'bot_settings.json');

function loadPaidUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      const list = JSON.parse(data);
      return new Set(list);
    }
  } catch (error) {
    console.error('❌ Failed to load paid users database:', error.message);
  }
  return new Set();
}

function savePaidUsers(paidUsersSet) {
  try {
    const list = Array.from(paidUsersSet);
    fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2), 'utf8');
    console.log(`💾 Saved ${list.length} paid users to database.`);
  } catch (error) {
    console.error('❌ Failed to save paid users database:', error.message);
  }
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ Failed to load bot settings:', error.message);
  }
  // Default settings
  return {
    winEmoji: '🏆',
    lossEmoji: '❌',
    winStickerId: null,    // Telegram sticker file_id
    lossStickerId: null,   // Telegram sticker file_id
    winMessage: '✅ WIN! আমাদের সিগন্যাল সফল হয়েছে!',
    lossMessage: '📉 LOSS. পরবর্তী সিগন্যালের জন্য অপেক্ষা করুন।',
    showWinAfterSignal: false,  // Auto show win after candle expires
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    console.log('💾 Bot settings saved.');
  } catch (error) {
    console.error('❌ Failed to save bot settings:', error.message);
  }
}

module.exports = {
  loadPaidUsers,
  savePaidUsers,
  loadSettings,
  saveSettings,
};
