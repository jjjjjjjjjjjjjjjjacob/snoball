import type { Order, DayTrade } from '@snoball/shared-types';

export class PDTTracker {
  private dayTrades: Map<string, DayTrade[]> = new Map();
  private accountValue: number;
  private readonly PDT_LIMIT = 3;
  private readonly PDT_THRESHOLD = 25000;
  
  constructor(accountValue: number) {
    this.accountValue = accountValue;
  }
  
  updateAccountValue(value: number): void {
    this.accountValue = value;
  }
  
  isPatternDayTrader(): boolean {
    return this.accountValue >= this.PDT_THRESHOLD;
  }
  
  canDayTrade(): boolean {
    if (this.isPatternDayTrader()) {
      return true;
    }
    return this.getDayTradeCount() < this.PDT_LIMIT;
  }
  
  getDayTradeCount(): number {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    let count = 0;
    for (const [_, trades] of this.dayTrades) {
      count += trades.filter(trade => trade.tradeDate >= fiveDaysAgo).length;
    }
    return count;
  }
  
  addOrder(order: Partial<Order>): boolean {
    // Simplified day trade detection
    // In production, this would need more complex logic
    const today = new Date().toISOString().split('T')[0];
    const userTrades = this.dayTrades.get(today) || [];
    
    // Check if this completes a day trade
    const oppositeOrder = userTrades.find(
      t => t.symbol === order.symbol
    );
    
    if (oppositeOrder && order.side !== oppositeOrder.side) {
      // This would complete a day trade
      if (!this.canDayTrade()) {
        return false; // Block the trade
      }
      
      // Record the day trade
      const dayTrade: DayTrade = {
        id: crypto.randomUUID(),
        userId: order.userId!,
        symbol: order.symbol!,
        buyOrderId: order.side === 'buy' ? order.id! : oppositeOrder.buyOrderId,
        sellOrderId: order.side === 'sell' ? order.id! : oppositeOrder.sellOrderId,
        tradeDate: new Date(),
        createdAt: new Date(),
      };
      
      userTrades.push(dayTrade);
      this.dayTrades.set(today, userTrades);
    }
    
    return true;
  }
  
  getRemainingDayTrades(): number {
    if (this.isPatternDayTrader()) {
      return Infinity;
    }
    return Math.max(0, this.PDT_LIMIT - this.getDayTradeCount());
  }
  
  getNextTradeDate(): Date | null {
    if (this.isPatternDayTrader() || this.getDayTradeCount() < this.PDT_LIMIT) {
      return null;
    }
    
    // Find the oldest day trade in the 5-day window
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    let oldestTrade: DayTrade | null = null;
    for (const [_, trades] of this.dayTrades) {
      for (const trade of trades) {
        if (trade.tradeDate >= fiveDaysAgo) {
          if (!oldestTrade || trade.tradeDate < oldestTrade.tradeDate) {
            oldestTrade = trade;
          }
        }
      }
    }
    
    if (oldestTrade) {
      const nextDate = new Date(oldestTrade.tradeDate);
      nextDate.setDate(nextDate.getDate() + 5);
      return nextDate;
    }
    
    return null;
  }
  
  // Test helper
  addDayTrade(): void {
    const today = new Date().toISOString().split('T')[0];
    const trades = this.dayTrades.get(today) || [];
    trades.push({
      id: crypto.randomUUID(),
      userId: 'test',
      symbol: 'TEST',
      buyOrderId: crypto.randomUUID(),
      sellOrderId: crypto.randomUUID(),
      tradeDate: new Date(),
      createdAt: new Date(),
    });
    this.dayTrades.set(today, trades);
  }
}