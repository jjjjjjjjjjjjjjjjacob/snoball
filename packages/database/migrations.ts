import { Client } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

const config = {
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'snoball',
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: true
  }
};

export async function runMigrations() {
  const client = new Client(config);
  
  try {
    await client.connect();
    
    // Check migration table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Run migrations in order
    const migrations = [
      '001_initial_schema.sql'
    ];
    
    for (const migration of migrations) {
      const result = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [migration]
      );
      
      if (result.rows.length === 0) {
        console.log(`Running migration: ${migration}`);
        const migrationPath = path.join(__dirname, 'migrations', migration);
        const sql = await fs.readFile(migrationPath, 'utf-8');
        
        // PostgreSQL can handle multiple statements in one query
        // but we'll split for better error handling
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        for (const statement of statements) {
          await client.query(statement);
        }
        
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [migration]
        );
        console.log(`Completed migration: ${migration}`);
      }
    }
    
    console.log('All migrations completed');
  } finally {
    await client.end();
  }
}

// Test connection function
export async function testConnection() {
  const client = new Client(config);
  
  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    console.log('Database connected successfully');
    console.log('PostgreSQL version:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(console.error);
}