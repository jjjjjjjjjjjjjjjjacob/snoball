/**
 * Database Configuration Utility
 * 
 * Builds database connection URLs from atomic environment variables
 * for easier debugging and configuration management.
 */

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  name: string;
  username: string;
  password: string;
  ssl: boolean | 'require' | 'prefer' | 'allow' | 'disable';
  poolingPort?: number;
}

/**
 * Builds a PostgreSQL connection URL from individual components
 */
export function buildDatabaseUrl(config: DatabaseConnectionConfig, usePooling = false): string {
  const port = usePooling && config.poolingPort ? config.poolingPort : config.port;
  const sslMode = config.ssl === true ? 'require' : 
                  config.ssl === false ? 'disable' : 
                  config.ssl;
  
  let url = `postgresql://${config.username}:${config.password}@${config.host}:${port}/${config.name}`;
  
  if (sslMode && sslMode !== 'disable') {
    url += `?sslmode=${sslMode}`;
  }
  
  return url;
}

/**
 * Gets database configuration from environment variables
 * Supports both atomic variables and full DATABASE_URL fallback
 */
export function getDatabaseConfig(): {
  url: string;
  pooledUrl?: string;
  isAtomic: boolean;
} {
  // If full DATABASE_URL is provided, use it directly
  if (process.env.DATABASE_URL && !process.env.DATABASE_HOST) {
    const url = process.env.DATABASE_URL;
    const pooledUrl = process.env.DATABASE_URL_POOLED || 
                      (url.includes(':5432') ? url.replace(':5432', ':6432') : undefined);
    
    return {
      url,
      pooledUrl,
      isAtomic: false
    };
  }
  
  // Build from atomic environment variables
  const host = process.env.DATABASE_HOST;
  const port = process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432;
  const name = process.env.DATABASE_NAME;
  const username = process.env.DATABASE_USERNAME;
  const password = process.env.DATABASE_PASSWORD;
  const ssl = process.env.DATABASE_SSL === 'true' ? true :
              process.env.DATABASE_SSL === 'false' ? false :
              process.env.DATABASE_SSL || 'disable';
  const poolingPort = process.env.DATABASE_POOLING_PORT ? 
                      parseInt(process.env.DATABASE_POOLING_PORT, 10) : 
                      6432;
  
  // Validate required fields
  if (!host || !name || !username || !password) {
    throw new Error(
      'Missing required database configuration. Please set either:\n' +
      '1. DATABASE_URL (full connection string), or\n' +
      '2. DATABASE_HOST, DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD'
    );
  }
  
  const config: DatabaseConnectionConfig = {
    host,
    port,
    name,
    username,
    password,
    ssl,
    poolingPort
  };
  
  const url = buildDatabaseUrl(config, false);
  const pooledUrl = buildDatabaseUrl(config, true);
  
  return {
    url,
    pooledUrl,
    isAtomic: true
  };
}

/**
 * Validates database configuration and provides helpful error messages
 */
export function validateDatabaseConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if we have either full URLs or atomic variables
  const hasFullUrl = process.env.DATABASE_URL;
  const hasAtomicVars = process.env.DATABASE_HOST && 
                       process.env.DATABASE_NAME && 
                       process.env.DATABASE_USERNAME && 
                       process.env.DATABASE_PASSWORD;
  
  if (!hasFullUrl && !hasAtomicVars) {
    errors.push('No database configuration found. Set either DATABASE_URL or atomic variables.');
  }
  
  if (hasAtomicVars) {
    // Validate atomic variables
    if (!process.env.DATABASE_HOST) errors.push('DATABASE_HOST is required');
    if (!process.env.DATABASE_NAME) errors.push('DATABASE_NAME is required');
    if (!process.env.DATABASE_USERNAME) errors.push('DATABASE_USERNAME is required');
    if (!process.env.DATABASE_PASSWORD) errors.push('DATABASE_PASSWORD is required');
    
    // Validate port if provided
    if (process.env.DATABASE_PORT) {
      const port = parseInt(process.env.DATABASE_PORT, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('DATABASE_PORT must be a valid port number (1-65535)');
      }
    }
    
    // Validate pooling port if provided
    if (process.env.DATABASE_POOLING_PORT) {
      const poolingPort = parseInt(process.env.DATABASE_POOLING_PORT, 10);
      if (isNaN(poolingPort) || poolingPort < 1 || poolingPort > 65535) {
        errors.push('DATABASE_POOLING_PORT must be a valid port number (1-65535)');
      }
    }
    
    // Validate SSL setting
    if (process.env.DATABASE_SSL) {
      const validSslValues = ['true', 'false', 'require', 'prefer', 'allow', 'disable'];
      if (!validSslValues.includes(process.env.DATABASE_SSL)) {
        errors.push(`DATABASE_SSL must be one of: ${validSslValues.join(', ')}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Development helper to log database configuration (without passwords)
 */
export function logDatabaseConfig(): void {
  if (process.env.NODE_ENV === 'production') return;
  
  try {
    const config = getDatabaseConfig();
    const maskedUrl = config.url.replace(/:([^@]+)@/, ':***@');
    const maskedPooledUrl = config.pooledUrl?.replace(/:([^@]+)@/, ':***@');
    
    console.log('Database Configuration:');
    console.log(`  Type: ${config.isAtomic ? 'Atomic variables' : 'Full URL'}`);
    console.log(`  URL: ${maskedUrl}`);
    if (maskedPooledUrl) {
      console.log(`  Pooled URL: ${maskedPooledUrl}`);
    }
    
    if (config.isAtomic) {
      console.log('  Components:');
      console.log(`    Host: ${process.env.DATABASE_HOST}`);
      console.log(`    Port: ${process.env.DATABASE_PORT || 5432}`);
      console.log(`    Name: ${process.env.DATABASE_NAME}`);
      console.log(`    Username: ${process.env.DATABASE_USERNAME}`);
      console.log(`    SSL: ${process.env.DATABASE_SSL || 'disable'}`);
      console.log(`    Pooling Port: ${process.env.DATABASE_POOLING_PORT || 6432}`);
    }
  } catch (error) {
    console.error('Database configuration error:', error);
  }
}