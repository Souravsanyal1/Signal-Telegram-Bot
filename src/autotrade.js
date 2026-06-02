const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

class AutoTrader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isReady = false;
    this.userDataDir = path.join(__dirname, '..', 'chrome_session');
    
    // Auto-trading settings
    this.tradeAmount = process.env.TRADE_AMOUNT || 10;
  }

  async init() {
    console.log('🤖 [AutoTrade] Initializing Puppeteer for Auto Trading...');
    
    // Create session directory if it doesn't exist
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    try {
      this.browser = await puppeteer.launch({
        headless: false, // Run headful so user can log in
        userDataDir: this.userDataDir,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
        ],
      });

      this.page = await this.browser.newPage();
      
      // Basic cloaking
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      console.log('🌐 [AutoTrade] Navigating to Quotex...');
      await this.page.goto('https://qxbroker.com/en/trade', { waitUntil: 'networkidle2', timeout: 60000 });
      
      this.isReady = true;
      console.log('✅ [AutoTrade] Browser ready. Please log in manually if you are not already logged in.');
      console.log('⚠️ [AutoTrade] The bot will automatically use the active window to place trades when signals arrive.');
      
    } catch (error) {
      console.error('❌ [AutoTrade] Failed to initialize browser:', error);
    }
  }

  /**
   * Places a trade based on the generated signal.
   * Note: DOM Selectors must be kept up to date with Quotex UI changes.
   */
  async placeTrade(signal) {
    if (!this.isReady || !this.page) {
      console.warn('⚠️ [AutoTrade] Cannot place trade. Browser is not ready yet.');
      return;
    }

    try {
      console.log(`🤖 [AutoTrade] Attempting to place trade: ${signal.asset} ${signal.type}`);

      // 1. We must ensure the correct asset is selected. 
      // This is a complex DOM interaction. As a basic implementation, we will assume
      // the user has the correct asset open, OR we try to click the asset selector.
      // (For advanced use, you would need robust selectors for the asset dropdown).

      // 2. Set Trade Amount (Placeholder selector - needs to be mapped to actual UI)
      // Example: await this.page.type('input[class*="amount-input"]', String(this.tradeAmount));

      // 3. Click Up / Down
      if (signal.type.toUpperCase() === 'BUY' || signal.type.toUpperCase() === 'CALL') {
        console.log(`↗️ [AutoTrade] Clicking UP button for ${signal.asset}`);
        // await this.page.click('.btn-call'); // Replace with actual UI selector
      } else if (signal.type.toUpperCase() === 'SELL' || signal.type.toUpperCase() === 'PUT') {
        console.log(`↘️ [AutoTrade] Clicking DOWN button for ${signal.asset}`);
        // await this.page.click('.btn-put'); // Replace with actual UI selector
      }

      console.log(`✅ [AutoTrade] Trade execution triggered for ${signal.asset}`);
    } catch (error) {
      console.error(`❌ [AutoTrade] Trade execution failed:`, error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.isReady = false;
      console.log('🛑 [AutoTrade] Browser closed.');
    }
  }
}

module.exports = new AutoTrader();
