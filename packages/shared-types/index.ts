export interface User {
  id: string;
  workosId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  role?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  workosId: string;
  name: string;
  domain?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  provider: 'alpaca' | 'openai' | 'anthropic';
  encryptedKey: string;
  createdAt: Date;
}

export type TradingMode = 'pdt_safe' | 'pdt_unsafe' | 'long_term';
export type RiskLevel = 'low' | 'medium' | 'high';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'accepted' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';

export interface TradingConfig {
  id: string;
  userId: string;
  mode: TradingMode;
  riskLevel: RiskLevel;
  confidenceThreshold: number;
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  tradeOptions: boolean;
  tradeStocks: boolean;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  alpacaOrderId?: string;
  symbol: string;
  quantity: number;
  side: OrderSide;
  orderType: OrderType;
  status: OrderStatus;
  filledPrice?: number;
  confidenceScore?: number;
  createdAt: Date;
  filledAt?: Date;
}

export interface DayTrade {
  id: string;
  userId: string;
  symbol: string;
  buyOrderId: string;
  sellOrderId: string;
  tradeDate: Date;
  createdAt: Date;
}

export interface MarketData {
  symbol: string;
  timestamp: Date;
  price: number;
  volume?: number;
  bid?: number;
  ask?: number;
}

export interface AnalysisResult {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  indicators: Record<string, number>;
  timestamp: Date;
}

export interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
  pdtCount: number;
  buyingPower: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

// Authentication & Session Types
export interface AuthSession {
  user: User;
  organization?: Organization;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthContext {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  session: AuthSession | null;
}

// WorkOS Integration Types
export interface WorkOSWebhookEvent {
  id: string;
  event: string;
  data: Record<string, any>;
  createdAt: string;
}

export interface WorkOSUserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}