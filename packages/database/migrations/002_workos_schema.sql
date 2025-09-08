-- Add WorkOS authentication support to existing schema

-- Modify users table to support WorkOS
ALTER TABLE users 
ADD COLUMN workos_id VARCHAR(255) UNIQUE,
ADD COLUMN first_name VARCHAR(100),
ADD COLUMN last_name VARCHAR(100),
ADD COLUMN organization_id CHAR(36),
ADD COLUMN role VARCHAR(50),
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD INDEX idx_workos_id (workos_id),
ADD INDEX idx_organization_id (organization_id);

-- Organizations table for WorkOS integration
CREATE TABLE organizations (
  id CHAR(36) NOT NULL,
  workos_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_workos_id (workos_id),
  UNIQUE KEY idx_domain (domain),
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User-Organization relationships for multi-org support
CREATE TABLE user_organizations (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_org (user_id, organization_id),
  KEY idx_organization (organization_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_user_orgs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_orgs_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for organization_id in users table
ALTER TABLE users 
ADD CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- WorkOS webhook events log
CREATE TABLE workos_webhook_events (
  id CHAR(36) NOT NULL,
  workos_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_workos_event_id (workos_event_id),
  KEY idx_event_type (event_type),
  KEY idx_processed (processed),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session tokens for WorkOS authentication
CREATE TABLE auth_sessions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR(45),
  PRIMARY KEY (id),
  UNIQUE KEY idx_token_hash (token_hash),
  KEY idx_user_id (user_id),
  KEY idx_expires_at (expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add organization_id to existing tables for multi-tenancy
ALTER TABLE trading_configs 
ADD COLUMN organization_id CHAR(36),
ADD INDEX idx_organization_id (organization_id),
ADD CONSTRAINT fk_trading_configs_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE orders 
ADD COLUMN organization_id CHAR(36),
ADD INDEX idx_organization_id (organization_id),
ADD CONSTRAINT fk_orders_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE day_trades 
ADD COLUMN organization_id CHAR(36),
ADD INDEX idx_organization_id (organization_id),
ADD CONSTRAINT fk_day_trades_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;