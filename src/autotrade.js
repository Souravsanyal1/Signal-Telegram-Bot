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
    this.isLoggedIn = false;
    this.userDataDir = path.join(__dirname, '..', 'chrome_session');
    
    // Auto-trading settings
    this.tradeAmount = process.env.TRADE_AMOUNT || 10;
  }

  async init() {
    console.log('🤖 [AutoTrade] Initializing Puppeteer for Auto Trading...');
    
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    try {
      const isHeadless = process.env.AUTO_TRADE_HEADLESS === 'true';
      this.browser = await puppeteer.launch({
        headless: isHeadless ? 'new' : false,
        userDataDir: this.userDataDir,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--start-maximized',
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      // Set a standard viewport to ensure consistent layout and positioning
      await this.page.setViewport({ width: 1920, height: 1080 });

      const email = process.env.QUOTEX_EMAIL;
      const password = process.env.QUOTEX_PASSWORD;

      if (email && password) {
        console.log('🔐 [AutoTrade] Credentials found. Attempting auto-login to Quotex...');
        await this.attemptLogin(email, password);
      } else {
        console.log('⚠️ [AutoTrade] No credentials in .env. Opening Quotex for manual login...');
        await this.page.goto('https://qxbroker.com/en/trade', { waitUntil: 'networkidle2', timeout: 60000 });
      }

      this.isReady = true;

    } catch (error) {
      console.error('❌ [AutoTrade] Failed to initialize browser:', error.message);
    }
  }

  async attemptLogin(email, password) {
    try {
      // Go to sign-in page
      console.log('🌐 [AutoTrade] Opening Quotex sign-in page...');
      await this.page.goto('https://qxbroker.com/en/sign-in', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Wait a bit for page layout and spinner to settle
      await this.sleep(4000);

      // Check if already redirected to trade page (e.g. if session restore worked instantly)
      let currentUrl = this.page.url();
      if (currentUrl.includes('/trade') || currentUrl.includes('/en/trade')) {
        this.isLoggedIn = true;
        console.log('✅ [AutoTrade] Auto-login bypassed (already logged in). Ready to place trades.');
        return;
      }

      // Try to find the email input field and wait for it to be visible
      const emailSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="mail"]',
        'input[placeholder*="Email"]',
        'input[class*="input-value"]',
      ];

      let emailSelector = null;
      for (const sel of emailSelectors) {
        try {
          const el = await this.page.waitForSelector(sel, { visible: true, timeout: 3000 });
          if (el) {
            emailSelector = sel;
            console.log(`✅ [AutoTrade] Found email field with selector: ${sel}`);
            break;
          }
        } catch (e) { /* ignore and try next */ }
      }

      if (!emailSelector) {
        console.warn('⚠️ [AutoTrade] Could not find visible email input. Saving screenshot...');
        await this.page.screenshot({ path: path.join(__dirname, '..', 'login_debug.png') });
        console.warn('📸 [AutoTrade] Screenshot saved as login_debug.png - check what the page looks like.');
        return;
      }

      // Fill email via JavaScript evaluation to bypass physical click blockages
      console.log('📧 [AutoTrade] Entering email...');
      const emailFilled = await this.page.evaluate((sel, val) => {
        const el = document.querySelector(sel);
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, emailSelector, email);

      if (!emailFilled) {
        throw new Error('Could not set email field value');
      }

      await this.sleep(1000);

      // Try to find the password input field and wait for it to be visible
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="assword"]',
        'input[id*="password"]',
      ];

      let passwordSelector = null;
      for (const sel of passwordSelectors) {
        try {
          const el = await this.page.waitForSelector(sel, { visible: true, timeout: 3000 });
          if (el) {
            passwordSelector = sel;
            console.log(`✅ [AutoTrade] Found password field with selector: ${sel}`);
            break;
          }
        } catch (e) { /* ignore and try next */ }
      }

      if (!passwordSelector) {
        console.warn('⚠️ [AutoTrade] Could not find visible password input field.');
        return;
      }

      // Fill password via JavaScript evaluation
      console.log('🔑 [AutoTrade] Entering password...');
      const passwordFilled = await this.page.evaluate((sel, val) => {
        const el = document.querySelector(sel);
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, passwordSelector, password);

      if (!passwordFilled) {
        throw new Error('Could not set password field value');
      }

      await this.sleep(1000);

      // Find the login/submit button and click it
      const buttonSelectors = [
        'button.modal-sign__block-button',
        'button[type="submit"]',
        'button.btn-login',
        'button[class*="login"]',
        'button[class*="submit"]',
      ];

      let buttonSelector = null;
      for (const sel of buttonSelectors) {
        try {
          const el = await this.page.waitForSelector(sel, { visible: true, timeout: 3000 });
          if (el) {
            buttonSelector = sel;
            console.log(`✅ [AutoTrade] Found login button with selector: ${sel}`);
            break;
          }
        } catch (e) { /* ignore and try next */ }
      }

      if (buttonSelector) {
        console.log('🖱️ [AutoTrade] Clicking login button...');
        const clicked = await this.page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }, buttonSelector);
        if (!clicked) {
          // Physical fallback click
          await this.page.click(buttonSelector);
        }
      } else {
        // Fallback: press Enter on password field
        await this.page.focus(passwordSelector);
        await this.page.keyboard.press('Enter');
        console.log('⌨️ [AutoTrade] Pressed Enter to submit login form.');
      }

      // Wait up to 20 seconds for redirect to trade page
      try {
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
      } catch (e) {
        // Navigation may not happen if captcha appears or redirect takes longer
      }

      currentUrl = this.page.url();
      console.log(`🔗 [AutoTrade] Current URL after login: ${currentUrl}`);

      if (currentUrl.includes('/trade') || currentUrl.includes('/en/trade')) {
        this.isLoggedIn = true;
        console.log('✅ [AutoTrade] Auto-login SUCCESS! Now on trading page. Ready to place trades.');
      } else {
        this.isLoggedIn = false;
        console.warn('⚠️ [AutoTrade] Auto-login may have failed (captcha or wrong credentials?).');
        console.warn('   Please complete the login manually in the Chrome window that is open.');
        // Save screenshot for debugging
        await this.page.screenshot({ path: path.join(__dirname, '..', 'login_debug.png') });
        console.warn('📸 [AutoTrade] Screenshot saved as login_debug.png for debugging.');
      }

    } catch (err) {
      console.error('❌ [AutoTrade] Login error:', err.message);
      try {
        await this.page.screenshot({ path: path.join(__dirname, '..', 'login_debug.png') });
        console.warn('📸 [AutoTrade] Error screenshot saved as login_debug.png');
      } catch (scrErr) {
        console.error('❌ [AutoTrade] Could not save error screenshot:', scrErr.message);
      }
    }
  }

  /**
   * Places a trade on Quotex based on the signal.
   */
  async placeTrade(signal) {
    if (!this.isReady || !this.page) {
      console.warn('⚠️ [AutoTrade] Cannot place trade. Browser is not ready.');
      return;
    }

    if (!this.isLoggedIn) {
      // Check if manually logged in by verifying URL
      const currentUrl = this.page.url();
      if (currentUrl.includes('/trade')) {
        this.isLoggedIn = true;
      } else {
        console.warn('⚠️ [AutoTrade] Skipping trade — not logged in yet.');
        return;
      }
    }

    try {
      console.log(`🤖 [AutoTrade] Placing trade: ${signal.asset} ${signal.type} for $${this.tradeAmount}`);

      if (signal.type.toUpperCase() === 'BUY' || signal.type.toUpperCase() === 'CALL') {
        console.log(`↗️ [AutoTrade] Executing UP (BUY) trade for ${signal.asset}`);
        // Quotex UP button selectors (update if Quotex changes their UI)
        const upSelectors = ['.buttons-block .btn-call', '.btn--green', 'button.call', '[data-action="call"]'];
        await this.clickFirstMatch(upSelectors, 'UP button');
      } else {
        console.log(`↘️ [AutoTrade] Executing DOWN (SELL) trade for ${signal.asset}`);
        const downSelectors = ['.buttons-block .btn-put', '.btn--red', 'button.put', '[data-action="put"]'];
        await this.clickFirstMatch(downSelectors, 'DOWN button');
      }

    } catch (error) {
      console.error(`❌ [AutoTrade] Trade execution failed:`, error.message);
    }
  }

  async clickFirstMatch(selectors, label) {
    for (const sel of selectors) {
      try {
        const el = await this.page.$(sel);
        if (el) {
          try {
            await el.click();
            console.log(`✅ [AutoTrade] Clicked ${label} physically (selector: ${sel})`);
            return true;
          } catch (clickErr) {
            console.warn(`⚠️ [AutoTrade] Physical click failed on ${label}, trying JS click fallback...`);
            await this.page.evaluate((s) => {
              const element = document.querySelector(s);
              if (element) element.click();
            }, sel);
            console.log(`✅ [AutoTrade] Clicked ${label} via JS (selector: ${sel})`);
            return true;
          }
        }
      } catch (e) { /* continue */ }
    }
    console.warn(`⚠️ [AutoTrade] Could not find ${label}. UI selectors may need updating.`);
    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
