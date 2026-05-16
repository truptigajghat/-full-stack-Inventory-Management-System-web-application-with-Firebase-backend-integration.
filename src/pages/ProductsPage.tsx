import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInventory } from '../hooks/useInventory';
import { 
  Plus,
  Download, 
  Search, 
  Filter,
  AlertTriangle,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  Save
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { ProductDetailsModal } from '../components/inventory/ProductDetailsModal';
import { useUSBScanner } from '../hooks/useUSBScanner';
import { BarcodeScanner } from '../components/inventory/BarcodeScanner';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Product, ShopifyStoreConfig } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '../lib/utils';
import { verifyShopifyConnection, fetchShopifyProducts } from '../lib/shopify';

export default function ProductsPage() {
  const { 
    products, 
    categories, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    uploadImage, 
    shopifySettings,
    saveShopifySettings,
    loading, 
    error 
  } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [stockChanges, setStockChanges] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editedStores, setEditedStores] = useState<any[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>('');
  const [syncStats, setSyncStats] = useState<{ storesSynced: number; productsImported: number; storesFailed: number } | null>(null);

  useUSBScanner({
    onScan: (scannedCode) => {
      setSearchTerm(scannedCode);
      toast.success(`Scanned: ${scannedCode}`);
    }
  });

  const getProductStock = (p: any) => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.reduce((acc: number, v: any) => {
        const stockKey = `${p.id}_${v.id}`;
        const vStock = stockChanges[stockKey] !== undefined ? stockChanges[stockKey] : v.quantity;
        return acc + (Number(vStock) || 0);
      }, 0);
    }
    return stockChanges[p.id] !== undefined ? stockChanges[p.id] : p.quantity;
  };

  const getSavedProductStock = (p: any) => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.reduce((acc: number, v: any) => acc + (Number(v.quantity) || 0), 0);
    }
    return p.quantity;
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.storeName || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (sortOrder === 'asc') return getSavedProductStock(a) - getSavedProductStock(b);
    if (sortOrder === 'desc') return getSavedProductStock(b) - getSavedProductStock(a);
    return 0;
  });

  const handleSaveStock = async (productId: string, localStock: Record<string, number>) => {
    setIsSaving(true);
    try {
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error("Product not found");

      let updates: any = {};
      let totalQuantity = 0;
      
      if (product.variants && product.variants.length > 0) {
        updates.variants = product.variants.map(v => {
          const newQty = Number(localStock[v.id] ?? v.quantity);
          totalQuantity += newQty;
          return { ...v, quantity: newQty };
        });
        updates.quantity = totalQuantity;
      } else {
        updates.quantity = Number(localStock['base'] ?? product.quantity);
      }

      await updateProduct(productId, updates);
      toast.success('Stock updated successfully');
      setIsProductModalOpen(false);
    } catch (error: any) {
      toast.error('Failed to update stock: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingLocal(true);
    const formData = new FormData(e.currentTarget);
    
    let imageUrl = editingProduct?.imageUrl || '';
    if (selectedFile) {
      try {
        const uploadedUrl = await uploadImage(selectedFile);
        if (uploadedUrl) imageUrl = uploadedUrl;
      } catch (error: any) {
        toast.error('Failed to upload image');
        setLoadingLocal(false);
        return;
      }
    }

    const productData = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      description: formData.get('description') as string,
      price: Number(formData.get('price')),
      quantity: Number(formData.get('quantity')),
      minQuantity: Number(formData.get('minQuantity')),
      category: formData.get('category') as string,
      imageUrl,
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        toast.success('Product updated');
      } else {
        await addProduct(productData);
        toast.success('Product added');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setImagePreview(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingLocal(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF() as any;
    doc.text('Inventory Report', 14, 15);
    doc.autoTable({
      head: [['Name', 'SKU', 'Category', 'Stock', 'Price']],
      body: filteredProducts.map(p => [p.name, p.sku, p.category, p.quantity, `$${p.price}`]),
      startY: 20,
    });
    doc.save('inventory-report.pdf');
  };

  const handleShopifySync = async (specificStoreId?: string) => {
    const storesToSync = specificStoreId 
      ? shopifySettings.filter(s => s.id === specificStoreId) 
      : shopifySettings;

    if (!storesToSync || storesToSync.length === 0) {
      toast.error('No connected Shopify stores found to sync.');
      setIsSettingsModalOpen(true);
      return;
    }

    setIsSyncingShopify(true);
    setSyncStats(null);
    let totalImported = 0;
    let successCount = 0;
    let failCount = 0;
    
    // Copy current settings to update statuses
    const updatedSettings = [...shopifySettings];

    try {
      for (let i = 0; i < storesToSync.length; i++) {
        const store = storesToSync[i];
        const storeIndex = updatedSettings.findIndex(s => s.id === store.id);
        
        setSyncProgress(`Syncing Store ${i + 1} of ${storesToSync.length}: ${store.name}...`);
        
        try {
          const fetchedProducts = await fetchShopifyProducts(store);
          
          // We will update products one by one or in batches.
          // For simplicity, we loop through and use addProduct/updateProduct.
          // In a real huge production app, we'd use Firestore batches.
          
          for (const newProduct of fetchedProducts) {
             const { id: syncId, ...productData } = newProduct;
             const productDataWithSource = { ...productData, sourceId: syncId };
             
             const existingProduct = products.find(p => 
               (p as any).sourceId === syncId || 
               (p.sku === productData.sku && p.storeDomain === store.domain)
             );
             
             if (existingProduct) {
               // Preserve existing inventory stock
               productDataWithSource.quantity = existingProduct.quantity;
               
               if (productDataWithSource.variants && existingProduct.variants) {
                 productDataWithSource.variants = productDataWithSource.variants.map((newVariant: any) => {
                   const existingVariant = existingProduct.variants?.find((v: any) => 
                     v.id === newVariant.id || v.sku === newVariant.sku
                   );
                   if (existingVariant) {
                     return { ...newVariant, quantity: existingVariant.quantity };
                   }
                   return newVariant;
                 });
               }
               
               await updateProduct(existingProduct.id, productDataWithSource);
             } else {
               // New product, start with initial synced quantity or 0
               await addProduct(productDataWithSource);
             }
          }
          
          totalImported += fetchedProducts.length;
          successCount++;
          
          if (storeIndex !== -1) {
            const updatedStore = {
              ...updatedSettings[storeIndex],
              status: 'ACTIVE' as const,
              lastSyncedAt: new Date().toISOString(),
              productsCount: fetchedProducts.length,
            };
            delete updatedStore.lastError;
            updatedSettings[storeIndex] = updatedStore;
          }
          
        } catch (err: any) {
          console.error(`Failed to sync store ${store.name}:`, err);
          failCount++;
          if (storeIndex !== -1) {
            updatedSettings[storeIndex] = {
              ...updatedSettings[storeIndex],
              status: 'FAILED',
              lastError: err.message
            };
          }
        }
      }
      
      // Save updated store statuses
      await saveShopifySettings(updatedSettings);

      setSyncStats({
        storesSynced: successCount,
        productsImported: totalImported,
        storesFailed: failCount
      });
      
      setSyncProgress('');
      
      if (failCount === 0) {
        toast.success(`${successCount} stores synced successfully • ${totalImported} products imported`);
      } else {
        toast.warning(`${successCount} stores synced, ${failCount} failed • ${totalImported} products imported`);
      }
      
    } catch (error: any) {
      toast.error(`Sync process aborted: ${error.message}`);
      setSyncProgress('');
    } finally {
      setIsSyncingShopify(false);
    }
  };

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif tracking-tight">Catalog</h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/5 text-[10px] font-bold uppercase tracking-widest text-primary/40 border border-primary/10">
              Editorial View
            </span>
          </div>
          <p className="text-muted-foreground text-[11px] uppercase tracking-widest font-bold mt-2 opacity-50">Private Inventory Collection</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPDF} className="rounded-full">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button 
            variant="outline" 
            onClick={handleShopifySync} 
            disabled={isSyncingShopify} 
            className="rounded-full bg-[#f3fbf7] text-[#008060] border-[#008060]/20 hover:bg-[#e7f7ef] hover:text-[#005e46]"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isSyncingShopify && "animate-spin")} />
            {isSyncingShopify ? 'Syncing...' : 'Shopify Sync'}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setIsSettingsModalOpen(true)}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full shadow-lg shadow-primary/20" onClick={() => { 
                setEditingProduct(null);
                setImagePreview(null);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input id="name" name="name" defaultValue={editingProduct?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU / ID</Label>
                    <Input id="sku" name="sku" defaultValue={editingProduct?.sku} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select name="category" defaultValue={editingProduct?.category}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price ($)</Label>
                    <Input id="price" name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Initial Stock</Label>
                    <Input id="quantity" name="quantity" type="number" defaultValue={editingProduct?.quantity} disabled={!!editingProduct} required />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={loadingLocal}>
                    {loadingLocal ? 'Saving...' : 'Save Product'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(syncProgress || isSyncingShopify) && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Shopify Sync in Progress</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{syncProgress || 'Initializing...'}</p>
          </div>
        </div>
      )}

      {syncStats && !isSyncingShopify && (
        <div className={cn(
          "rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2",
          syncStats.storesFailed > 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"
        )}>
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center",
            syncStats.storesFailed > 0 ? "bg-amber-500/20" : "bg-emerald-500/20"
          )}>
            {syncStats.storesFailed > 0 ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <RefreshCw className="h-5 w-5 text-emerald-600" />}
          </div>
          <div>
            <h3 className={cn(
              "text-sm font-bold tracking-tight",
              syncStats.storesFailed > 0 ? "text-amber-700" : "text-emerald-700"
            )}>
              Sync Complete
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {syncStats.storesSynced} stores synced successfully {syncStats.storesFailed > 0 && `• ${syncStats.storesFailed} failed`} • {syncStats.productsImported} products imported
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, SKU, category, or store..." 
            className="pl-9 bg-background border-none shadow-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
            <SelectTrigger className="w-[180px] bg-background border-none shadow-none rounded-xl">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>Stock Sort</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="asc">Stock: Low to High</SelectItem>
              <SelectItem value="desc">Stock: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
        {filteredProducts.map((p) => {
          return (
            <div 
              key={p.id} 
              className="group cursor-pointer flex flex-col items-center text-center"
              onClick={() => {
                console.log("Opening product:", p.id);
                setSelectedProduct(p);
                setIsProductModalOpen(true);
              }}
            >
              <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden bg-muted mb-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] group-hover:-translate-y-2 border border-black/5">
                {p.imageUrl ? (
                  <img 
                    src={p.imageUrl} 
                    alt={p.name} 
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]" 
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/10" />
                  </div>
                )}
                
                {p.storeName && (
                  <div className="absolute top-6 right-6 z-10">
                    <div className="px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-[0.3em] backdrop-blur-xl bg-white/40 text-black/60 border border-white/40 shadow-sm">
                      {p.storeName}
                    </div>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-700" />
              </div>
              
              <div className="space-y-2 px-2 max-w-full">
                <h3 className="font-serif text-xl tracking-tight line-clamp-1 leading-tight group-hover:text-primary transition-colors duration-500">
                  {p.name}
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1px] w-4 bg-primary/20" />
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.4em] font-black">
                    {p.sku}
                  </p>
                  <div className="h-[1px] w-4 bg-primary/20" />
                </div>
              </div>
            </div>
          );
        })}

        {!loading && filteredProducts.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Box className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-xl font-semibold">No products found</p>
                <p className="text-muted-foreground">Try adjusting your search or sync from Shopify.</p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="aspect-[3/4] bg-muted animate-pulse rounded-2xl" />
              <div className="h-6 bg-muted animate-pulse rounded-lg w-3/4" />
              <div className="h-10 bg-muted animate-pulse rounded-xl w-full" />
            </div>
          ))
        )}
      </div>

      {/* Shopify Settings Modal */}
      <Dialog 
        open={isSettingsModalOpen} 
        onOpenChange={(open) => {
          setIsSettingsModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Box className="h-6 w-6 text-primary" />
              </div>
              Shopify Multi-Store Settings
            </DialogTitle>
            <DialogDescription>
              Connect unlimited Shopify stores. All products will be synced into your unified dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-8 py-4">
            
            {/* Connected Stores Dashboard */}
            {shopifySettings && shopifySettings.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Connected Stores</h3>
                  <Button 
                    onClick={() => handleShopifySync()}
                    disabled={isSyncingShopify}
                    size="sm"
                    className="rounded-full h-8 text-[10px] uppercase tracking-widest"
                  >
                    <RefreshCw className={cn("mr-2 h-3 w-3", isSyncingShopify && "animate-spin")} />
                    Sync All Stores
                  </Button>
                </div>
                
                <div className="grid gap-4">
                  {shopifySettings.map((store) => (
                    <div key={store.id} className="p-5 rounded-2xl border border-border/50 bg-muted/20 relative group">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="font-bold text-sm tracking-tight">{store.name}</h4>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                              store.status === 'FAILED' ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                              store.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}>
                              {store.status || 'PENDING'}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 opacity-70">
                            {store.domain}
                          </p>
                          
                          <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
                            <div className="flex flex-col gap-0.5">
                              <span className="uppercase tracking-widest opacity-50">Last Synced</span>
                              <span className="font-bold text-foreground/80">
                                {store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleString() : 'Never'}
                              </span>
                            </div>
                            <div className="w-[1px] h-6 bg-border" />
                            <div className="flex flex-col gap-0.5">
                              <span className="uppercase tracking-widest opacity-50">Products</span>
                              <span className="font-bold text-foreground/80">
                                {store.productsCount || 0} Imported
                              </span>
                            </div>
                          </div>
                          
                          {store.lastError && (
                            <div className="mt-3 text-[10px] text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="break-all">{store.lastError}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 items-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleShopifySync(store.id)}
                            disabled={isSyncingShopify}
                            className="h-7 text-[9px] uppercase tracking-widest rounded-full"
                          >
                            Sync This Store
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                              const newSettings = shopifySettings.filter(s => s.id !== store.id);
                              await saveShopifySettings(newSettings);
                              toast.success('Store removed');
                            }}
                            className="h-7 text-[9px] uppercase tracking-widest text-muted-foreground hover:text-destructive rounded-full"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Store Form */}
            <div className="space-y-4 pt-6 border-t border-border/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Add New Store</h3>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = formData.get('name') as string;
                  const domain = formData.get('domain') as string;
                  const token = formData.get('token') as string;
                  
                  if (!domain || !token) {
                    toast.error('Domain and Access Token are required');
                    return;
                  }
                  
                  setLoadingLocal(true);
                  try {
                    // Verify connection instantly
                    const isValid = await verifyShopifyConnection(domain, token);
                    if (!isValid) {
                      toast.error('Connection failed. Please check your domain and access token.');
                      setLoadingLocal(false);
                      return;
                    }
                    
                    const newStore: ShopifyStoreConfig = {
                      id: Date.now().toString(),
                      name: name || `Store ${shopifySettings.length + 1}`,
                      domain,
                      token,
                      status: 'PENDING',
                      connectedAt: new Date().toISOString()
                    };
                    
                    await saveShopifySettings([...shopifySettings, newStore]);
                    toast.success('Store connected successfully!');
                    (e.target as HTMLFormElement).reset();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setLoadingLocal(false);
                  }
                }}
                className="p-5 rounded-2xl border border-border/50 bg-background space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Store Name (Optional)</Label>
                    <Input name="name" placeholder="e.g. Primary Store" className="bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Shopify Domain</Label>
                    <Input name="domain" placeholder="your-store.myshopify.com" required className="bg-muted/30" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Admin API Access Token</Label>
                    <Input name="token" type="password" placeholder="shpat_..." required className="bg-muted/30" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={loadingLocal} className="rounded-full text-[10px] uppercase tracking-widest px-6 h-9">
                    {loadingLocal ? 'Verifying...' : 'Connect Store'}
                  </Button>
                </div>
              </form>
            </div>
            
          </div>
        </DialogContent>
      </Dialog>

      <ProductDetailsModal 
        product={selectedProduct}
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveStock}
        isSaving={isSaving}
      />

      {isScannerOpen && (
        <BarcodeScanner 
          onClose={() => setIsScannerOpen(false)} 
          onScan={(code) => {
            setSearchTerm(code);
            setIsScannerOpen(false);
            toast.success(`Scanned: ${code}`);
          }} 
        />
      )}
    </div>
  );
}

function Box(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
