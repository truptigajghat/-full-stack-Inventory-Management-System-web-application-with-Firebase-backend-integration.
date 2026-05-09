import { useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight,
  Filter,
  Search,
  History
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Input } from '../components/ui/input';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function TransactionsPage() {
  const { transactions, products, loading } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransactions = transactions.filter(tx => {
    const product = products.find(p => p.id === tx.productId);
    return product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           tx.type.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">History of all stock movements and adjustments.</p>
      </div>

      <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by product name or transaction type..." 
            className="pl-9 bg-background border-none shadow-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          <span>Showing last 50 transactions</span>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty Change</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((tx) => {
              const product = products.find(p => p.id === tx.productId);
              return (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {format(tx.createdAt?.toDate() || new Date(), 'MMM dd, yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{product?.name || 'Deleted Product'}</div>
                    <div className="text-xs text-muted-foreground uppercase">{product?.sku || 'N/A'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <div className={cn(
                        "p-1 rounded-full",
                        tx.type === 'IN' ? "bg-emerald-500/10 text-emerald-500" : 
                        tx.type === 'OUT' ? "bg-rose-500/10 text-rose-500" : 
                        "bg-blue-500/10 text-blue-500"
                      )}>
                        {tx.type === 'IN' ? <ArrowUpRight className="h-3 w-3" /> : 
                         tx.type === 'OUT' ? <ArrowDownRight className="h-3 w-3" /> : 
                         <ArrowLeftRight className="h-3 w-3" />}
                      </div>
                      <span className="text-xs font-semibold">{tx.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tx.type === 'IN' ? 'default' : tx.type === 'OUT' ? 'destructive' : 'secondary'}>
                      {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <span className="text-muted-foreground">{tx.previousQuantity}</span>
                    <span className="mx-2">→</span>
                    <span className="font-bold">{tx.newQuantity}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground italic">
                    {tx.note || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && filteredTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
