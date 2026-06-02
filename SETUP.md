# Setup Guide for Trading Signal Bot

## 📋 Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v7 or higher
- **Telegram Bot Token**: Get from [@BotFather](https://t.me/botfather) on Telegram
- **Docker** (optional, for containerized deployment)

---

## 🚀 Local Development Setup

### 1. Clone/Setup Project
```bash
cd c:\Users\Sourav sanyal\OneDrive\Desktop\Tread
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
# Required:
# - TELEGRAM_BOT_TOKEN: Get from @BotFather on Telegram
# - TELEGRAM_CHAT_ID: Your Telegram channel or group ID
# - WS_URL: WebSocket URL (default is provided)
```

### 4. Run Locally

**Development mode** (with simulation):
```bash
npm run simulate
```

**Production mode**:
```bash
npm start
```

**Watch for changes** (if you want auto-restart):
```bash
npm install -g nodemon
nodemon src/index.js
```

### 5. Test the Bot
- Send a message to your Telegram bot
- Check if it's responding
- Monitor console for signal logs

---

## 🐳 Docker Setup (for local testing)

### 1. Build Docker Image
```bash
docker build -t trading-signal-bot .
```

### 2. Run Container Locally
```bash
docker run -it \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e TELEGRAM_CHAT_ID=your_chat_id \
  -e PORT=3000 \
  -p 3000:3000 \
  trading-signal-bot
```

---

## 🌍 Deployment to Render.com

### Step 1: Prepare Your Repository
1. Initialize git if not already done:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Trading Signal Bot"
   ```

2. Push to GitHub/GitLab/Gitea:
   ```bash
   git remote add origin https://your-repo-url.git
   git push -u origin main
   ```

### Step 2: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub/GitLab account

### Step 3: Deploy Service
1. Click **New +** → **Web Service**
2. Connect your repository
3. Configure:
   - **Name**: `trading-signal-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Plan**: Starter (free tier) or higher

### Step 4: Add Environment Variables
In Render dashboard, go to **Environment** and add:
- `TELEGRAM_BOT_TOKEN` (from @BotFather)
- `TELEGRAM_CHAT_ID` (your chat/channel ID)
- `NODE_ENV` = `production`
- `PORT` = `3000`
- `SENSITIVITY` = `medium`
- Other variables from `.env.example`

### Step 5: Deploy
Click **Create Web Service** and Render will automatically deploy your bot!

---

## ✅ Verification Checklist

- [ ] `.env` file created with valid credentials
- [ ] `npm install` completed successfully
- [ ] `npm start` runs without errors
- [ ] Telegram bot responds to messages
- [ ] Signals are being logged to console
- [ ] Docker image builds successfully (optional)
- [ ] Environment variables are set in Render

---

## 🔍 Troubleshooting

### Bot not responding
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is running: `npm start`
- Check console for error messages

### WebSocket connection issues
- Ensure `WS_URL` is correct
- Check network connectivity
- Try simulation mode first: `npm run simulate`

### Port already in use
```bash
# Change PORT in .env or:
set PORT=3001
npm start
```

### Render deployment fails
- Check build logs in Render dashboard
- Ensure `package.json` has correct `node` engine version
- Verify all environment variables are set

---

## 📚 Additional Resources

- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- [Render Documentation](https://render.com/docs)
- [Node.js Documentation](https://nodejs.org/docs/)

---

## 🆘 Need Help?

Check the logs:
```bash
# Local development
npm start

# Render deployment
# View in Render dashboard under "Logs"
```
