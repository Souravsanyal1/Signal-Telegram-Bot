const express = require('express');
const cors = require('cors');
const path = require('path');
const telegram = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse large payloads (needed for base64 screenshots)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static payment frontend files
app.use(express.static(path.join(__dirname, '..', 'payment')));

// Submit Payment endpoint
app.post('/api/submit-payment', async (req, res) => {
  try {
    const { telegramId, txnId, gateway, plan, screenshot } = req.body;

    if (!telegramId || !txnId || !gateway || !plan) {
      return res.status(400).json({ success: false, error: 'Missing required payment details' });
    }

    console.log(`📥 Received payment submission for Telegram ID: ${telegramId}, Gateway: ${gateway}, Plan: ${plan}`);

    // Create the message to send to Admin
    const adminMessage = `👑 <b>NEW VIP SUBSCRIPTION SUBMISSION</b> 👑\n\n` +
                         `👤 <b>Telegram User ID:</b> <code>${telegramId}</code>\n` +
                         `💎 <b>Selected Plan:</b> <code>${plan}</code>\n` +
                         `💳 <b>Payment Gateway:</b> <code>${gateway.toUpperCase()}</code>\n` +
                         `🧾 <b>Transaction ID:</b> <code>${txnId}</code>\n\n` +
                         `Please verify this transaction ID and approve/reject below.`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Approve Subscription', callback_data: `approve_pay_${telegramId}_${plan.replace(/\s+/g, '_')}` },
          { text: '❌ Reject Submission', callback_data: `reject_pay_${telegramId}` }
        ]
      ]
    };

    if (screenshot) {
      try {
        // Extract base64 image data
        const matches = screenshot.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        let imageBuffer;
        if (matches && matches.length === 3) {
          imageBuffer = Buffer.from(matches[2], 'base64');
        } else {
          imageBuffer = Buffer.from(screenshot, 'base64');
        }

        // Send photo with description to admin
        await telegram.bot.sendPhoto(telegram.adminId, imageBuffer, {
          caption: adminMessage,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        });
      } catch (err) {
        console.error('⚠️ Failed to send screenshot photo, falling back to text:', err.message);
        // Fallback to text if image sending failed
        await telegram.bot.sendMessage(telegram.adminId, adminMessage + '\n\n⚠️ <i>(Screenshot upload failed to send to admin)</i>', {
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        });
      }
    } else {
      // Send text message if no screenshot
      await telegram.bot.sendMessage(telegram.adminId, adminMessage + '\n\n⚠️ <i>No Screenshot Provided</i>', {
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
    }

    res.status(200).json({ success: true, message: 'Payment details successfully forwarded to admin' });
  } catch (error) {
    console.error('❌ Error handling payment submission:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 [Server] Payment server and API listening on port ${PORT}`);
    console.log(`👉 Static files served from: ${path.join(__dirname, '..', 'payment')}`);
  });
}

module.exports = {
  startServer
};
