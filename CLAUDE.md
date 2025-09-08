# CLAUDE.md - AI Assistant Guidelines for Snoball Trading Platform

## 🎯 Project Context

You are working on **Snoball**, an AI-powered trading platform that enables automated trading with Pattern Day Trading (PDT) compliance for accounts under $25,000. The platform uses LLM analysis to generate trading signals, executed by a persistent server through the Alpaca Markets API.

### Core Business Requirements
1. **PDT Compliance**: CRITICAL - Must track and enforce the 3 day trades per 5-day rolling window limit for accounts < $25k
2. **User-Provided API Keys**: Users supply their own Alpaca, OpenAI/Anthropic keys (must be encrypted at rest)
3. **Real-time Trading**: Low-latency order execution with WebSocket connections
4. **AI-Driven Signals**: LLM analysis for market sentiment and trading decisions
5. **Risk Management**: Stop-loss, take-profit, and position sizing calculations

## 🏗️ Architecture Decisions

### Technology Stack
- **Runtime**: Bun (NOT Node.js) - Use Bun-specific APIs where beneficial
- **Frontend**: React 19 RC with Next.js 14 (App Router, NOT Pages Router)
- **Styling**: Tailwind CSS v4 alpha (use @theme syntax, NOT tailwind.config.js)
- **Database**: PlanetScale MySQL (NOT PostgreSQL, supports sharding)
- **Infrastructure**: AWS ECS for containers, Lambda for serverless
- **Monorepo**: Nx with Bun workspaces (NOT npm/yarn workspaces)

### Project Structure
```
snoball/
├── apps/           # Applications (web, trade-server)
├── packages/       # Shared packages (ui, types, core logic)
├── services/       # Microservices (analysis, market-data)
├── functions/      # Lambda functions
└── infrastructure/ # Terraform IaC
```

## 📋 Development Guidelines

### Code Style & Patterns

#### TypeScript/React
```typescript
// ✅ ALWAYS use this pattern for components
'use client'; // When needed for interactivity

import { ComponentProps } from '@snoball/shared-types';

export function TradingComponent({ data }: ComponentProps) {
  // Hooks at the top
  const [state, setState] = useState();
  
  // Early returns for edge cases
  if (!data) return null;
  
  // Main render
  return <div>...</div>;
}

// ❌ AVOID class components, PropTypes, or old patterns
```

#### Imports
```typescript
// ✅ CORRECT - Use workspace imports
import { PDTTracker } from '@snoball/trading-core';
import { Button } from '@snoball/ui/components/button';

// ❌ WRONG - Relative imports across packages
import { PDTTracker } from '../../../packages/trading-core';
```

### PDT Compliance Implementation

**CRITICAL**: All trading operations MUST check PDT limits:

```typescript
// ✅ ALWAYS check before placing orders
const tracker = new PDTTracker(accountValue);
if (!tracker.canDayTrade()) {
  throw new Error(`PDT limit reached. Next trade available: ${tracker.getNextTradeDate()}`);
}

// Track the trade
tracker.addOrder(order);
```

### Security Requirements

1. **API Keys**: MUST be encrypted using AES-256-GCM before storage
2. **Environment Variables**: Never commit .env files
3. **Secrets**: Use AWS Secrets Manager in production
4. **Authentication**: Implement JWT with refresh tokens
5. **Input Validation**: Use Zod for all user inputs

```typescript
// ✅ CORRECT - Validate and encrypt
const ApiKeySchema = z.object({
  provider: z.enum(['alpaca', 'openai', 'anthropic']),
  key: z.string().min(20),
});

const validated = ApiKeySchema.parse(input);
const encrypted = await encrypt(validated.key, process.env.ENCRYPTION_KEY);
```

### Database Operations

```typescript
// ✅ Use PlanetScale connection
import { connect } from '@planetscale/database';

const conn = connect({
  host: process.env.DATABASE_HOST,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
});

// ✅ Use prepared statements
const result = await conn.execute(
  'SELECT * FROM orders WHERE user_id = ? AND created_at > ?',
  [userId, fiveDaysAgo]
);
```

### Testing Requirements

```typescript
// ✅ Use Bun test runner
import { expect, test, describe } from 'bun:test';

describe('PDTTracker', () => {
  test('enforces day trade limit', () => {
    const tracker = new PDTTracker(10000);
    // Add 3 day trades
    for (let i = 0; i < 3; i++) {
      tracker.addDayTrade();
    }
    expect(tracker.canDayTrade()).toBe(false);
  });
});
```

