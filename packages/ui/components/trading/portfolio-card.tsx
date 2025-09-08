'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { Badge } from '../badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PortfolioCardProps {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: number;
  pdtCount: number;
}

export function PortfolioCard({
  totalValue,
  dayChange,
  dayChangePercent,
  positions,
  pdtCount
}: PortfolioCardProps) {
  const isPositive = dayChange >= 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Portfolio
          {pdtCount > 0 && (
            <Badge variant={pdtCount >= 3 ? 'destructive' : 'warning'}>
              PDT: {pdtCount}/3
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-success-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger-500" />
            )}
            <span className={cn(
              'font-semibold',
              isPositive ? 'text-success-500' : 'text-danger-500'
            )}>
              ${Math.abs(dayChange).toFixed(2)} ({dayChangePercent.toFixed(2)}%)
            </span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {positions} Active Positions
          </div>
        </div>
      </CardContent>
    </Card>
  );
}