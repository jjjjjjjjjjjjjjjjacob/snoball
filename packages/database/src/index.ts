import postgres from 'postgres';
import type { User, ApiKey, TradingConfig, Order, DayTrade, MarketData, AnalysisCache } from '@snoball/shared-types';
import { getDatabaseConfig, validateDatabaseConfig, logDatabaseConfig } from './config.js';

// Database connection configuration
interface DatabaseConfig {
  url?: string;
  pooled?: boolean;
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
}

class Database {
  private sql: postgres.Sql;
  private pooledSql?: postgres.Sql;

  constructor(config: DatabaseConfig = {}) {
    // Get database configuration from environment variables
    const dbConfig = getDatabaseConfig();
    
    // Use provided URL or fall back to environment-based configuration
    const mainUrl = config.url || dbConfig.url;
    const pooledUrl = dbConfig.pooledUrl;
    
    // Log configuration in development
    if (process.env.NODE_ENV === 'development') {
      logDatabaseConfig();
    }
    
    // Main connection (direct to Postgres)
    this.sql = postgres(mainUrl, {
      max: config.max || 10,
      idle_timeout: config.idle_timeout || 20,
      connect_timeout: config.connect_timeout || 15,
      ssl: mainUrl.includes('sslmode=require') ? 'require' : 
           mainUrl.includes('sslmode=') ? false : 
           mainUrl.includes('ssl=require') ? 'require' : false,
    });

    // Pooled connection via PgBouncer for serverless functions
    if ((config.pooled !== false) && pooledUrl) {
      this.pooledSql = postgres(pooledUrl, {
        max: config.max || 1,
        idle_timeout: config.idle_timeout || 0,
        connect_timeout: config.connect_timeout || 5,
        ssl: pooledUrl.includes('sslmode=require') ? 'require' : 
             pooledUrl.includes('sslmode=') ? false : 
             pooledUrl.includes('ssl=require') ? 'require' : false,
      });
    }
  }

  // Get appropriate connection based on context
  private getConnection(usePooled = false): postgres.Sql {
    return (usePooled && this.pooledSql) ? this.pooledSql : this.sql;
  }

