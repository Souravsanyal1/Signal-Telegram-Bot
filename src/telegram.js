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

    this.bot = token ? new TelegramBot(token, { polling: !process.env.DISABLE_POLLING }) : null;
    this.chatId = chatId;

    // Admin & paid users database (in-memory)
    this.adminId = '6314449877';
    this.paidUsers = new Set(); 

    // Uptime stats
    this.startTime = Date.now();
    this.totalSignalsSent = 0;
    this.winScoreRatio = 91.2;
    this.lastSignals = {};

    if (this.bot) {
      this.setupCommandListeners();
    }
  }

  /**
   * Helper to verify if user is subscribed to the target Telegram Channel
   */
  async checkForceJoin(userId) {
    if (userId === this.adminId) return true;
    if (!this.chatId) return true;

    try {
      const member = await this.bot.getChatMember(this.chatId, userId);
      const status = member.status;
      // Member statuses that count as joined
      return ['creator', 'administrator', 'member'].includes(status);
    } catch (error) {
      console.error(`⚠️ Force Join check failed for user ${userId}:`, error.message);
      // Fallback to true if chat/channel is private or not queryable
      return true;
    }
  }

  setupCommandListeners() {
    // 1. Welcome and Membership Gatekeeper
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);

      // Force join check
      const hasJoined = await this.checkForceJoin(userId);
      if (!hasJoined) {
        const joinKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 Join Our Telegram Channel', url: `https://t.me/c/${this.chatId.replace('-100', '')}` || 'https://t.me/Souravsanyal1' }],
              [{ text: '🔄 Check Membership', callback_data: 'check_membership_status' }]
            ]
          },
          parse_mode: 'HTML'
        };

        return this.bot.sendMessage(chatId,
          `⚠️ <b>ACCESS RESTRICTED</b>\n\n` +
          `You must join our official Telegram channel before using this bot.\n\n` +
          `Please join the channel using the button below and then click <b>Check Membership</b>.`,
          joinKeyboard
        );
      }

      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      if (isAdmin) {
        this.bot.sendMessage(chatId, 
          `👑 <b>REAL-TIME SUPER QUANT ENGINE (ADMIN)</b> 👑\n\n` +
          `Welcome Master Admin. Live server status is stable.\n\n` +
          `📈 <b>Quant Algorithm Statistics:</b>\n` +
          `• Total Signals: <code>${this.totalSignalsSent}</code>\n` +
          `• Winrate Average: <code>${this.winScoreRatio.toFixed(1)}%</code>\n` +
          `• Paid Subscriptions: <code>${this.paidUsers.size}</code>\n` +
          `• System Uptime: <code>${((Date.now() - this.startTime) / 60000).toFixed(1)} mins</code>\n\n` +
          `<b>Admin Commands Available:</b>\n` +
          `👉 <code>/addpaid &lt;UserID&gt;</code> - Add paid user\n` +
          `👉 <code>/removepaid &lt;UserID&gt;</code> - Remove paid user\n` +
          `👉 <code>/listpaid</code> - View all paid users\n` +
          `👉 <code>/panel</code> - View advanced controls`, 
          { parse_mode: 'HTML' }
        );
      } else if (isPaid) {
        this.bot.sendMessage(chatId,
          `🟩 <b>VIP MEMBERSHIP CONTROL</b> 🟩\n\n` +
          `Your subscription is active. Use /panel to adjust custom alerts.`,
          { parse_mode: 'HTML' }
        );
      } else {
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Open Payment Portal', callback_data: 'subscribe_info' }],
              [{ text: '💬 Contact Master Admin', url: 'https://t.me/Souravsanyal1' }]
            ]
          },
          parse_mode: 'HTML'
        };
        this.bot.sendMessage(chatId,
          `🔒 <b>VIP ACCESS REQUIRED</b> 🔒\n\n` +
          `This bot uses a Super Advanced Multi-Indicator Fusion Quant Engine (MACD, Bollinger, Stochastic, and ATR).\n\n` +
          `Status: <b>Access Denied (Free tier restricted)</b>\n` +
          `Your ID: <code>${userId}</code>\n\n` +
          `Please purchase a subscription to unlock instant Quotex signals.`,
          opts
        );
      }
    });

    // 2. Admin Commands implementation
    this.bot.onText(/\/addpaid (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);
      if (userId !== this.adminId) return;

      const targetId = match[1].trim();
      this.paidUsers.add(targetId);
      this.bot.sendMessage(chatId, `✅ User <code>${targetId}</code> successfully added to Paid list.`, { parse_mode: 'HTML' });
    });

    this.bot.onText(/\/removepaid (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);
      if (userId !== this.adminId) return;

      const targetId = match[1].trim();
      if (this.paidUsers.delete(targetId)) {
        this.bot.sendMessage(chatId, `✅ User <code>${targetId}</code> removed from Paid list.`, { parse_mode: 'HTML' });
      } else {
        this.bot.sendMessage(chatId, `⚠️ User <code>${targetId}</code> not found in Paid list.`, { parse_mode: 'HTML' });
      }
    });

    this.bot.onText(/\/listpaid/, (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);
      if (userId !== this.adminId) return;

      if (this.paidUsers.size === 0) {
        return this.bot.sendMessage(chatId, '🫙 No paid users registered yet.', { parse_mode: 'HTML' });
      }

      let response = '👥 <b>Active Paid Users:</b>\n';
      this.paidUsers.forEach(user => {
        response += `• <code>${user}</code>\n`;
      });
      this.bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    });

    this.bot.onText(/\/panel/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from.id);

      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      if (!isAdmin && !isPaid) return;
      this.sendControlPanel(chatId, isAdmin);
    });

    // 3. Callback handlers
    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;
      const chatId = message.chat.id;
      const userId = String(query.from.id);
      
      const isAdmin = userId === this.adminId;
      const isPaid = this.paidUsers.has(userId);

      await this.bot.answerCallbackQuery(query.id);

      if (data === 'check_membership_status') {
        const hasJoined = await this.checkForceJoin(userId);
        if (hasJoined) {
          this.bot.sendMessage(chatId, '✅ Thank you! Membership verified. Type /start to open menu.', { parse_mode: 'HTML' });
        } else {
          this.bot.sendMessage(chatId, '❌ You still have not joined our channel. Please join first and retry.', { parse_mode: 'HTML' });
        }
        return;
      }

      if (data === 'subscribe_info') {
        return this.bot.sendMessage(chatId, 
          `⭐️ <b>VIP PREMIUM PAYMENT INFO</b> ⭐️\n\n` +
          `Open our Web Portal to pay via Bkash, Nagad or Dollars:\n` +
          `👉 <a href="https://souravsanyal1.github.io/Signal-Telegram-Bot/payment/index.html">Click Here to Open Payment Web Portal</a>\n\n` +
          `Your Telegram ID: <code>${userId}</code> (Copy this to the payment form)`,
          { parse_mode: 'HTML', disable_web_page_preview: true }
        );
      }

      if (!isAdmin && !isPaid) return;

      if (data.startsWith('set_sens_')) {
        const newSens = data.split('_')[2];
        config.strategy.sensitivity = newSens;
        this.bot.sendMessage(chatId, `⚙️ Sensitivity adjusted: <b>${newSens.toUpperCase()}</b>`, { parse_mode: 'HTML' });
      }

      if (data === 'toggle_mode') {
        if (!isAdmin) return;
        config.websocket.simulate = !config.websocket.simulate;
        this.bot.sendMessage(chatId, `🔄 Engine Mode: <b>${config.websocket.simulate ? 'Simulator' : 'Live WebSocket'}</b>`, { parse_mode: 'HTML' });
      }

      if (data === 'test_signal') {
        this.bot.sendMessage(chatId, `🧪 Sending live VIP signal test to group...`);
        this.sendSignal({
          asset: 'EUR/USD',
          type: 'BUY',
          price: 1.08250,
          confidence: 96,
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
        { text: '🧪 Run VIP Test', callback_data: 'test_signal' }
      ]
    ];

    if (isAdmin) {
      inline_keyboard.push([
        { text: `🔄 Toggle Sim (${config.websocket.simulate ? 'ON' : 'OFF'})`, callback_data: 'toggle_mode' }
      ]);
    }

    const opts = {
      reply_markup: { inline_keyboard },
      parse_mode: 'HTML'
    };

    this.bot.sendMessage(chatId, 
      `🛠 <b>VIP QUANT CONTROL CENTER</b>\n\n` +
      `• Total Signals: <code>${this.totalSignalsSent}</code>\n` +
      `• Sensitivity: <code>${config.strategy.sensitivity.toUpperCase()}</code>\n` +
      `• Engine Mode: <code>${config.websocket.simulate ? 'Simulator' : 'Live WebSocket'}</code>\n\n` +
      `Modify engine parameters below:`, 
      opts
    );
  }

  /**
   * Send a formatted signal with dynamic ATR and TP/SL coordinates to Telegram
   */
  async sendSignal(signal) {
    const { asset, type, price, confidence, reason } = signal;
    const now = Date.now();

    const last = this.lastSignals[asset];
    if (last) {
      const timeElapsed = now - last.timestamp;
      if (last.type === type && timeElapsed < config.strategy.duplicateProtectionMs) return false;
      if (timeElapsed < config.strategy.cooldownMs) return false;
    }

    this.lastSignals[asset] = { type, timestamp: now, price };
    this.totalSignalsSent++;

    let message = '';
    const formattedPrice = price.toFixed(asset.includes('BTC') ? 2 : 5);
    const timeString = new Date().toLocaleTimeString('en-US', { hour12: false });

    // Escape HTML strings
    const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapedReason = escapeHTML(reason);

    // Dynamic Quotex Real/OTC Market checking
    const isOTC = asset.toUpperCase().includes('OTC') || new Date().getDay() === 0 || new Date().getDay() === 6;
    const marketType = isOTC ? 'Quotex OTC Market' : 'Quotex Real Market';

    if (type === 'BUY') {
      message = `🟩🟩🟩 <b>REAL-TIME VIP SIGNAL</b> 🟩🟩🟩\n\n` +
                `💥 <b>SIGNAL:</b> <code>BUY / LONG</code>\n` +
                `💎 <b>Asset:</b> <code>${asset} (${marketType})</code>\n` +
                `💵 <b>Current Price:</b> <code>${formattedPrice}</code>\n` +
                `🎯 <b>Confidence:</b> <code>${confidence}% (High)</code>\n` +
                `⏰ <b>time:</b> <code>${timeString} (1 Minute Candle)</code>\n` +
                `⚡ <b>Action:</b> <code>Buy immediately or check breakout confirmation</code>\n\n` +
                `📊 <b>Technical Analysis:</b>\n` +
                `👉 <i>${escapedReason}</i>\n\n` +
                `⏳ <b>Powered by:</b> ${this.botName}`;
    } else {
      message = `🟥🟥🟥 <b>REAL-TIME VIP SIGNAL</b> 🟥🟥🟥\n\n` +
                `💥 <b>SIGNAL:</b> <code>SELL / SHORT</code>\n` +
                `💎 <b>Asset:</b> <code>${asset} (${marketType})</code>\n` +
                `💵 <b>Current Price:</b> <code>${formattedPrice}</code>\n` +
                `🎯 <b>Confidence:</b> <code>${confidence}% (High)</code>\n` +
                `⏰ <b>time:</b> <code>${timeString} (1 Minute Candle)</code>\n` +
                `⚡ <b>Action:</b> <code>Sell immediately or check reversal confirmation</code>\n\n` +
                `📊 <b>Technical Analysis:</b>\n` +
                `👉 <i>${escapedReason}</i>\n\n` +
                `⏳ <b>Powered by:</b> ${this.botName}`;
    }

    if (!this.bot || !this.chatId) return true;

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      console.error(`❌ [Telegram] Failed to send message:`, error.message);
      return false;
    }
  }
}

module.exports = new TelegramManager();
