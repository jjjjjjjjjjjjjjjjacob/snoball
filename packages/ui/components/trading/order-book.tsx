'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { Badge } from '../badge';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  confidence: number;
  timestamp: Date;
}

interface OrderBookProps {
  orders: Order[];
}

export function OrderBook({ orders = [] }: OrderBookProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No orders yet
            </p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-full',
                    order.side === 'buy' ? 'bg-success-100' : 'bg-danger-100'
                  )}>
                    {order.side === 'buy' ? (
                      <ArrowUpIcon className="h-4 w-4 text-success-700" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 text-danger-700" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{order.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.quantity} shares @ ${order.price.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      order.confidence >= 0.8
                        ? 'success'
                        : order.confidence >= 0.6
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {(order.confidence * 100).toFixed(0)}%
                  </Badge>
                  <Badge
                    variant={
                      order.status === 'filled'
                        ? 'success'
                        : order.status === 'cancelled'
                        ? 'destructive'
                        : 'default'
                    }
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}