## 🚀 Common Tasks

### Adding a New Trading Feature

1. **Update types** in `packages/shared-types`
2. **Add business logic** to `packages/trading-core`
3. **Create UI components** in `packages/ui`
4. **Implement API endpoint** in Next.js or Lambda
5. **Add tests** using Bun test runner
6. **Update database schema** if needed

### Implementing a New Technical Indicator

```typescript
// packages/trading-core/src/calculations.ts
export class TradingCalculator {
  static calculateNewIndicator(prices: number[], period: number): number {
    // 1. Validate inputs
    if (prices.length < period) return 0;
    
    // 2. Implement calculation
    const result = /* calculation logic */;
    
    // 3. Return normalized value
    return Math.round(result * 100) / 100;
  }
}
```

### Deploying Changes

```bash
# Development
bun run dev

# Testing
bun test
bun run type-check

# Deployment (auto via GitHub Actions)
git push origin main  # Triggers CI/CD
```

## ⚠️ Critical Warnings

### DO NOT:
1. **Remove PDT checks** - This could cause legal/compliance issues
2. **Store unencrypted API keys** - Security vulnerability
3. **Use blocking operations in trade execution** - Will cause latency
4. **Modify database schema without migrations** - Data integrity
5. **Deploy without testing PDT logic** - Compliance critical
6. **Use npm/yarn** - Project uses Bun exclusively
7. **Import React 18 patterns** - Project uses React 19 RC

### ALWAYS:
1. **Check PDT limits before trades**
2. **Encrypt sensitive data**
3. **Use TypeScript strict mode**
4. **Follow the monorepo structure**
5. **Write tests for trading logic**
6. **Use environment variables for config**
7. **Implement proper error handling**
8. **Log trade executions for audit**

## 📊 Performance Requirements

- **Trade Execution**: < 50ms latency
- **LLM Analysis**: < 2 seconds response
- **Dashboard Load**: < 1 second FCP
- **PDT Calculation**: < 10ms
- **Database Queries**: < 50ms p99

## 🔄 State Management

```typescript
// Frontend: Use Zustand for global state
import { create } from 'zustand';

const useTradingStore = create((set) => ({
  portfolio: null,
  pdtCount: 0,
  updatePortfolio: (portfolio) => set({ portfolio }),
  incrementPDT: () => set((state) => ({ pdtCount: state.pdtCount + 1 })),
}));

// Backend: Use Redis for session/cache
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
```

## 🐛 Debugging Tips

### Common Issues

1. **PDT Limit Hit Unexpectedly**
   - Check 5-day rolling window calculation
   - Verify timezone handling (use UTC)
   - Check order pairing logic

2. **Alpaca Connection Issues**
   - Verify API keys are correct
   - Check if market is open
   - Ensure WebSocket reconnection logic

3. **Type Errors with React 19**
   - Ensure @types/react is version 19
   - Check for deprecated patterns
   - Use 'use client' directive properly

## 📚 Resources

- **Alpaca API**: https://alpaca.markets/docs/api-references/
- **PlanetScale**: https://planetscale.com/docs
- **React 19**: https://react.dev/blog/2024/04/25/react-19
- **Tailwind v4**: https://tailwindcss.com/blog/tailwindcss-v4-alpha
- **Bun**: https://bun.sh/docs
- **PDT Rules**: https://www.finra.org/investors/learn-to-invest/advanced-investing/day-trading-margin-requirements-know-rules

## 🤝 Contribution Workflow

1. **Before Making Changes**:
   - Read this CLAUDE.md file
   - Check PROGRESS.md for current status
   - Understand PDT compliance requirements

2. **Making Changes**:
   - Follow existing patterns in the codebase
   - Add tests for new functionality
   - Update types in shared-types package
   - Ensure PDT compliance is maintained

3. **Testing**:
   ```bash
   bun test                    # Run all tests
   bun test:pdt               # Test PDT logic specifically
   bun run type-check         # TypeScript validation
   ```

4. **Documentation**:
   - Update PROGRESS.md with implementation status
   - Add JSDoc comments for complex functions
   - Update this file if adding new patterns

## 🎯 Project Goals

1. **MVP**: Basic trading with PDT compliance
2. **Phase 2**: Options trading support
3. **Phase 3**: Multi-account management
4. **Phase 4**: Mobile application
5. **Phase 5**: Social trading features

---

*Remember: This is a financial application handling real money. Security, compliance, and reliability are non-negotiable. When in doubt, prioritize safety over features.*