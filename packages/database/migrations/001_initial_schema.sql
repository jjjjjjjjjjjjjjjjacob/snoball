-- PlanetScale uses MySQL syntax with vitess sharding

-- Users table
CREATE TABLE users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API keys (encrypted)
CREATE TABLE api_keys (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_provider (user_id, provider),
  CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trading configuration
CREATE TABLE trading_configs (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  mode ENUM('pdt_safe', 'pdt_unsafe', 'long_term') NOT NULL DEFAULT 'pdt_safe',
  risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
  confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
  max_position_size DECIMAL(10,2) DEFAULT 1000.00,
  stop_loss_percentage DECIMAL(5,2) DEFAULT 5.00,
  take_profit_percentage DECIMAL(5,2) DEFAULT 10.00,
  trade_options BOOLEAN DEFAULT FALSE,
  trade_stocks BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_config (user_id),
  CONSTRAINT fk_trading_configs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table (sharded by user_id for scale)
CREATE TABLE orders (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  alpaca_order_id VARCHAR(255),
  symbol VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  filled_price DECIMAL(10,2),
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_user_created (user_id, created_at DESC),
  KEY idx_symbol_created (symbol, created_at DESC),
  KEY idx_alpaca_order (alpaca_order_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PDT tracking
CREATE TABLE day_trades (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  buy_order_id CHAR(36) NOT NULL,
  sell_order_id CHAR(36) NOT NULL,
  trade_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_date (user_id, trade_date DESC),
  CONSTRAINT fk_day_trades_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_day_trades_buy FOREIGN KEY (buy_order_id) REFERENCES orders(id),
  CONSTRAINT fk_day_trades_sell FOREIGN KEY (sell_order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market data (partitioned by date for performance)
CREATE TABLE market_data (
  symbol VARCHAR(10) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  volume BIGINT,
  bid DECIMAL(10,2),
  ask DECIMAL(10,2),
  PRIMARY KEY (symbol, timestamp),
  KEY idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (UNIX_TIMESTAMP(timestamp)) (
  PARTITION p_2024_01 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p_2024_02 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Analysis results cache
CREATE TABLE analysis_cache (
  id CHAR(36) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  result JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_hash (hash),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;