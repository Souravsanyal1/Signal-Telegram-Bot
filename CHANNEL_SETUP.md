# 🤖 Bot Channel Setup Guide

## ✅ Requirements

Your bot **MUST** be an **ADMIN** in the Telegram channel to work properly.

---

## 📋 Steps to Set Up Bot Admin in Channel

### 1. **Add Bot to Your Channel**
   - Open your Telegram Channel
   - Go to **Channel Settings** → **Members**
   - Click **Add Member** or **Invite Link**
   - Search for: `@free_Signal_v1_bot`
   - Select and add the bot

### 2. **Make Bot an ADMIN**
   - Go to **Channel Settings** → **Administrators**
   - Click **Add Admin**
   - Search for: `@free_Signal_v1_bot`
   - Select the bot

### 3. **Grant Bot Permissions** (Select these permissions)
   - ✅ **Post Messages** - Send trading signals
   - ✅ **Edit Messages** - Update signal details if needed
   - ✅ **Delete Messages** - Remove old signals (optional)
   - ✅ **Pin Messages** - Pin important announcements (optional)

### 4. **Verify Setup in Terminal**
When you start the bot (`npm start`), you should see:

```
✅ [Bot Admin Check] Bot HAS ADMIN RIGHTS in channel -1003749201190
   • can_post_messages: true
   • can_edit_messages: true
   • can_delete_messages: true
   • can_pin_messages: true
```

If you see an **error** instead, the bot doesn't have admin rights yet. Go back and repeat steps 1-3.

---

## 🎯 How Bot Works

### **Signal Broadcasting** (Main Function)
- Bot sends **trading signals** ONLY to the channel (not DMs)
- Signals appear every time a BUY/SELL opportunity is detected
- Works 24/7 in production mode

### **Admin Commands in Channel** (Development Only)
Commands only work when sent **IN THE CHANNEL** (not in private DMs):

```
/start          - Show VIP welcome message
/addpaid [ID]   - Add user to paid subscribers
/removepaid [ID] - Remove user
/listpaid       - View all paid users
/panel          - Open control panel
```

---

## ⚠️ Troubleshooting

### ❌ "Bot is MEMBER (not admin) in channel"
**Solution**: Make the bot an ADMIN with full permissions (see step 3 above)

### ❌ "Bot is NOT IN channel"
**Solution**: Add the bot to the channel first (see step 1 above)

### ❌ Commands not working
**Solutions**:
1. Make sure you're sending commands **IN THE CHANNEL**, not in DMs
2. Verify TELEGRAM_CHAT_ID is correct in `.env` file
3. Restart bot: `npm start`

### ❌ Signals not appearing
**Check**:
1. Bot is admin in channel ✓
2. TELEGRAM_CHAT_ID is correct in `.env` ✓
3. TELEGRAM_BOT_TOKEN is correct ✓
4. Bot has "Post Messages" permission ✓

---

## 📱 Environment Setup

Make sure `.env` has:
```env
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=-1003749201190
NODE_ENV=development
SIMULATE_MARKET=true
```

---

## 🚀 Production Deployment (Render)

When deployed to Render.com:
- Bot runs in **signal-only mode** (no command listening)
- Signals automatically post to your channel
- No admin commands needed in production

---

## 📞 Support

If bot admin check fails:
1. Check bot is in channel: Open channel → Members → Search `@free_Signal_v1_bot`
2. Check bot is admin: Open channel → Admins → Should list bot
3. Check permissions: Bot admin settings should have all boxes checked
4. Check TELEGRAM_CHAT_ID: Should start with `-100` or `-` (negative for channels)

---

**Bot Name**: `@free_Signal_v1_bot`  
**Channel ID**: Check your `.env` file for `TELEGRAM_CHAT_ID`
