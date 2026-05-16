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
  ArrowLeftRight,
  RefreshCw
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
  const { products, transactions, loading, error, shopifySettings } = useInventory();

  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + p.quantity, 0);
  const lowStockItems = products.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length;
  const outOfStockItems = products.filter(p => p.quantity === 0).length;

  const chartData = products.slice(0, 6).map(p => ({
    name: p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name,
    stock: p.quantity
  }));

  const recentTransactions = transactions.slice(0, 5);

  const activeStoresCount = shopifySettings?.filter(s => s.status === 'ACTIVE').length || 0;

  const stats = [
    { title: 'Total Products', value: totalProducts, icon: Package, color: 'text-foreground' },
    { title: 'Synced Stores', value: activeStoresCount, icon: RefreshCw, color: 'text-emerald-500' },
    { title: 'Low Stock', value: lowStockItems, icon: AlertTriangle, color: 'text-amber-500' },
    { title: 'Out of Stock', value: outOfStockItems, icon: TrendingUp, color: 'text-rose-500' },
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
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div>
          <h1 className="text-3xl font-serif tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.2em] font-bold mt-2">Real-time statistics and inventory tracking.</p>
        </div>
        <Link to="/products">
          <Button className="rounded-none shadow-xl tracking-[0.2em] uppercase text-[9px] font-bold px-6 h-10">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add Product
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border border-border/40 bg-background/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-700 group rounded-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">{stat.title}</CardTitle>
                <div className={`${stat.color} transition-transform duration-700 group-hover:scale-110`}>
                  <stat.icon className="h-4 w-4 opacity-70" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-serif mt-2">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border border-border/40 bg-background/40 backdrop-blur-xl shadow-sm rounded-none">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Inventory Levels</CardTitle>
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
                <Bar dataKey="stock" fill="currentColor" className="fill-foreground opacity-90" radius={[2, 2, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 border border-border/40 bg-background/40 backdrop-blur-xl shadow-sm rounded-none">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => {
                  const product = products.find(p => p.id === tx.productId);
                  return (
                    <div key={tx.id} className="flex items-center gap-4 py-3 border-b border-border/40 group hover:border-primary/50 transition-colors">
                      <div className={cn(
                        "transition-transform duration-500 group-hover:scale-110",
                        tx.type === 'IN' ? "text-emerald-500/80" : 
                        tx.type === 'OUT' ? "text-rose-500/80" : 
                        "text-foreground/50"
                      )}>
                        {tx.type === 'IN' ? <ArrowUpRight className="h-4 w-4" /> : 
                         tx.type === 'OUT' ? <ArrowDownRight className="h-4 w-4" /> : 
                         <ArrowLeftRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-widest truncate">{product?.name || 'Unknown Product'}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-1">{format(tx.createdAt?.toDate() || new Date(), 'MMM dd, HH:mm')}</p>
                      </div>
                      <div className={cn(
                        "text-sm font-serif",
                        tx.type === 'IN' ? "text-emerald-500" : tx.type === 'OUT' ? "text-rose-500" : "text-foreground"
                      )}>
                        {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-muted-foreground text-[10px] tracking-widest uppercase">No recent activity</div>
              )}
            </div>
            <Link to="/transactions">
              <Button variant="ghost" className="w-full mt-6 text-[10px] font-bold tracking-widest uppercase rounded-none border border-transparent hover:border-border/40 transition-all">View all transactions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
