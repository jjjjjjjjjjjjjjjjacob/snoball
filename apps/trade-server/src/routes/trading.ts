import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getAuthContext, requireOrganization } from '../middleware/auth';
import { PDTTracker } from '@snoball/trading-core';
import type { Order, TradingConfig } from '@snoball/shared-types';

export const tradingRoutes = new Hono();

// Order schemas
const CreateOrderSchema = z.object({
  symbol: z.string().min(1).max(10),
  quantity: z.number().positive(),
  side: z.enum(['buy', 'sell']),
  orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
});

const TradingConfigSchema = z.object({
  mode: z.enum(['pdt_safe', 'pdt_unsafe', 'long_term']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  confidenceThreshold: z.number().min(0).max(1),
  maxPositionSize: z.number().positive(),
  stopLossPercentage: z.number().min(0).max(100),
  takeProfitPercentage: z.number().min(0).max(100),
  tradeOptions: z.boolean(),
  tradeStocks: z.boolean(),
});

// Get portfolio summary
tradingRoutes.get('/portfolio', async (c) => {
  const auth = getAuthContext(c);
  
  try {
    // TODO: Implement portfolio fetching from Alpaca
    // This would involve:
    // 1. Get user's Alpaca API keys from database
    // 2. Initialize Alpaca client
    // 3. Fetch account info and positions
    // 4. Calculate PDT count from recent day trades
    
    const portfolioSummary = {
      totalValue: 10000.00,
      dayChange: 150.50,
      dayChangePercent: 1.53,
      positions: [],
      pdtCount: 0,
      buyingPower: 5000.00,
    };

    return c.json({ success: true, data: portfolioSummary });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    return c.json({ error: 'Failed to fetch portfolio' }, 500);
  }
});

// Place a new order
tradingRoutes.post('/orders', zValidator('json', CreateOrderSchema), async (c) => {
  const auth = getAuthContext(c);
  const orderData = c.req.valid('json');

  try {
    // PDT compliance check
    const pdtTracker = new PDTTracker(10000); // TODO: Get actual account value
    
    if (orderData.side === 'sell') {
      // Check if this would create a day trade
      const wouldBeDayTrade = true; // TODO: Implement actual check
      
      if (wouldBeDayTrade && !pdtTracker.canDayTrade()) {
        return c.json({ 
          error: 'PDT limit reached',
          message: `You have reached your day trading limit. Next trade available: ${pdtTracker.getNextTradeDate()}`,
        }, 400);
      }
    }

    // TODO: Implement order placement with Alpaca
    // This would involve:
    // 1. Get user's Alpaca API keys from database
    // 2. Initialize Alpaca client with user's keys
    // 3. Place order through Alpaca API
    // 4. Store order in database
    // 5. Track day trades if applicable

    const mockOrder: Order = {
      id: crypto.randomUUID(),
      userId: auth.user!.id,
      symbol: orderData.symbol,
      quantity: orderData.quantity,
      side: orderData.side,
      orderType: orderData.orderType,
      status: 'pending',
      createdAt: new Date(),
    };

    return c.json({ success: true, data: mockOrder });
  } catch (error) {
    console.error('Order placement error:', error);
    return c.json({ error: 'Failed to place order' }, 500);
  }
});

// Get order history
tradingRoutes.get('/orders', async (c) => {
  const auth = getAuthContext(c);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');

  try {
    // TODO: Implement order history fetching from database
    const orders: Order[] = [];

    return c.json({ 
      success: true, 
      data: orders,
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0,
      },
    });
  } catch (error) {
    console.error('Order history fetch error:', error);
    return c.json({ error: 'Failed to fetch order history' }, 500);
  }
});

// Get trading configuration
tradingRoutes.get('/config', async (c) => {
  const auth = getAuthContext(c);

  try {
    // TODO: Fetch trading config from database
    const config: TradingConfig = {
      id: crypto.randomUUID(),
      userId: auth.user!.id,
      mode: 'pdt_safe',
      riskLevel: 'low',
      confidenceThreshold: 0.7,
      maxPositionSize: 1000,
      stopLossPercentage: 5,
      takeProfitPercentage: 10,
      tradeOptions: false,
      tradeStocks: true,
      updatedAt: new Date(),
    };

    return c.json({ success: true, data: config });
  } catch (error) {
    console.error('Config fetch error:', error);
    return c.json({ error: 'Failed to fetch trading configuration' }, 500);
  }
});

// Update trading configuration
tradingRoutes.put('/config', zValidator('json', TradingConfigSchema), async (c) => {
  const auth = getAuthContext(c);
  const configData = c.req.valid('json');

  try {
    // TODO: Update trading config in database
    const updatedConfig: TradingConfig = {
      id: crypto.randomUUID(),
      userId: auth.user!.id,
      ...configData,
      updatedAt: new Date(),
    };

    return c.json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error('Config update error:', error);
    return c.json({ error: 'Failed to update trading configuration' }, 500);
  }
});

// Get PDT status
tradingRoutes.get('/pdt-status', async (c) => {
  const auth = getAuthContext(c);

  try {
    // TODO: Get actual account value and day trade count from database
    const accountValue = 10000; // Mock value
    const dayTradeCount = 0; // Mock value
    
    const pdtTracker = new PDTTracker(accountValue);
    
    return c.json({ 
      success: true, 
      data: {
        accountValue,
        dayTradeCount,
        canDayTrade: pdtTracker.canDayTrade(),
        isPdtAccount: accountValue >= 25000,
        nextTradeDate: pdtTracker.getNextTradeDate(),
        remainingTrades: Math.max(0, 3 - dayTradeCount),
      },
    });
  } catch (error) {
    console.error('PDT status error:', error);
    return c.json({ error: 'Failed to fetch PDT status' }, 500);
  }
});