export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionContract {
  strike: number;
  underlying: number;
  expiry: Date;
  volatility: number;
  riskFreeRate: number;
  isCall: boolean;
}

export class TradingCalculator {
  private static readonly TRADING_DAYS_PER_YEAR = 252;
  
  static calculateSharpeRatio(returns: number[], riskFreeRate = 0.02): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const excessReturns = returns.map(r => r - riskFreeRate / this.TRADING_DAYS_PER_YEAR);
    const stdDev = this.standardDeviation(excessReturns);
    
    if (stdDev === 0) return 0;
    
    return (meanReturn - riskFreeRate / this.TRADING_DAYS_PER_YEAR) / stdDev * Math.sqrt(this.TRADING_DAYS_PER_YEAR);
  }
  
  static calculatePositionSize(
    accountValue: number,
    riskPercentage: number,
    entryPrice: number,
    stopLossPrice: number
  ): number {
    const riskAmount = accountValue * (riskPercentage / 100);
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);
    
    if (riskPerShare === 0) return 0;
    
    return Math.floor(riskAmount / riskPerShare);
  }
  
  static calculateRiskRewardRatio(
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number
  ): number {
    const risk = Math.abs(entryPrice - stopLossPrice);
    const reward = Math.abs(takeProfitPrice - entryPrice);
    
    if (risk === 0) return 0;
    
    return reward / risk;
  }
  
  static calculateMovingAverage(prices: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    
    return result;
  }
  
  static calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50; // Neutral RSI
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  static calculateBollingerBands(
    prices: number[],
    period = 20,
    stdDevMultiplier = 2
  ): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = this.calculateMovingAverage(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const stdDev = this.standardDeviation(slice);
      const ma = middle[i - period + 1];
      
      upper.push(ma + stdDev * stdDevMultiplier);
      lower.push(ma - stdDev * stdDevMultiplier);
    }
    
    return { upper, middle, lower };
  }
  
  static calculateMACD(
    prices: number[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
  ): { macd: number[]; signal: number[]; histogram: number[] } {
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    
    const macd: number[] = [];
    for (let i = 0; i < Math.min(emaFast.length, emaSlow.length); i++) {
      macd.push(emaFast[i] - emaSlow[i]);
    }
    
    const signal = this.calculateEMA(macd, signalPeriod);
    const histogram: number[] = [];
    
    for (let i = 0; i < Math.min(macd.length, signal.length); i++) {
      histogram.push(macd[i] - signal[i]);
    }
    
    return { macd, signal, histogram };
  }
  
  private static calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];
    
    const multiplier = 2 / (period + 1);
    const ema: number[] = [];
    
    // Start with SMA
    const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(sma);
    
    // Calculate EMA
    for (let i = period; i < prices.length; i++) {
      const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(value);
    }
    
    return ema;
  }
  
  private static standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }
}