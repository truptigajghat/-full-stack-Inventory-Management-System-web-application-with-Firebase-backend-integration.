import React, { useState, useEffect } from 'react';
import { 
  X, 
  Store, 
  Package, 
  Barcode, 
  Save, 
  Image as ImageIcon,
  Plus,
  Minus,
  RefreshCw,
  Info,
  Tag
} from 'lucide-react';
import { Product } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productId: string, localStock: Record<string, number>) => Promise<void>;
  isSaving: boolean;
}

export function ProductDetailsModal({ 
  product, 
  isOpen, 
  onClose, 
  onSave,
  isSaving 
}: ProductDetailsModalProps) {
  const [localStock, setLocalStock] = useState<Record<string, number>>({});

  useEffect(() => {
    if (product && isOpen) {
      const initialStock: Record<string, number> = {};
      if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        product.variants.forEach(v => {
          initialStock[v.id] = v.quantity;
        });
      } else {
        initialStock['base'] = product.quantity || 0;
      }
      setLocalStock(initialStock);
    }
  }, [product, isOpen]);

  if (!product) return null;

  const totalStock = Object.values(localStock).reduce((acc, curr) => acc + (Number(curr) || 0), 0);

  const handleUpdateStock = (variantId: string, delta: number) => {
    setLocalStock(prev => ({
      ...prev,
      [variantId]: Math.max(0, (Number(prev[variantId]) || 0) + delta)
    }));
  };

  const handleInputChange = (variantId: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value);
    setLocalStock(prev => ({
      ...prev,
      [variantId]: isNaN(num) ? 0 : num
    }));
  };

  const handleSave = () => {
    onSave(product.id, localStock);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl p-0 overflow-hidden bg-background border-none rounded-3xl shadow-2xl h-[90vh] md:h-[85vh] flex flex-col">
        {/* Main Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Left: Product Image Section */}
          <div className="relative w-full md:w-1/2 bg-muted/30 flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-border/50 overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-700 hover:scale-105" 
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-muted-foreground/20">
                  <ImageIcon className="h-32 w-32" />
                  <span className="text-xs font-black uppercase tracking-widest">No Preview Available</span>
                </div>
              )}
            </div>
            
            <div className="absolute top-8 left-8 flex flex-col gap-2">
              <span className="bg-background/80 backdrop-blur-md border border-border text-[10px] font-black px-4 py-1.5 uppercase tracking-[0.2em] rounded-full shadow-sm">
                {product.source || 'Local Inventory'}
              </span>
              {product.category && (
                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-4 py-1.5 uppercase tracking-[0.2em] rounded-full shadow-sm flex items-center gap-2">
                  <Tag className="h-3 w-3" />
                  {product.category}
                </span>
              )}
            </div>
          </div>

          {/* Right: Operations & Details Section */}
          <div className="w-full md:w-1/2 flex flex-col bg-background h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-10 custom-scrollbar">
              {/* Header Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">Product Identifier</span>
                  <DialogTitle className="text-4xl font-serif tracking-tight leading-tight text-foreground">
                    {product.name}
                  </DialogTitle>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground bg-muted/50 px-5 py-2.5 rounded-2xl border border-border shadow-sm">
                    <Barcode className="h-4 w-4 opacity-40" />
                    <span className="tracking-widest">{product.sku}</span>
                  </div>
                  
                  <div className={cn(
                    "text-[11px] font-bold px-5 py-2.5 rounded-2xl border shadow-sm flex items-center gap-3 transition-colors",
                    totalStock === 0 
                      ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  )}>
                    <div className={cn(
                      "h-2 w-2 rounded-full animate-pulse",
                      totalStock === 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    )} />
                    <span className="tracking-widest">{totalStock} {totalStock === 1 ? 'UNIT' : 'UNITS'} IN STOCK</span>
                  </div>
                </div>
              </div>

              {/* Operational Workspace (Variants) */}
              <div className="space-y-8 pt-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/50">
                    Inventory Breakdown
                  </h3>
                  <Package className="h-4 w-4 text-muted-foreground/20" />
                </div>
                
                <div className="space-y-4">
                  {(!product.variants || !Array.isArray(product.variants) || product.variants.length === 0) ? (
                    <div className="flex items-center justify-between p-7 bg-muted/20 rounded-[2rem] border border-border/40 group hover:bg-muted/30 transition-all">
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-foreground">Base Product Stock</span>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-40">Single Variant Item</p>
                      </div>
                      <div className="flex items-center gap-3 bg-background rounded-full border border-border p-1.5 shadow-sm">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-full hover:bg-muted"
                          onClick={() => handleUpdateStock('base', -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input 
                          className="w-14 h-9 text-center border-none bg-transparent font-serif text-xl p-0 focus-visible:ring-0"
                          type="number"
                          value={localStock['base'] ?? 0}
                          onChange={(e) => handleInputChange('base', e.target.value)}
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-full hover:bg-muted"
                          onClick={() => handleUpdateStock('base', 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {product.variants.map((v) => (
                        <div 
                          key={v.id}
                          className="flex items-center justify-between p-6 border border-border/40 bg-muted/5 hover:bg-muted/10 transition-all rounded-[2.5rem]"
                        >
                          <div className="space-y-1">
                            <span className="text-sm font-bold text-foreground tracking-tight">
                              {v.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-black">
                                SKU: {v.sku || 'N/A'}
                              </span>
                              <span className="h-1 w-1 rounded-full bg-border" />
                              <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-black">
                                Price: ${v.price || product.price}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 bg-background rounded-full border border-border p-1.5 shadow-sm">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-full hover:bg-muted"
                              onClick={() => handleUpdateStock(v.id, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input 
                              className="w-14 h-9 text-center border-none bg-transparent font-serif text-xl p-0 focus-visible:ring-0"
                              type="number"
                              value={localStock[v.id] ?? 0}
                              onChange={(e) => handleInputChange(v.id, e.target.value)}
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-full hover:bg-muted"
                              onClick={() => handleUpdateStock(v.id, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Store Details */}
              {product.storeName && (
                <div className="pt-8 flex items-center gap-6 text-[10px] text-muted-foreground bg-muted/20 p-7 rounded-[2.5rem] border border-border/40">
                  <div className="p-4 bg-background rounded-2xl shadow-sm border border-border/50">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-black uppercase tracking-[0.3em] text-foreground/80">{product.storeName}</span>
                    <span className="truncate opacity-50 font-bold lowercase tracking-normal">{product.storeDomain}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Sticky Actions */}
            <div className="mt-auto p-8 md:p-10 border-t border-border/40 flex justify-between items-center bg-background/80 backdrop-blur-md">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/30">
                  Sync Engine Active
                </span>
                <span className="text-[8px] text-primary/40 font-bold uppercase tracking-widest mt-1">
                  Changes committed to global inventory
                </span>
              </div>
              <Button 
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-full text-[10px] font-bold uppercase tracking-[0.3em] h-14 px-12 bg-foreground text-background hover:scale-105 active:scale-95 transition-all shadow-2xl gap-3"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Commit Inventory
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
