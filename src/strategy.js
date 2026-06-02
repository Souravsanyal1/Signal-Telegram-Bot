const config = require('./config');

class TradingStrategy {
  constructor() {
    this.history = {};
    this.maxHistorySize = 50; // Larger history size to support MACD and ATR calculations

    const sens = config.strategy.sensitivity.toLowerCase();
    this.thresholds = {
      momentumCoeff: sens === 'high' ? 0.00005 : sens === 'low' ? 0.0002 : 0.0001,
      rsiOverbought: 70,
      rsiOversold: 30
    };
  }

  /**
   * Process price updates statefully using a Multi-Indicator Fusion Score
   */
  processPriceUpdate(asset, price, volume = 0) {
    if (!this.history[asset]) {
      this.history[asset] = [];
    }

    const ticks = this.history[asset];
    ticks.push({ price, volume, timestamp: Date.now() });

    if (ticks.length > this.maxHistorySize) {
      ticks.shift();
    }

    // Need at least 26 periods for complete MACD/EMA indicators
    if (ticks.length < 26) {
      return null;
    }

    return this.analyze(asset, ticks);
  }

  analyze(asset, ticks) {
    const currentTick = ticks[ticks.length - 1];
    const prices = ticks.map(t => t.price);
    const currentPrice = currentTick.price;

    // --- 1. Compute EMA 12 and 26 for MACD ---
    const ema12 = this.computeEMA(prices, 12);
    const ema26 = this.computeEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    // Store MACD history to compute Signal Line (9-period EMA of MACD)
    if (!this.macdHistory) this.macdHistory = {};
    if (!this.macdHistory[asset]) this.macdHistory[asset] = [];
    this.macdHistory[asset].push(macdLine);
    if (this.macdHistory[asset].length > 30) this.macdHistory[asset].shift();

    const signalLine = this.computeEMA(this.macdHistory[asset], 9);
    const macdHistogram = macdLine - signalLine;

    // --- 2. Compute Bollinger Bands ---
    const sma20 = this.computeSMA(prices, 20);
    const stdDev20 = this.computeStdDev(prices, 20, sma20);
    const upperBand = sma20 + 2.0 * stdDev20;
    const lowerBand = sma20 - 2.0 * stdDev20;

    // --- 3. Compute RSI (14) ---
    const rsi = this.computeRSI(prices, 14);

    // --- 4. Average True Range (ATR) for Premium TP/SL levels ---
    const atr = this.computeATR(ticks, 14);

    // --- 5. Stochastic Oscillator %K & %D ---
    const stoch = this.computeStochastic(prices, 14, 3);

    // --- MULTI-INDICATOR FUSION SCORE (Enhanced Accuracy) ---
    let bullishScore = 0;
    let bearishScore = 0;
    let reasons = [];
    const confidenceFactors = [];

    // Indicator A: MACD Crossover
    if (macdHistogram > 0) {
      bullishScore += 25;
      if (this.macdHistory[asset][this.macdHistory[asset].length - 2] - signalLine < 0) {
        bullishScore += 15; // Golden Crossover bonus
        reasons.push("🚀 MACD Golden Crossover detected.");
      }
    } else {
      bearishScore += 25;
      if (this.macdHistory[asset][this.macdHistory[asset].length - 2] - signalLine > 0) {
        bearishScore += 15; // Death Crossover bonus
        reasons.push("🔻 MACD Death Crossover detected.");
      }
    }

    // Indicator B: Bollinger Band Breakouts
    if (currentPrice > upperBand) {
      bullishScore += 30;
      reasons.push("📈 Price broke above Upper Bollinger Band (Volatility expansion).");
    } else if (currentPrice < lowerBand) {
      bearishScore += 30;
      reasons.push("📉 Price dropped below Lower Bollinger Band (Selling expansion).");
    }

    // Indicator C: RSI Overbought/Oversold Reversals (Enhanced)
    if (rsi !== null) {
      if (rsi < this.thresholds.rsiOversold) {
        bullishScore += 25;
        reasons.push(`🔥 RSI deeply oversold at ${rsi.toFixed(1)} - Strong Buy signal.`);
      } else if (rsi > this.thresholds.rsiOverbought) {
        bearishScore += 25;
        reasons.push(`⚠️ RSI overbought at ${rsi.toFixed(1)} - Strong Sell signal.`);
      } else if (rsi > 60 && rsi < 70) {
        bullishScore += 10;
        reasons.push(`💪 RSI momentum bullish (${rsi.toFixed(1)}).`);
      } else if (rsi < 40 && rsi > 30) {
        bearishScore += 10;
        reasons.push(`💪 RSI momentum bearish (${rsi.toFixed(1)}).`);
      }
    }

    // Indicator D: Stochastic Oscillator Reversals (Enhanced)
    if (stoch) {
      if (stoch.k < 20 && stoch.k > stoch.d) {
        bullishScore += 20;
        reasons.push(`🔄 Stochastic bullish crossover in oversold (K=${stoch.k.toFixed(1)}).`);
      } else if (stoch.k > 80 && stoch.k < stoch.d) {
        bearishScore += 20;
        reasons.push(`🔄 Stochastic bearish crossover in overbought (K=${stoch.k.toFixed(1)}).`);
      } else if (stoch.k < 50 && stoch.k > stoch.d) {
        bullishScore += 8;
      } else if (stoch.k > 50 && stoch.k < stoch.d) {
        bearishScore += 8;
      }
    }

    // --- DECISION ENGINE (Improved Accuracy) ---
    // Lower threshold for more responsive signals, but require 2+ confirmations
    const indicatorCount = reasons.length;
    const triggerThreshold = indicatorCount >= 2 ? 50 : 70; // Adjust based on consensus
    let signal = null;

    if (bullishScore >= triggerThreshold && bullishScore > bearishScore) {
      const confidence = Math.min(98, 40 + bullishScore);
      const tpPrice = currentPrice + (atr * 1.5);
      const slPrice = currentPrice - (atr * 1.2);
      
      signal = {
        asset,
        type: 'BUY',
        price: currentPrice,
        confidence,
        tp: tpPrice,
        sl: slPrice,
        expiry: confidence > 85 ? '1 MINUTE' : '5 MINUTES',
        reason: reasons.slice(0, 3).join(" | ") || "Strong bullish signal fusion."
      };
    } else if (bearishScore >= triggerThreshold && bearishScore > bullishScore) {
      const confidence = Math.min(98, 40 + bearishScore);
      const tpPrice = currentPrice - (atr * 1.5);
      const slPrice = currentPrice + (atr * 1.2);

      signal = {
        asset,
        type: 'SELL',
        price: currentPrice,
        confidence,
        tp: tpPrice,
        sl: slPrice,
        expiry: confidence > 85 ? '1 MINUTE' : '5 MINUTES',
        reason: reasons.slice(0, 3).join(" | ") || "Strong bearish signal fusion."
      };
    }

    return signal;
  }