  // User management
  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>, usePooled = true): Promise<User> {
    const sql = this.getConnection(usePooled);
    const [newUser] = await sql`
      INSERT INTO users (
        email, first_name, last_name, organization_id, role, provider, provider_user_id
      ) VALUES (
        ${user.email}, ${user.first_name}, ${user.last_name}, 
        ${user.organization_id}, ${user.role}, ${user.provider}, ${user.provider_user_id}
      ) RETURNING *
    `;
    return newUser as User;
  }

  async getUserById(id: string, usePooled = true): Promise<User | null> {
    const sql = this.getConnection(usePooled);
    const [user] = await sql`
      SELECT * FROM users WHERE id = ${id}
    `;
    return user as User | null;
  }

  async getUserByEmail(email: string, usePooled = true): Promise<User | null> {
    const sql = this.getConnection(usePooled);
    const [user] = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;
    return user as User | null;
  }

  async updateUser(id: string, updates: Partial<User>, usePooled = true): Promise<User> {
    const sql = this.getConnection(usePooled);
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => `${key} = $${key}`)
      .join(', ');
    
    const [updatedUser] = await sql`
      UPDATE users SET ${sql.unsafe(setClause)}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return updatedUser as User;
  }

  // API key management (encrypted storage)
  async storeApiKey(apiKey: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>, usePooled = true): Promise<ApiKey> {
    const sql = this.getConnection(usePooled);
    const [newKey] = await sql`
      INSERT INTO api_keys (
        user_id, provider, encrypted_key, key_name, is_active, expires_at
      ) VALUES (
        ${apiKey.user_id}, ${apiKey.provider}, ${apiKey.encrypted_key},
        ${apiKey.key_name}, ${apiKey.is_active}, ${apiKey.expires_at}
      ) RETURNING *
    `;
    return newKey as ApiKey;
  }

  async getApiKeys(userId: string, provider?: string, usePooled = true): Promise<ApiKey[]> {
    const sql = this.getConnection(usePooled);
    const keys = provider 
      ? await sql`
          SELECT * FROM api_keys 
          WHERE user_id = ${userId} AND provider = ${provider} AND is_active = true
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM api_keys 
          WHERE user_id = ${userId} AND is_active = true
          ORDER BY created_at DESC
        `;
    return keys as ApiKey[];
  }

  async revokeApiKey(keyId: string, usePooled = true): Promise<void> {
    const sql = this.getConnection(usePooled);
    await sql`
      UPDATE api_keys 
      SET is_active = false, updated_at = NOW()
      WHERE id = ${keyId}
    `;
  }

  // Trading configuration
  async saveTradingConfig(config: Omit<TradingConfig, 'id' | 'created_at' | 'updated_at'>, usePooled = true): Promise<TradingConfig> {
    const sql = this.getConnection(usePooled);
    const [newConfig] = await sql`
      INSERT INTO trading_configs (
        user_id, account_value, risk_level, max_position_size, 
        stop_loss_percentage, take_profit_percentage, pdt_enabled,
        allowed_symbols, trading_hours
      ) VALUES (
        ${config.user_id}, ${config.account_value}, ${config.risk_level},
        ${config.max_position_size}, ${config.stop_loss_percentage},
        ${config.take_profit_percentage}, ${config.pdt_enabled},
        ${JSON.stringify(config.allowed_symbols)}, ${JSON.stringify(config.trading_hours)}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        account_value = EXCLUDED.account_value,
        risk_level = EXCLUDED.risk_level,
        max_position_size = EXCLUDED.max_position_size,
        stop_loss_percentage = EXCLUDED.stop_loss_percentage,
        take_profit_percentage = EXCLUDED.take_profit_percentage,
        pdt_enabled = EXCLUDED.pdt_enabled,
        allowed_symbols = EXCLUDED.allowed_symbols,
        trading_hours = EXCLUDED.trading_hours,
        updated_at = NOW()
      RETURNING *
    `;
    return newConfig as TradingConfig;
  }

  async getTradingConfig(userId: string, usePooled = true): Promise<TradingConfig | null> {
    const sql = this.getConnection(usePooled);
    const [config] = await sql`
      SELECT * FROM trading_configs WHERE user_id = ${userId}
    `;
    return config as TradingConfig | null;
  }

  // Order management
  async saveOrder(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>, usePooled = false): Promise<Order> {
    // Use direct connection for orders (transaction consistency important)
    const sql = this.getConnection(false);
    const [newOrder] = await sql`
      INSERT INTO orders (
        user_id, symbol, side, quantity, order_type, status,
        limit_price, stop_price, time_in_force, alpaca_order_id,
        confidence_score, signal_source, executed_at, filled_quantity,
        average_fill_price, commission, pdt_flagged
      ) VALUES (
        ${order.user_id}, ${order.symbol}, ${order.side}, ${order.quantity},
        ${order.order_type}, ${order.status}, ${order.limit_price},
        ${order.stop_price}, ${order.time_in_force}, ${order.alpaca_order_id},
        ${order.confidence_score}, ${order.signal_source}, ${order.executed_at},
        ${order.filled_quantity}, ${order.average_fill_price}, ${order.commission},
        ${order.pdt_flagged}
      ) RETURNING *
    `;
    return newOrder as Order;
  }

  async updateOrderStatus(orderId: string, updates: Partial<Order>, usePooled = false): Promise<Order> {
    const sql = this.getConnection(false);
    const [updatedOrder] = await sql`
      UPDATE orders SET
        status = COALESCE(${updates.status}, status),
        filled_quantity = COALESCE(${updates.filled_quantity}, filled_quantity),
        average_fill_price = COALESCE(${updates.average_fill_price}, average_fill_price),
        executed_at = COALESCE(${updates.executed_at}, executed_at),
        commission = COALESCE(${updates.commission}, commission),
        updated_at = NOW()
      WHERE id = ${orderId}
      RETURNING *
    `;
    return updatedOrder as Order;
  }

  async getOrders(userId: string, limit = 50, usePooled = true): Promise<Order[]> {
    const sql = this.getConnection(usePooled);
    const orders = await sql`
      SELECT * FROM orders 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return orders as Order[];
  }

  // PDT tracking
  async addDayTrade(dayTrade: Omit<DayTrade, 'id' | 'created_at'>, usePooled = false): Promise<DayTrade> {
    const sql = this.getConnection(false);
    const [newDayTrade] = await sql`
      INSERT INTO day_trades (
        user_id, symbol, buy_order_id, sell_order_id, 
        quantity, profit_loss, trade_date
      ) VALUES (
        ${dayTrade.user_id}, ${dayTrade.symbol}, ${dayTrade.buy_order_id},
        ${dayTrade.sell_order_id}, ${dayTrade.quantity}, ${dayTrade.profit_loss},
        ${dayTrade.trade_date}
      ) RETURNING *
    `;
    return newDayTrade as DayTrade;
  }

  async getDayTrades(userId: string, fromDate: Date, toDate: Date, usePooled = true): Promise<DayTrade[]> {
    const sql = this.getConnection(usePooled);
    const dayTrades = await sql`
      SELECT * FROM day_trades 
      WHERE user_id = ${userId} 
        AND trade_date >= ${fromDate}
        AND trade_date <= ${toDate}
      ORDER BY trade_date DESC
    `;
    return dayTrades as DayTrade[];
  }

  // Market data (high-volume, use pooled connection)
  async saveMarketData(data: MarketData[], usePooled = true): Promise<void> {
    const sql = this.getConnection(usePooled);
    if (data.length === 0) return;

    await sql`
      INSERT INTO market_data ${sql(data, 'symbol', 'timestamp', 'open', 'high', 'low', 'close', 'volume')}
      ON CONFLICT (symbol, timestamp) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume
    `;
  }

  async getMarketData(symbol: string, fromDate: Date, toDate: Date, usePooled = true): Promise<MarketData[]> {
    const sql = this.getConnection(usePooled);
    const data = await sql`
      SELECT * FROM market_data 
      WHERE symbol = ${symbol}
        AND timestamp >= ${fromDate}
        AND timestamp <= ${toDate}
      ORDER BY timestamp ASC
    `;
    return data as MarketData[];
  }

  // Analysis cache
  async getCachedAnalysis(key: string, usePooled = true): Promise<AnalysisCache | null> {
    const sql = this.getConnection(usePooled);
    const [cached] = await sql`
      SELECT * FROM analysis_cache 
      WHERE cache_key = ${key} AND expires_at > NOW()
    `;
    return cached as AnalysisCache | null;
  }

  async setCachedAnalysis(cache: Omit<AnalysisCache, 'id' | 'created_at'>, usePooled = true): Promise<void> {
    const sql = this.getConnection(usePooled);
    await sql`
      INSERT INTO analysis_cache (cache_key, analysis_result, expires_at)
      VALUES (${cache.cache_key}, ${JSON.stringify(cache.analysis_result)}, ${cache.expires_at})
      ON CONFLICT (cache_key) DO UPDATE SET
        analysis_result = EXCLUDED.analysis_result,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    `;
  }

  // Connection management
  async healthCheck(): Promise<boolean> {
    try {
      await this.sql`SELECT 1 as health`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.sql.end();
    if (this.pooledSql) {
      await this.pooledSql.end();
    }
  }
}

// Factory function for creating database instance
export function createDatabase(config: DatabaseConfig = {}): Database {
  // Validate configuration before creating instance
  const validation = validateDatabaseConfig();
  if (!validation.valid) {
    throw new Error(
      'Invalid database configuration:\n' + 
      validation.errors.map(err => `  - ${err}`).join('\n')
    );
  }
  
  return new Database(config);
}

// Export types and utilities
export type { DatabaseConfig, User, ApiKey, TradingConfig, Order, DayTrade, MarketData, AnalysisCache };
export { Database };
export { getDatabaseConfig, validateDatabaseConfig, logDatabaseConfig } from './config.js';

// Default export for convenience
export default Database;