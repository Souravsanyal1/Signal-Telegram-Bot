const config = require('./config');

class TradingStrategy {
  constructor() {
    this.history = {};
    this.maxHistorySize = 30; // Shorter window for faster execution speed

    const sens = config.strategy.sensitivity.toLowerCase();
    this.thresholds = {
      // Extremely low thresholds for high frequency velocity breakout
      momentumCoeff: sens === 'high' ? 0.00005 : sens === 'low' ? 0.0002 : 0.0001, 
      rsiOverbought: 65,
      rsiOversold: 35,
      volumeMultiplier: sens === 'high' ? 1.1 : sens === 'low' ? 1.8 : 1.3
    };
  }

  /**
   * Add a price tick and analyze it immediately (optimized for extreme speed)
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

    // Need only 5 ticks for technical calculation to trigger instant signals
    if (ticks.length < 5) {
      return null;
    }

    return this.analyze(asset, ticks);
  }

  analyze(asset, ticks) {
    const currentTick = ticks[ticks.length - 1];
    const prevTick = ticks[ticks.length - 2];
    const prices = ticks.map(t => t.price);
    const volumes = ticks.map(t => t.volume).filter(v => v > 0);

    const currentPrice = currentTick.price;

    // Fast moving calculations for rapid signal emission
    const smaFast = this.computeSMA(prices, 2);
    const smaSlow = this.computeSMA(prices, 5);

    const rsi = this.computeRSI(prices, 4); // Fast RSI

    const priceChangePct = (currentPrice - prevTick.price) / prevTick.price;
    const velocity = (currentPrice - prices[prices.length - 3]) / prices[prices.length - 3]; // 3 ticks velocity

    // Tightened Bollinger Bands for immediate breakouts
    const mean = this.computeSMA(prices, 5);
    const stdDev = this.computeStdDev(prices, 5, mean);
    const upperBand = mean + 1.2 * stdDev; // 1.2 standard deviation instead of 2.0 (triggers faster)
    const lowerBand = mean - 1.2 * stdDev;

    let isVolumeSpike = false;
    if (currentTick.volume > 0 && volumes.length > 2) {
      const avgVolume = volumes.slice(-5, -1).reduce((s, v) => s + v, 0) / (volumes.slice(-5, -1).length || 1);
      if (currentTick.volume > avgVolume * this.thresholds.volumeMultiplier) {
        isVolumeSpike = true;
      }
    }

    // A. Fast Bullish Breakout
    if (currentPrice > upperBand && velocity > this.thresholds.momentumCoeff) {
      const confidence = Math.min(98, Math.round(80 + (velocity / this.thresholds.momentumCoeff) * 5));
      return {
        asset,
        type: 'BUY',
        price: currentPrice,
        confidence,
        reason: `Fast Bullish Breakout: Price crossed above Bollinger Upper Band with sharp upward momentum.`
      };
    }

    // B. Fast Bearish Breakout
    if (currentPrice < lowerBand && velocity < -this.thresholds.momentumCoeff) {
      const confidence = Math.min(98, Math.round(80 + (Math.abs(velocity) / this.thresholds.momentumCoeff) * 5));
      return {
        asset,
        type: 'SELL',
        price: currentPrice,
        confidence,
        reason: `Fast Bearish Breakout: Price dropped below Bollinger Lower Band with high velocity.`
      };
    }

    // C. Ultra-Responsive Reversal
    if (rsi !== null) {
      if (rsi < this.thresholds.rsiOversold && priceChangePct > 0.00005) {
        return {
          asset,
          type: 'BUY',
          price: currentPrice,
          confidence: 85,
          reason: `Fast Reversal: Oversold bottom reversal (RSI: ${rsi.toFixed(0)}) identified.`
        };
      }
      if (rsi > this.thresholds.rsiOverbought && priceChangePct < -0.00005) {
        return {
          asset,
          type: 'SELL',
          price: currentPrice,
          confidence: 84,
          reason: `Fast Reversal: Overbought peak rejection (RSI: ${rsi.toFixed(0)}) identified.`
        };
      }
    }

    // D. Low Threshold Volume Spike
    if (isVolumeSpike && Math.abs(priceChangePct) > this.thresholds.momentumCoeff) {
      const type = priceChangePct > 0 ? 'BUY' : 'SELL';
      return {
        asset,
        type,
        price: currentPrice,
        confidence: 87,
        reason: `Micro volume spike detected with momentum shift.`
      };
    }

    return null;
  }

  computeSMA(prices, period) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
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
}

module.exports = new TradingStrategy();