  // --- MATHEMATICAL HELPERS ---

  computeSMA(prices, period) {
    if (prices.length < period) return 0;
    return prices.slice(-period).reduce((sum, val) => sum + val, 0) / period;
  }

  computeEMA(prices, period) {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  computeStdDev(prices, period, mean) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    return Math.sqrt(variance);
  }

  computeRSI(prices, period) {
    if (prices.length < period + 1) return null;
    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  computeATR(ticks, period) {
    if (ticks.length < period + 1) return ticks[ticks.length - 1].price * 0.0005; // Fallback
    let trs = [];
    for (let i = ticks.length - period; i < ticks.length; i++) {
      const high = ticks[i].price * 1.0001; // Approximation for High/Low
      const low = ticks[i].price * 0.9999;
      const prevClose = ticks[i - 1].price;
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trs.push(tr);
    }
    return trs.reduce((s, v) => s + v, 0) / period;
  }

  computeStochastic(prices, period, signalPeriod) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const current = prices[prices.length - 1];
    const lowest = Math.min(...slice);
    const highest = Math.max(...slice);

    if (highest === lowest) return { k: 50, d: 50 };
    const k = ((current - lowest) / (highest - lowest)) * 100;
    
    // Simplified smooth %D estimation
    return { k, d: k * 0.7 + 15 };
  }
}

module.exports = new TradingStrategy();
