# Telegram Real-Time Trading Signal Bot

Production-ready real-time financial trading signal bot that hooks to standard Quotex WebSocket / Socket.io price feeds and blasts signals immediately into Telegram channels.

## 🚀 Features

- **Socket.io Core**: Connects to `EIO=3` WebSocket endpoints with smart auto-reconnect.
- **Stateful Signal Analytics**: Ingests price arrays and performs technical analysis in real time (Bollinger Bands, fast/slow SMA crossovers, RSI boundaries, and volume spikes).
- **Premium Telegram Dispatcher**: Dispatches formatted messages with custom confidence scales.
- **Double-Layer Safety Controls**: Built-in duplicate signal suppression and per-asset cooldown timers to prevent channel spamming.
- **Aesthetic Simulator Mode**: Runs out-of-the-box with a high-fidelity market quote simulation engine for manual testing.

---

## 🛠️ Project Structure

```text
/src
  ├── config.js       - Configurations (dotenv, asset list, thresholds)
  ├── websocket.js    - Socket.io client wrapper & market simulator
  ├── strategy.js     - Mathematical indicator processor & signal triggers
  ├── telegram.js     - Telegram Bot API driver & cooldown managers
  └── index.js        - Bootstrap initializer
package.json          - Module list
.env                  - Credentials
```

---

## 🔧 Installation & Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org) (v16.0.0 or higher recommended)

### 2. Install dependencies
In the root directory of the project, run:
```bash
npm install
```

### 3. Setup Credentials
Open `.env` in the root directory and configure:
```ini
TELEGRAM_BOT_TOKEN=8803839815:AAGfidU7NFmAIgQb5OK7H7QRoC85ZM0SGQM
TELEGRAM_CHAT_ID=-100xxxxxxxxxx  # Your target Telegram channel or group chat ID
WS_URL=wss://ws2.market-qx.trade/socket.io/?EIO=3&transport=websocket
SIMULATE_MARKET=true             # Set to false to connect to the live Quotex WS server
```

---

## 🏎️ Running the Bot

### Run in Simulated Sandbox Mode (Recommended for testing)
To test the bot, strategies, and Telegram delivery instantly without connecting to live Quotex WebSockets:
```bash
npm run simulate
```
This starts generating mock asset feeds (EUR/USD, GBP/USD, etc.) and posts notifications directly to your Telegram chat when breakout strategies are triggered!

### Run in Live Production Mode
Ensure `SIMULATE_MARKET=false` in your `.env` or run:
```bash
npm run start
```
This subscribes to the live Quotex events (`quotes/stream` and `depth/change`) and acts on live market changes immediately.
