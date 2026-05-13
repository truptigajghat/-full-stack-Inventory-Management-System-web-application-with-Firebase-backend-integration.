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
  const [stockChanges, setStockChanges] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      for (const id of changeIds) {
        const newQuantity = stockChanges[id];
        await updateProduct(id, { quantity: newQuantity });
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
    if (!shopifySettings?.domain || !shopifySettings?.token) {
      toast.error('Please configure your Shopify settings first.');
      setIsSettingsModalOpen(true);
      return;
    }

    setIsSyncingShopify(true);
    let added = 0;
    let updated = 0;
    let totalSynced = 0;
    let nextPageInfo = null;
    const syncedIds = new Set();
    const processedNames = new Set();

    try {
      do {
        const url = `/api/sync-shopify${nextPageInfo ? `?page_info=${encodeURIComponent(nextPageInfo)}` : ''}`;
        const response = await fetch(url, {
          headers: {
            'x-shopify-domain': shopifySettings.domain,
            'x-shopify-token': shopifySettings.token
          }
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch from Shopify');
        }

        const data = await response.json();
        const shopifyProducts = data.products || [];
        nextPageInfo = data.nextPageInfo;
        totalSynced += shopifyProducts.length;

        if (shopifyProducts.length > 0) {
          toast.info(`Consolidating unique products... (${totalSynced} items)`);
          
          const batchSize = 5;
          for (let i = 0; i < shopifyProducts.length; i += batchSize) {
            const chunk = shopifyProducts.slice(i, i + batchSize);
            await Promise.all(chunk.map(async (sp: any) => {
              if (processedNames.has(sp.name)) return;
              processedNames.add(sp.name);

              // AGGRESSIVE MATCHING: Find ANY product that starts with this name
              // This catches "Saree - Red", "Saree - Blue", etc. and merges them.
              const matches = products.filter(p => 
                p.name === sp.name || 
                p.name.startsWith(sp.name) || 
                sp.name.startsWith(p.name)
              );
              
              if (matches.length > 0) {
                // Keep the first match, update it to the parent info
                const primary = matches[0];
                await updateProduct(primary.id, {
                  ...sp,
                  quantity: primary.quantity, // Keep their stock
                  source: 'shopify'
                });
                syncedIds.add(primary.id);
                
                // DELETE ALL OTHER MATCHES (these are the duplicates/variants)
                const others = matches.slice(1);
                for (const extra of others) {
                  await deleteProduct(extra.id);
                }
              } else {
                // Brand new product
                const newId = await addProduct({
                  ...sp,
                  quantity: 0
                });
                if (newId) syncedIds.add(newId);
              }
            }));
          }
        }
      } while (nextPageInfo);
      
      toast.success(`Full sync complete! Total unique products: ${syncedIds.size}`);
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
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
            placeholder="Search by name, SKU, or category..." 
            className="pl-9 bg-background border-none shadow-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="rounded-xl">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
        {filteredProducts.map((p) => {
          const currentStock = stockChanges[p.id] !== undefined ? stockChanges[p.id] : p.quantity;
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
                
                <div className="absolute top-4 right-4">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase backdrop-blur-md shadow-sm border border-white/20",
                    isOutOfStock ? "bg-rose-500/80 text-white" : 
                    isLowStock ? "bg-amber-500/80 text-white" : 
                    "bg-emerald-500/80 text-white"
                  )}>
                    {isOutOfStock ? "Sold Out" : isLowStock ? "Low Stock" : "In Stock"}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 px-1">
                <div>
                  <h3 className="font-semibold text-lg line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium mt-1.5">
                    {p.sku}
                  </p>
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
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setStockChanges(prev => ({ ...prev, [p.id]: val }));
                        }
                      }}
                      className={cn(
                        "h-10 text-right font-bold bg-muted/40 border-none shadow-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
                        isOutOfStock ? "text-rose-500" : 
                        isLowStock ? "text-amber-500" : "text-foreground"
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
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Shopify Integration Settings</DialogTitle>
            <DialogDescription>
              Enter your Shopify store details to enable product syncing.
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const domain = formData.get('domain') as string;
              const token = formData.get('token') as string;
              
              if (!domain || !token) {
                toast.error('Both fields are required');
                return;
              }
              
              setLoadingLocal(true);
              try {
                await saveShopifySettings(domain, token);
                toast.success('Shopify settings saved');
                setIsSettingsModalOpen(false);
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setLoadingLocal(false);
              }
            }} 
            className="space-y-4 py-4"
          >
            <div className="space-y-2">
              <Label htmlFor="domain">Shopify Store Domain</Label>
              <Input 
                id="domain" 
                name="domain" 
                placeholder="your-store.myshopify.com" 
                defaultValue={shopifySettings?.domain}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">Admin API Access Token</Label>
              <Input 
                id="token" 
                name="token" 
                type="password"
                placeholder="shpat_..." 
                defaultValue={shopifySettings?.token}
                required 
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loadingLocal}>
                {loadingLocal ? 'Saving...' : 'Save Settings'}
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
