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
import { Product } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '../lib/utils';

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

  const getProductStock = (p: any) => {
    const currentVariantId = selectedVariants[p.id] || p.variants?.[0]?.id;
    const currentVariant = p.variants?.find((v: any) => v.id === currentVariantId) || null;
    const stockKey = currentVariant ? `${p.id}_${currentVariant.id}` : p.id;
    return stockChanges[stockKey] !== undefined ? stockChanges[stockKey] : (currentVariant?.quantity ?? p.quantity);
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.storeName || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (sortOrder === 'asc') return getProductStock(a) - getProductStock(b);
    if (sortOrder === 'desc') return getProductStock(b) - getProductStock(a);
    return 0;
  });

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
      setSelectedFile(null);
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

  const handleSaveAllChanges = async () => {
    const changeIds = Object.keys(stockChanges);
    if (changeIds.length === 0) return;

    setIsSaving(true);
    try {
      // Group changes by productId to avoid race conditions when updating variants
      const changesByProduct: Record<string, { quantity?: number, variants?: Record<string, number> }> = {};
      
      for (const key of changeIds) {
        const [productId, variantId] = key.split('_');
        if (!changesByProduct[productId]) changesByProduct[productId] = {};
        
        if (variantId) {
          if (!changesByProduct[productId].variants) changesByProduct[productId].variants = {};
          changesByProduct[productId].variants![variantId] = Number(stockChanges[key]) || 0;
        } else {
          changesByProduct[productId].quantity = Number(stockChanges[key]) || 0;
        }
      }

      for (const productId of Object.keys(changesByProduct)) {
        const changes = changesByProduct[productId];
        const product = products.find(p => p.id === productId);
        if (!product) continue;

        const updates: Partial<Product> = {};
        if (changes.quantity !== undefined) {
          updates.quantity = changes.quantity;
        }
        if (changes.variants && product.variants) {
          updates.variants = product.variants.map(v => 
            changes.variants![v.id] !== undefined 
              ? { ...v, quantity: changes.variants![v.id] } 
              : v
          );
        }
        await updateProduct(productId, updates);
      }
      setStockChanges({});
      toast.success('Stock updated successfully');
    } catch (error: any) {
      toast.error('Failed to save changes: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShopifySync = async () => {
    if (!shopifySettings || shopifySettings.length === 0) {
      toast.error('Please configure at least one Shopify store first.');
      setIsSettingsModalOpen(true);
      return;
    }

    setIsSyncingShopify(true);
    let totalAdded = 0;
    let totalUpdated = 0;
    const syncedIds = new Set();

    try {
      // Sync each store one by one
      for (const store of shopifySettings) {
        if (!store.domain || !store.token) continue;
        
        toast.info(`Syncing from ${store.name || store.domain}...`);
        let nextPageInfo = null;
        let storeSyncedCount = 0;

        do {
          const url = `/api/sync-shopify?${nextPageInfo ? `page_info=${encodeURIComponent(nextPageInfo)}` : ''}`;
          const response = await fetch(url, {
            headers: {
              'x-shopify-domain': store.domain,
              'x-shopify-token': store.token,
              'x-shopify-store-name': store.name || 'Store'
            }
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`[${store.name}] ${errData.error || 'Sync failed'}`);
          }

          const data = await response.json();
          const shopifyProducts = data.products || [];
          nextPageInfo = data.nextPageInfo;
          storeSyncedCount += shopifyProducts.length;

          if (shopifyProducts.length > 0) {
            // Process products in batches
            const batchSize = 10;
            for (let i = 0; i < shopifyProducts.length; i += batchSize) {
              const chunk = shopifyProducts.slice(i, i + batchSize);
              await Promise.all(chunk.map(async (sp: any) => {
                // Find existing by storeDomain + variantId OR SKU
                const existingProduct = products.find(p => 
                  (p.storeDomain === sp.storeDomain && p.variantId === sp.variantId) || 
                  p.sku === sp.sku
                );
                
                if (existingProduct) {
                  await updateProduct(existingProduct.id, {
                    name: sp.name,
                    sku: sp.sku,
                    imageUrl: sp.imageUrl || existingProduct.imageUrl,
                    storeName: sp.storeName,
                    storeDomain: sp.storeDomain,
                    variantId: sp.variantId,
                    variants: sp.variants ? sp.variants.map((v: any) => {
                      const existingV = existingProduct.variants?.find(ev => ev.id === v.id);
                      return { ...v, quantity: existingV ? existingV.quantity : 0 };
                    }) : [],
                    source: 'shopify'
                  });
                  syncedIds.add(existingProduct.id);
                  totalUpdated++;
                } else {
                  const newId = await addProduct({
                    ...sp,
                    quantity: 0
                  });
                  if (newId) syncedIds.add(newId);
                  totalAdded++;
                }
              }));
            }
          }
        } while (nextPageInfo);
        
        toast.success(`Finished syncing ${storeSyncedCount} items from ${store.name}`);
      }

      // EXHAUSTIVE CLEANUP: Delete any Shopify products that were not in THIS sync session
      const productsToDelete = products.filter(p => 
        (p.source === 'shopify' || (p.sku && p.sku.startsWith('SHOPIFY-'))) && 
        !syncedIds.has(p.id)
      );
      
      if (productsToDelete.length > 0) {
        toast.info(`Cleaning up ${productsToDelete.length} removed variants...`);
        for (let i = 0; i < productsToDelete.length; i += 5) {
          const chunk = productsToDelete.slice(i, i + 5);
          await Promise.all(chunk.map(p => deleteProduct(p.id)));
        }
      }

      toast.success(`Full sync complete! Total: ${totalAdded} new, ${totalUpdated} updated.`);
    } catch (error: any) {
      toast.error(`Sync aborted: ${error.message}`);
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
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your inventory items and stock levels.</p>
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
            onClick={handleSaveAllChanges} 
            disabled={isSaving || Object.keys(stockChanges).length === 0}
            className="rounded-full shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'SAVE'}
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
                setSelectedFile(null);
                setImagePreview(null);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? 'Update product details and stock information.' : 'Enter the details for your new inventory item.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input id="name" name="name" defaultValue={editingProduct?.name} placeholder="e.g. Wireless Mouse" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU / ID</Label>
                    <Input id="sku" name="sku" defaultValue={editingProduct?.sku} placeholder="WM-001" required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category">Category</Label>
                      {categories.length === 0 && (
                        <Link to="/categories" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                          <Plus className="h-2 w-2" /> Add New
                        </Link>
                      )}
                    </div>
                    <Select name="category" defaultValue={editingProduct?.category}>
                      <SelectTrigger>
                        <SelectValue placeholder={categories.length === 0 ? "No categories found" : "Select Category"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                        {categories.length === 0 && (
                          <div className="p-2 text-xs text-center text-muted-foreground">
                            Go to Categories page to add some!
                          </div>
                        )}
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
                  <div className="space-y-2">
                    <Label htmlFor="minQuantity">Min. Stock Alert</Label>
                    <Input id="minQuantity" name="minQuantity" type="number" defaultValue={editingProduct?.minQuantity} required />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="image">Product Image</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/25">
                        {imagePreview || editingProduct?.imageUrl ? (
                          <img 
                            src={imagePreview || editingProduct?.imageUrl} 
                            alt="Preview" 
                            className="h-full w-full object-cover" 
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Input 
                          id="image" 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedFile(file);
                              const reader = new FileReader();
                              reader.onloadend = () => setImagePreview(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="cursor-pointer"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Recommended: Square image, max 2MB
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" defaultValue={editingProduct?.description} />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
        {filteredProducts.map((p) => {
          const currentVariantId = selectedVariants[p.id] || p.variants?.[0]?.id;
          const currentVariant = p.variants?.find(v => v.id === currentVariantId) || null;
          const stockKey = currentVariant ? `${p.id}_${currentVariant.id}` : p.id;
          
          const currentStock = stockChanges[stockKey] !== undefined ? stockChanges[stockKey] : (currentVariant?.quantity ?? p.quantity);
          const isLowStock = currentStock > 0 && currentStock <= p.minQuantity;
          const isOutOfStock = currentStock === 0;

          return (
            <Card key={p.id} className="group border-none shadow-none bg-transparent overflow-hidden flex flex-col">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted mb-4 shadow-sm group-hover:shadow-2xl transition-all duration-500 border border-muted/50">
                {p.imageUrl ? (
                  <img 
                    src={p.imageUrl} 
                    alt={p.name} 
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                  </div>
                )}
                
                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase backdrop-blur-md shadow-sm border border-white/20",
                    isOutOfStock ? "bg-rose-500/80 text-white" : 
                    isLowStock ? "bg-amber-500/80 text-white" : 
                    "bg-emerald-500/80 text-white"
                  )}>
                    {isOutOfStock ? "Sold Out" : isLowStock ? "Low Stock" : "In Stock"}
                  </div>
                  {p.storeName && (
                    <div className={cn(
                      "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter backdrop-blur-md shadow-sm border border-white/10 text-white",
                      p.storeName.includes('1') ? "bg-blue-600/70" :
                      p.storeName.includes('2') ? "bg-purple-600/70" :
                      p.storeName.includes('3') ? "bg-orange-600/70" :
                      "bg-indigo-600/70"
                    )}>
                      {p.storeName}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4 px-1">
                <div>
                  <h3 className="font-semibold text-lg line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium mt-1.5">
                    {currentVariant?.sku || p.sku}
                  </p>

                  {p.variants && p.variants.length > 0 && (
                    <div className="mt-3">
                      <Select
                        value={currentVariantId}
                        onValueChange={(val: any) => setSelectedVariants(prev => ({...prev, [p.id]: val}))}
                      >
                        <SelectTrigger className="h-7 text-xs bg-muted/30 border-muted-foreground/20 shadow-none rounded-md px-2 focus:ring-1 focus:ring-primary/30">
                          <SelectValue placeholder="Select Size" />
                        </SelectTrigger>
                        <SelectContent>
                          {p.variants.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              {v.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-muted/50">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Stock Units
                  </span>
                  <div className="relative w-24">
                    <Input 
                      type="number" 
                      value={currentStock}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStockChanges(prev => ({ ...prev, [stockKey]: val === '' ? '' : Number(val) }));
                      }}
                      className={cn(
                        "h-10 text-right font-bold bg-muted/40 border-none shadow-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
                        isOutOfStock && currentStock !== '' ? "text-rose-500" : 
                        isLowStock && currentStock !== '' ? "text-amber-500" : "text-foreground"
                      )}
                    />
                  </div>
                </div>
              </div>
            </Card>
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
          if (open) {
            setEditedStores(
              shopifySettings.length > 0 
                ? shopifySettings.map((s, i) => ({ ...s, _key: Date.now() + i }))
                : [{ _key: Date.now() }]
            );
          }
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
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const stores: any[] = [];
              
              for (let i = 0; i < editedStores.length; i++) {
                const name = formData.get(`name_${i}`) as string;
                const domain = formData.get(`domain_${i}`) as string;
                const token = formData.get(`token_${i}`) as string;
                
                if (domain && token) {
                  stores.push({
                    id: (i + 1).toString(),
                    name: name || `Store ${i + 1}`,
                    domain,
                    token
                  });
                }
              }
              
              if (stores.length === 0) {
                toast.error('At least one store must be configured');
                return;
              }
              
              setLoadingLocal(true);
              try {
                await saveShopifySettings(stores);
                toast.success(`${stores.length} store(s) connected successfully`);
                setIsSettingsModalOpen(false);
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setLoadingLocal(false);
              }
            }} 
            className="space-y-6 py-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {editedStores.map((store, i) => {
                return (
                  <div key={store._key} className="relative p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10 space-y-4 group">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        Store {i + 1}
                        {store.domain && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                      </h4>
                      {editedStores.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const newStores = [...editedStores];
                            newStores.splice(i, 1);
                            setEditedStores(newStores);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Store Name</Label>
                      <Input 
                        name={`name_${i}`} 
                        placeholder={`Saree Palace ${i + 1}`} 
                        defaultValue={store?.name}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Domain</Label>
                      <Input 
                        name={`domain_${i}`} 
                        placeholder="store.myshopify.com" 
                        defaultValue={store?.domain}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Access Token</Label>
                      <Input 
                        name={`token_${i}`} 
                        type="password"
                        placeholder="shpat_..." 
                        defaultValue={store?.token}
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center mt-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                className="rounded-full text-xs font-medium border-dashed border-2 hover:border-primary hover:text-primary transition-colors"
                onClick={() => setEditedStores([...editedStores, { _key: Date.now() }])}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Another Store
              </Button>
            </div>

            <DialogFooter className="mt-8 border-t pt-6">
              <Button type="button" variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loadingLocal} className="rounded-xl px-8">
                {loadingLocal ? 'Connecting...' : 'Save All Stores'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
