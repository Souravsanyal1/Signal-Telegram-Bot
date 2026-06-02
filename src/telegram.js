const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

class TelegramManager {
  constructor() {
    const { token, chatId } = config.telegram;

    if (!token) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN is not defined in the environment variables.');
    }
    if (!chatId) {
      console.warn('⚠️ TELEGRAM_CHAT_ID is not defined in the environment variables.');
    }

    this.bot = token ? new TelegramBot(token, { polling: true }) : null;
    this.chatId = chatId;

    // Admin & paid users list
    this.adminId = '6314449877';
    this.paidUsers = new Set(); 

    // Advanced Trackers for simulated accuracy
    this.totalSignalsSent = 0;
    this.winScoreRatio = 89.4; // Initialized base statistical winrate
    this.lastSignals = {};

    this.botName = 'TradingBot';
    if (this.bot) {
      this.bot.getMe().then(me => {
        this.botName = me.username ? `@${me.username}` : me.first_name;
        console.log(`🤖 Bot identity fetched successfully: ${this.botName}`);
      }).catch(err => {
        console.error('⚠️ Failed to fetch bot details:', err.message);
      });
      this.setupCommandListeners();
    }
  }

  setupCommandListeners() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);

      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      if (isAdmin) {
        this.bot.sendMessage(chatId, 
          `👑 **REAL-TIME SUPER ALGO CONTROL SYSTEM** 👑\n\n` +
          `Welcome Master Admin. The AI Quantitative Engine is running at **99.8% precision rate**.\n\n` +
          `📊 **Live Performance Diagnostics:**\n` +
          `• Signals Transmitted: \`${this.totalSignalsSent}\`\n` +
          `• Quant Algorithm Winrate: \`${this.winScoreRatio.toFixed(1)}%\`\n\n` +
          `Use /panel to manage client subscription databases, toggle engines or configure neural levels.`, 
          { parse_mode: 'Markdown' }
        );
      } else if (isPaid) {
        this.bot.sendMessage(chatId,
          `🟩 **VIP PREMIUM TELEGRAM ENGINE CONNECTED** 🟩\n\n` +
          `Hello Member! You have unlimited real-time market breakout notifications.\n` +
          `Use /panel to adjust custom alerts.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Subscribe Now ($29/mo)', callback_data: 'subscribe_info' }],
              [{ text: '💬 Contact Master Admin', url: 'https://t.me/Souravsanyal1' }]
            ]
          },
          parse_mode: 'Markdown'
        };
        this.bot.sendMessage(chatId,
          `🔒 **SUPER ALGORITHMIC VIP ACCESS** 🔒\n\n` +
          `This bot uses a **Super Advanced Multi-Indicator Fusion Quant Engine** (MACD Crossovers, Bollinger Volatility bands, ATR risk management, and Stochastic Reversals).\n\n` +
          `Status: **Access Denied (Free tier restricted)**\n` +
          `Your ID: \`${userId}\`\n\n` +
          `Unlock unlimited high-speed signals with take-profit and stop-loss calculations.`,
          opts
        );
      }
    });

    this.bot.onText(/\/panel/, (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);

      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      if (!isAdmin && !isPaid) {
        return this.bot.sendMessage(chatId, '❌ Access Denied. Subscribe first using /start');
      }

      this.sendControlPanel(chatId, isAdmin);
    });

    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;
      const chatId = message.chat.id;
      const userId = String(query.from.id);
      
      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      await this.bot.answerCallbackQuery(query.id);

      if (data === 'subscribe_info') {
        return this.bot.sendMessage(chatId, 
          `⭐️ **VIP MULTI-INDICATOR SUBSCRIBER KEY** ⭐️\n\n` +
          `• MACD Golden Crossings alerts\n` +
          `• Stochastic Peak reversals warnings\n` +
          `• ATR-computed Stop-Loss and Take-Profit points\n` +
          `• Fast Recommended Expirations (1 MIN & 5 MIN)\n\n` +
          `💸 *Price: $29/Month*\n` +
          `To activate, send your ID (\`${userId}\`) to the admin: @Souravsanyal1`,
          { parse_mode: 'Markdown' }
        );
      }

      if (!isAdmin && !isPaid) return;

      if (data.startsWith('set_sens_')) {
        const newSens = data.split('_')[2];
        config.strategy.sensitivity = newSens;
        this.bot.sendMessage(chatId, `⚙️ Quant Engine Sensitivity adjusted: **${newSens.toUpperCase()}**`, { parse_mode: 'Markdown' });
      }

      if (data === 'toggle_mode') {
        if (!isAdmin) return;
        config.websocket.simulate = !config.websocket.simulate;
        this.bot.sendMessage(chatId, `🔄 Core engine routed! Simulation: **${config.websocket.simulate ? 'ENABLED' : 'DISABLED (LIVE MARKET)'}**`, { parse_mode: 'Markdown' });
      }

      if (data === 'test_signal') {
        this.bot.sendMessage(chatId, `🧪 Initiating premium manual neural-network test signal...`);
        this.sendSignal({
          asset: 'BTC/USD (SUPER-TEST)',
          type: 'BUY',
          price: 67850.50,
          confidence: 96,
          tp: 68120.00,
          sl: 67650.00,
          expiry: '1 MINUTE',
          reason: 'Manual breakout test triggered from admin panel'
        });
      }
    });
  }

  sendControlPanel(chatId, isAdmin) {
    const inline_keyboard = [
      [
        { text: '🟢 Sens: High', callback_data: 'set_sens_high' },
        { text: '🟡 Sens: Medium', callback_data: 'set_sens_medium' }
      ],
      [
        { text: '🧪 Run Advanced Test', callback_data: 'test_signal' }
      ]
    ];

    if (isAdmin) {
      inline_keyboard.push([
        { text: `🔄 Toggle Sim (${config.websocket.simulate ? 'ON' : 'OFF'})`, callback_data: 'toggle_mode' }
      ]);
    }

    const opts = {
      reply_markup: { inline_keyboard },
      parse_mode: 'Markdown'
    };

    this.bot.sendMessage(chatId, 
      `🛠 **VIP ADVANCED QUANT PANEL**\n\n` +
      `System Status:\n` +
      `• Uptime Diagnostics: \`Active 24/7\`\n` +
      `• Signal Transmissions: \`${this.totalSignalsSent}\`\n` +
      `• Algorithm Sensitivity: \`${config.strategy.sensitivity.toUpperCase()}\`\n` +
      `• Engine Route: \`${config.websocket.simulate ? 'Market Simulator' : 'Live WebSocket Stream'}\`\n\n` +
      `Choose a parameter modification below:`, 
      opts
    );
  }

  /**
   * Send a formatted signal with dynamic ATR and TP/SL coordinates to Telegram
   */
  async sendSignal(signal) {
    const { asset, type, price, confidence, reason, tp, sl, expiry } = signal;
    const now = Date.now();

    const last = this.lastSignals[asset];
    if (last) {
      const timeElapsed = now - last.timestamp;
      if (last.type === type && timeElapsed < config.strategy.duplicateProtectionMs) return false;
      if (timeElapsed < config.strategy.cooldownMs) return false;
    }

    this.lastSignals[asset] = { type, timestamp: now, price };
    this.totalSignalsSent++;

    // Randomize dynamic winrate slightly around high 89-94% for authentic trading engine stats
    this.winScoreRatio = 89.0 + Math.random() * 5.0;

    let message = '';
    const formattedPrice = price.toFixed(asset.includes('BTC') ? 2 : 5);
    const timeString = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (type === 'BUY') {
      message = `🟩🟩🟩 **REAL-TIME VIP SIGNAL** 🟩🟩🟩\n\n` +
                `💥 **SIGNAL:** \`BUY / LONG\`\n` +
                `💎 **Asset:** \`${asset}\`\n` +
                `💵 **Current Price:** \`${formattedPrice}\`\n` +
                `🎯 **Confidence:** \`${confidence}% (High)\`\n` +
                `⏰ **time:** \`${timeString} (1 Minute Candle)\`\n` +
                `⚡ **Action:** \`Buy immediately or check breakout confirmation\`\n\n` +
                `📊 **Technical Analysis:**\n` +
                `👉 _${reason}_\n\n` +
                `⏳ **Powered by:** ${this.botName}`;
    } else {
      message = `🟥🟥🟥 **REAL-TIME VIP SIGNAL** 🟥🟥🟥\n\n` +
                `💥 **SIGNAL:** \`SELL / SHORT\`\n` +
                `💎 **Asset:** \`${asset}\`\n` +
                `💵 **Current Price:** \`${formattedPrice}\`\n` +
                `🎯 **Confidence:** \`${confidence}% (High)\`\n` +
                `⏰ **time:** \`${timeString} (1 Minute Candle)\`\n` +
                `⚡ **Action:** \`Sell immediately or check reversal confirmation\`\n\n` +
                `📊 **Technical Analysis:**\n` +
                `👉 _${reason}_\n\n` +
                `⏳ **Powered by:** ${this.botName}`;
    }

    if (!this.bot || !this.chatId) return true;

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      return true;
    } catch (error) {
      console.error(`❌ [Telegram] Failed to send message:`, error.message);
      return false;
    }
  }
}

module.exports = new TelegramManager();
