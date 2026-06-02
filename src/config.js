require('dotenv').config();

module.exports = {
  autoTrade: {
    enabled: process.env.AUTO_TRADE_ENABLED === 'true', // Default: false (disabled)
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  websocket: {
    url: process.env.WS_URL || 'wss://ws2.market-qx.trade/socket.io/?EIO=3&transport=websocket',
    simulate: process.env.SIMULATE_MARKET === 'true',
  },
  strategy: {
    // Cooldown window between consecutive signals for the SAME asset (in milliseconds)
    cooldownMs: parseInt(process.env.SIGNAL_COOLDOWN_MS || '300000', 10), // default 5 mins
    // Protection window to avoid duplicate signals (in milliseconds)
    duplicateProtectionMs: parseInt(process.env.DUPLICATE_PROTECTION_MS || '600000', 10), // default 10 mins
    // Sensitivity scale: 'high', 'medium', 'low'
    sensitivity: process.env.SENSITIVITY || 'medium',
    // Assets to monitor
    monitoredAssets: [
      'EUR/USD',
      'GBP/USD',
      'USD/JPY',
      'AUD/USD',
      'EUR/GBP',
      'BTC/USD'
    ]
  }
};
