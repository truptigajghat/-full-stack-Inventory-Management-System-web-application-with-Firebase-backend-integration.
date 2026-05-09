import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Package, 
  Boxes, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  ArrowLeftRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const { products, transactions, loading, error } = useInventory();

  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + p.quantity, 0);
  const lowStockItems = products.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length;
  const outOfStockItems = products.filter(p => p.quantity === 0).length;

  const chartData = products.slice(0, 6).map(p => ({
    name: p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name,
    stock: p.quantity
  }));

  const recentTransactions = transactions.slice(0, 5);

  const stats = [
    { title: 'Total Products', value: totalProducts, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Total Stock', value: totalStock, icon: Boxes, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Low Stock', value: lowStockItems, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Out of Stock', value: outOfStockItems, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm font-medium">
            {error.includes('index') 
              ? 'Database indexes are still building. Please wait 1-2 minutes for Firebase to finish.' 
              : error}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time statistics and inventory tracking.</p>
        </div>
        <Link to="/products">
          <Button className="rounded-full shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`${stat.bg} ${stat.color} p-2 rounded-lg`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Inventory Levels</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="stock" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const product = products.find(p => p.id === tx.productId);
                  return (
                    <div key={tx.id} className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        tx.type === 'IN' ? "bg-emerald-500/10 text-emerald-500" : 
                        tx.type === 'OUT' ? "bg-rose-500/10 text-rose-500" : 
                        "bg-blue-500/10 text-blue-500"
                      )}>
                        {tx.type === 'IN' ? <ArrowUpRight className="h-4 w-4" /> : 
                         tx.type === 'OUT' ? <ArrowDownRight className="h-4 w-4" /> : 
                         <ArrowLeftRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product?.name || 'Unknown Product'}</p>
                        <p className="text-xs text-muted-foreground">{format(tx.createdAt?.toDate() || new Date(), 'MMM dd, HH:mm')}</p>
                      </div>
                      <Badge variant={tx.type === 'IN' ? 'default' : tx.type === 'OUT' ? 'destructive' : 'secondary'}>
                        {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm italic">No recent activity</div>
              )}
            </div>
            <Link to="/transactions">
              <Button variant="ghost" className="w-full mt-4 text-xs">View all transactions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
