import React, { useState } from 'react';
import { useInventory } from '../../hooks/useInventory';
import { Product } from '../../types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface StockActionModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StockActionModal({ product, isOpen, onClose }: StockActionModalProps) {
  const { adjustStock } = useInventory();
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setLoading(true);
    try {
      const q = Number(quantity);
      // For OUT, we pass a negative number to the hook
      const delta = type === 'OUT' ? -q : q;
      await adjustStock(product.id, delta, type, note);
      toast.success(`Stock ${type.toLowerCase()} successful`);
      onClose();
      setQuantity('');
      setNote('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Stock: {product.name}</DialogTitle>
          <DialogDescription>
            Current stock: <span className="font-bold">{product.quantity}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="type">Transaction Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Stock In (+)</SelectItem>
                <SelectItem value="OUT">Stock Out (-)</SelectItem>
                <SelectItem value="ADJUSTMENT">Manual Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input 
              id="quantity" 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value)} 
              placeholder="e.g. 10" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Notes (optional)</Label>
            <Input 
              id="note" 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              placeholder="e.g. Restock from supplier" 
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Confirm Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
