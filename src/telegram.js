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

    // Enable polling so we can receive commands from users
    this.bot = token ? new TelegramBot(token, { polling: true }) : null;
    this.chatId = chatId;

    // Admin configuration
    this.adminId = '6314449877';
    // Paid users list (mock database)
    this.paidUsers = new Set(); 

    // Track sent signals for cooldown and duplicates
    this.lastSignals = {};

    if (this.bot) {
      this.setupCommandListeners();
    }
  }

  /**
   * Set up interactive command and callback menu listeners
   */
  setupCommandListeners() {
    // 1. Welcome and Authorization gatekeeper
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);

      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      if (isAdmin) {
        this.bot.sendMessage(chatId, 
          `👑 **Welcome Admin to VIP Signal Control Panel!**\n\n` +
          `You have full unrestricted access to system controls. Use /panel to configure the bot sensitivity, simulation modes, and test triggers.`, 
          { parse_mode: 'Markdown' }
        );
      } else if (isPaid) {
        this.bot.sendMessage(chatId,
          `✅ **Welcome VIP Member!**\n\n` +
          `Your subscription is active. Use /panel to view bot status and adjust personal feed settings.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Unpaid user menu
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Subscribe Now (Paid)', callback_data: 'subscribe_info' }],
              [{ text: '💬 Contact Admin', url: 'https://t.me/Souravsanyal1' }]
            ]
          },
          parse_mode: 'Markdown'
        };
        this.bot.sendMessage(chatId,
          `🔒 **VIP SIGNAL BOT CONTROL PANEL**\n\n` +
          `This control panel is a **PAID SERVICE** designed to deliver instant premium market alerts.\n\n` +
          `Status: **Access Denied (Unsubscribed)**\n` +
          `Your Telegram ID: \`${userId}\`\n\n` +
          `Please subscribe to unlock real-time signal access!`,
          opts
        );
      }
    });

    // 2. Interactive Control Panel command
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

    // 3. Button Click Handlers (Callbacks)
    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;
      const chatId = message.chat.id;
      const userId = String(query.from.id);
      
      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      await this.bot.answerCallbackQuery(query.id);

      if (data === 'subscribe_info') {
        return this.bot.sendMessage(chatId, 
          `⭐️ **VIP SUBSCRIPTION BENEFITS** ⭐️\n\n` +
          `• Instant Real-Time Buy/Sell signals (no delay)\n` +
          `• Full custom sensitivity configuration\n` +
          `• Access to VIP asset lists (Crypto, FX, OTC)\n\n` +
          `💸 *Price: $29/Month*\n` +
          `To activate, send your ID (\`${userId}\`) to the admin: @Souravsanyal1`,
          { parse_mode: 'Markdown' }
        );
      }

      // Restrict other actions to Admins and Paid users
      if (!isAdmin && !isPaid) {
        return this.bot.sendMessage(chatId, '❌ Access Denied.');
      }

      if (data.startsWith('set_sens_')) {
        const newSens = data.split('_')[2];
        config.strategy.sensitivity = newSens;
        this.bot.sendMessage(chatId, `⚙️ Bot sensitivity updated to: **${newSens.toUpperCase()}**`, { parse_mode: 'Markdown' });
      }

      if (data === 'toggle_mode') {
        if (!isAdmin) {
          return this.bot.sendMessage(chatId, '❌ Only Admins can modify global simulation parameters.');
        }
        config.websocket.simulate = !config.websocket.simulate;
        this.bot.sendMessage(chatId, `🔄 Mode changed! Simulation Mode is now: **${config.websocket.simulate ? 'ENABLED' : 'DISABLED (LIVE MARKET)'}**`, { parse_mode: 'Markdown' });
      }

      if (data === 'test_signal') {
        this.bot.sendMessage(chatId, `🧪 Sending verification signals directly to group...`);
        this.sendSignal({
          asset: 'EUR/USD (PANEL TEST)',
          type: 'BUY',
          price: 1.08250,
          confidence: 90,
          reason: 'Manual breakout test triggered from admin panel'
        });
      }
    });
  }

  /**
   * Helper to render the Premium Control Panel keyboard
   */
  sendControlPanel(chatId, isAdmin) {
    const inline_keyboard = [
      [
        { text: '🟢 Sensitivity: High', callback_data: 'set_sens_high' },
        { text: '🟡 Medium', callback_data: 'set_sens_medium' }
      ],
      [
        { text: '🧪 Send Test Signal', callback_data: 'test_signal' }
      ]
    ];

    if (isAdmin) {
      inline_keyboard.push([
        { text: `🔄 Toggle Sim Mode (${config.websocket.simulate ? 'ON' : 'OFF'})`, callback_data: 'toggle_mode' }
      ]);
    }

    const opts = {
      reply_markup: { inline_keyboard },
      parse_mode: 'Markdown'
    };

    this.bot.sendMessage(chatId, 
      `🛠 **VIP BOT CONTROL PANEL**\n\n` +
      `Current Sensitivity: **${config.strategy.sensitivity.toUpperCase()}**\n` +
      `Engine Mode: **${config.websocket.simulate ? 'Simulation Engine' : 'Live WebSocket Feed'}**\n\n` +
      `Select an option below to configure real-time streams:`, 
      opts
    );
  }

  /**
   * Send a formatted signal to Telegram
   */
  async sendSignal(signal) {
    const { asset, type, price, confidence, reason } = signal;
    const now = Date.now();

    // 1. Duplicate & Cooldown Protection check
    const last = this.lastSignals[asset];
    if (last) {
      const timeElapsed = now - last.timestamp;

      if (last.type === type && timeElapsed < config.strategy.duplicateProtectionMs) {
        console.log(`[Telegram] Signal suppressed: Duplicate protection for ${asset}`);
        return false;
      }

      if (timeElapsed < config.strategy.cooldownMs) {
        console.log(`[Telegram] Signal suppressed: Cooldown for ${asset}`);
        return false;
      }
    }

    this.lastSignals[asset] = { type, timestamp: now, price };

    let message = '';
    if (type === 'BUY') {
      message = `🟩🟩🟩 **REAL-TIME VIP SIGNAL** 🟩🟩🟩\n\n` +
                `🔥 **SIGNAL: BUY / LONG**\n` +
                `💎 **Asset:** \`${asset}\`\n` +
                `💵 **Current Price:** \`${price.toFixed(5)}\`\n` +
                `🎯 **Confidence:** \`${confidence}%\` (High)\n` +
                `⚡ **Action:** _Buy immediately or check breakout confirmation_\n\n` +
                `📊 **Technical Analysis:**\n` +
                `👉 _${reason}_\n\n` +
                `⏳ _Powered by Premium QX Algo Bot_`;
    } else {
      message = `🟥🟥🟥 **REAL-TIME VIP SIGNAL** 🟥🟥🟥\n\n` +
                `💥 **SIGNAL: SELL / SHORT**\n` +
                `💎 **Asset:** \`${asset}\`\n` +
                `💵 **Current Price:** \`${price.toFixed(5)}\`\n` +
                `🎯 **Confidence:** \`${confidence}%\` (High)\n` +
                `⚡ **Action:** _Sell immediately or check reversal confirmation_\n\n` +
                `📊 **Technical Analysis:**\n` +
                `👉 _${reason}_\n\n` +
                `⏳ _Powered by Premium QX Algo Bot_`;
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
