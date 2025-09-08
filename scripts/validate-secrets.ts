#!/usr/bin/env bun

/**
 * Secret Validation Script
 * 
 * Validates that all required secrets are configured correctly across:
 * - Local environment files (.env.local, .env.development, .env.production)
 * - GitHub repository and environment secrets
 * - Render service environment variables
 * - Vercel project environment variables
 * 
 * Usage:
 *   bun run scripts/validate-secrets.ts [--environment=production] [--service=render]
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface SecretConfig {
  name: string;
  required: boolean;
  environments: ('local' | 'test' | 'production')[];
  services: ('github' | 'render' | 'vercel')[];
  description: string;
  validation?: (value: string) => boolean;
}

// Define all required secrets and their configurations
const SECRETS: SecretConfig[] = [
  // Database Configuration (Atomic Variables)
  {
    name: 'DATABASE_HOST',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'PlanetScale database host URL',
    validation: (value) => value.includes('.psdb.cloud') || value === 'localhost'
  },
  {
    name: 'DATABASE_PORT',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Database port (5432)',
    validation: (value) => ['5432', '3306'].includes(value)
  },
  {
    name: 'DATABASE_NAME',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Database name',
    validation: (value) => value.length > 0
  },
  {
    name: 'DATABASE_USERNAME',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Database username',
    validation: (value) => value.length > 0
  },
  {
    name: 'DATABASE_PASSWORD',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Database password',
    validation: (value) => value.length > 8
  },
  {
    name: 'DATABASE_SSL',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Database SSL mode',
    validation: (value) => ['require', 'true', 'false'].includes(value)
  },
  {
    name: 'DATABASE_POOLING_PORT',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Connection pooling port (6432)',
    validation: (value) => ['6432', '3307'].includes(value)
  },

  // Authentication & Security
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'NextAuth JWT secret (32+ characters)',
    validation: (value) => value.length >= 32
  },
  {
    name: 'WORKOS_API_KEY',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'WorkOS API key',
    validation: (value) => value.startsWith('sk_')
  },
  {
    name: 'WORKOS_CLIENT_ID',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'WorkOS client ID',
    validation: (value) => value.startsWith('client_')
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github', 'render', 'vercel'],
    description: 'Application encryption key (32+ characters)',
    validation: (value) => value.length >= 32
  },

  // Trading API
  {
    name: 'ALPACA_API_KEY',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github'],
    description: 'Alpaca Markets API key',
    validation: (value) => value.startsWith('PK') || value.startsWith('AK')
  },
  {
    name: 'ALPACA_SECRET_KEY',
    required: true,
    environments: ['local', 'test', 'production'],
    services: ['github'],
    description: 'Alpaca Markets secret key',
    validation: (value) => value.length > 20
  },

  // Deployment Secrets (Optional)
  {
    name: 'RENDER_API_KEY',
    required: false,
    environments: ['production'],
    services: ['github'],
    description: 'Render API key for deployment automation',
    validation: (value) => value.startsWith('rnd_')
  },
  {
    name: 'RENDER_TRADE_SERVER_ID',
    required: false,
    environments: ['production'],
    services: ['github'],
    description: 'Render trade server service ID',
    validation: (value) => value.startsWith('srv-')
  },
  {
    name: 'RENDER_WORKER_ID',
    required: false,
    environments: ['production'],
    services: ['github'],
    description: 'Render worker service ID',
    validation: (value) => value.startsWith('srv-')
  },
  {
    name: 'VERCEL_TOKEN',
    required: false,
    environments: ['production'],
    services: ['github'],
    description: 'Vercel API token',
    validation: (value) => value.length > 20
  }
];

interface ValidationResult {
  secret: string;
  environment: string;
  service: string;
  status: 'missing' | 'invalid' | 'valid';
  message?: string;
  value?: string;
}

class SecretValidator {
  private results: ValidationResult[] = [];
  private environment: string;
  private service?: string;

  constructor(environment = 'production', service?: string) {
    this.environment = environment;
    this.service = service;
  }

  async validate(): Promise<void> {
    console.log('🔍 Validating secrets configuration...\n');
    
    // Validate local environment files
    if (!this.service || this.service === 'local') {
      this.validateLocalEnv();
    }

    // Validate GitHub secrets
    if (!this.service || this.service === 'github') {
      await this.validateGitHubSecrets();
    }

    // Validate Render secrets
    if (!this.service || this.service === 'render') {
      await this.validateRenderSecrets();
    }

    // Validate Vercel secrets
    if (!this.service || this.service === 'vercel') {
      await this.validateVercelSecrets();
    }

    this.generateReport();
  }

  private validateLocalEnv(): void {
    const envFiles = ['.env.local', '.env.development', '.env.production'];
    
    for (const envFile of envFiles) {
      const envPath = join(process.cwd(), envFile);
      
      if (!existsSync(envPath)) {
        console.log(`⚠️  Environment file ${envFile} not found`);
        continue;
      }

      console.log(`📄 Validating ${envFile}...`);
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars = this.parseEnvFile(envContent);

      for (const secret of SECRETS) {
        if (!secret.environments.includes('local')) continue;

        const value = envVars[secret.name];
        
        if (!value) {
          if (secret.required) {
            this.results.push({
              secret: secret.name,
              environment: envFile,
              service: 'local',
              status: 'missing',
              message: `Required secret missing from ${envFile}`
            });
          }
          continue;
        }

        if (secret.validation && !secret.validation(value)) {
          this.results.push({
            secret: secret.name,
            environment: envFile,
            service: 'local',
            status: 'invalid',
            message: `Invalid format: ${secret.description}`,
            value: this.maskSecret(value)
          });
        } else {
          this.results.push({
            secret: secret.name,
            environment: envFile,
            service: 'local',
            status: 'valid',
            value: this.maskSecret(value)
          });
        }
      }
    }
  }

  private async validateGitHubSecrets(): Promise<void> {
    console.log('🔐 Validating GitHub secrets...');

    try {
      // Check repository secrets
      const repoSecrets = this.execCommand('gh secret list --repo $(gh repo view --json nameWithOwner -q .nameWithOwner)');
      const repoSecretNames = repoSecrets.split('\n').map(line => line.split('\t')[0]).filter(Boolean);

      // Check environment secrets
      const envSecrets = this.execCommand(`gh secret list --env ${this.environment} --repo $(gh repo view --json nameWithOwner -q .nameWithOwner)`);
      const envSecretNames = envSecrets.split('\n').map(line => line.split('\t')[0]).filter(Boolean);

      const allGitHubSecrets = [...repoSecretNames, ...envSecretNames];

      for (const secret of SECRETS) {
        if (!secret.services.includes('github')) continue;

        const hasSecret = allGitHubSecrets.includes(secret.name);

        if (!hasSecret && secret.required) {
          this.results.push({
            secret: secret.name,
            environment: this.environment,
            service: 'github',
            status: 'missing',
            message: 'Secret not found in GitHub repository or environment'
          });
        } else if (hasSecret) {
          this.results.push({
            secret: secret.name,
            environment: this.environment,
            service: 'github',
            status: 'valid',
            message: repoSecretNames.includes(secret.name) ? 'Repository secret' : 'Environment secret'
          });
        }
      }
    } catch (error) {
      console.log('⚠️  Could not validate GitHub secrets. Make sure gh CLI is installed and authenticated.');
    }
  }

  private async validateRenderSecrets(): Promise<void> {
    console.log('⚙️  Validating Render secrets...');

    const renderApiKey = process.env.RENDER_API_KEY;
    if (!renderApiKey) {
      console.log('⚠️  RENDER_API_KEY not set, skipping Render validation');
      return;
    }

    const serviceIds = [
      process.env.RENDER_TRADE_SERVER_ID,
      process.env.RENDER_WORKER_ID
    ].filter(Boolean);

    for (const serviceId of serviceIds) {
      try {
        const response = this.execCommand(`curl -s -H "Authorization: Bearer ${renderApiKey}" https://api.render.com/v1/services/${serviceId}/env-vars`);
        const envVars = JSON.parse(response);

        for (const secret of SECRETS) {
          if (!secret.services.includes('render')) continue;

          const renderVar = envVars.find((v: any) => v.key === secret.name);

          if (!renderVar && secret.required) {
            this.results.push({
              secret: secret.name,
              environment: this.environment,
              service: 'render',
              status: 'missing',
              message: `Missing from Render service ${serviceId}`
            });
          } else if (renderVar) {
            this.results.push({
              secret: secret.name,
              environment: this.environment,
              service: 'render',
              status: 'valid',
              message: `Present in Render service ${serviceId}`
            });
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not validate Render service ${serviceId}`);
      }
    }
  }

  private async validateVercelSecrets(): Promise<void> {
    console.log('🔺 Validating Vercel secrets...');

    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      console.log('⚠️  VERCEL_TOKEN not set, skipping Vercel validation');
      return;
    }

    const vercelEnv = this.environment === 'production' ? 'production' : 'preview';

    try {
      const envVars = this.execCommand(`vercel env ls ${vercelEnv} --token="${vercelToken}"`);
      const vercelSecrets = envVars.split('\n').filter(line => line.trim() && !line.startsWith('Environment Variables')).map(line => line.split(' ')[0]);

      for (const secret of SECRETS) {
        if (!secret.services.includes('vercel')) continue;

        const hasSecret = vercelSecrets.includes(secret.name);

        if (!hasSecret && secret.required) {
          this.results.push({
            secret: secret.name,
            environment: this.environment,
            service: 'vercel',
            status: 'missing',
            message: `Missing from Vercel ${vercelEnv} environment`
          });
        } else if (hasSecret) {
          this.results.push({
            secret: secret.name,
            environment: this.environment,
            service: 'vercel',
            status: 'valid',
            message: `Present in Vercel ${vercelEnv} environment`
          });
        }
      }
    } catch (error) {
      console.log('⚠️  Could not validate Vercel secrets. Make sure vercel CLI is installed and authenticated.');
    }
  }

  private parseEnvFile(content: string): Record<string, string> {
    const vars: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          vars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });

    return vars;
  }

  private execCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf-8' }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  private generateReport(): void {
    console.log('\n📊 Validation Report\n');

    const byStatus = {
      valid: this.results.filter(r => r.status === 'valid'),
      missing: this.results.filter(r => r.status === 'missing'),
      invalid: this.results.filter(r => r.status === 'invalid')
    };

    // Summary
    console.log('📋 Summary:');
    console.log(`✅ Valid secrets: ${byStatus.valid.length}`);
    console.log(`❌ Missing secrets: ${byStatus.missing.length}`);
    console.log(`⚠️  Invalid secrets: ${byStatus.invalid.length}\n`);

    // Missing secrets (critical)
    if (byStatus.missing.length > 0) {
      console.log('❌ Missing Required Secrets:\n');
      for (const result of byStatus.missing) {
        console.log(`  ${result.secret}`);
        console.log(`    Environment: ${result.environment}`);
        console.log(`    Service: ${result.service}`);
        console.log(`    Issue: ${result.message}\n`);
      }
    }

    // Invalid secrets
    if (byStatus.invalid.length > 0) {
      console.log('⚠️  Invalid Secrets:\n');
      for (const result of byStatus.invalid) {
        console.log(`  ${result.secret}`);
        console.log(`    Environment: ${result.environment}`);
        console.log(`    Service: ${result.service}`);
        console.log(`    Issue: ${result.message}`);
        if (result.value) {
          console.log(`    Current value: ${result.value}`);
        }
        console.log();
      }
    }

    // Success message
    if (byStatus.missing.length === 0 && byStatus.invalid.length === 0) {
      console.log('🎉 All required secrets are properly configured!\n');
      
      console.log('📋 Next Steps:');
      console.log('1. Test database connection: bun run db:test');
      console.log('2. Test API connections: bun run trading:test');
      console.log('3. Run local development: bun run dev');
      console.log('4. Deploy to production: git push origin main\n');
    } else {
      console.log('🔧 Action Required:');
      console.log('1. Add missing secrets to GitHub repository/environment');
      console.log('2. Fix invalid secret formats');
      console.log('3. Re-run validation: bun run scripts/validate-secrets.ts');
      console.log('4. Trigger secret sync: gh workflow run sync-secrets.yml\n');
      
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const environmentArg = args.find(arg => arg.startsWith('--environment='));
  const serviceArg = args.find(arg => arg.startsWith('--service='));
  
  const environment = environmentArg ? environmentArg.split('=')[1] : 'production';
  const service = serviceArg ? serviceArg.split('=')[1] : undefined;

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Secret Validation Script

Usage: bun run scripts/validate-secrets.ts [options]

Options:
  --environment=<env>    Environment to validate (local, test, production)
  --service=<service>    Service to validate (local, github, render, vercel)
  --help, -h            Show this help message

Examples:
  bun run scripts/validate-secrets.ts                    # Validate all secrets for production
  bun run scripts/validate-secrets.ts --environment=test # Validate test environment
  bun run scripts/validate-secrets.ts --service=github   # Validate only GitHub secrets
  bun run scripts/validate-secrets.ts --service=render   # Validate only Render secrets
    `);
    return;
  }

  const validator = new SecretValidator(environment, service);
  await validator.validate();
}

if (import.meta.main) {
  main().catch(console.error);
}