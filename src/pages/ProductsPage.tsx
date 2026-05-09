import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { 
  Plus,
  Download, 
  Search, 
  Filter,
  LayoutGrid, 
  List as ListIcon, 
  MoreHorizontal, 
  Trash2, 
  Edit, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Product } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { StockActionModal } from '../components/inventory/StockActionModal';
import { cn } from '../lib/utils';

export default function ProductsPage() {
  const { products, categories, addProduct, updateProduct, deleteProduct, uploadImage, loading, error } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
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

      <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((p) => {
              const isLowStock = p.quantity > 0 && p.quantity <= p.minQuantity;
              const isOutOfStock = p.quantity === 0;
              
              return (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground uppercase">{p.sku}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">{p.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-semibold",
                      isOutOfStock ? "text-rose-500" : isLowStock ? "text-amber-500" : ""
                    )}>
                      {p.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">${p.price.toFixed(2)}</TableCell>
                  <TableCell>
                    {isOutOfStock ? (
                      <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-none">Out of Stock</Badge>
                    ) : isLowStock ? (
                      <Badge className="bg-amber-500/10 text-amber-500 border-none shadow-none">Low Stock</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-[100px]">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setStockModalProduct(p)}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteProduct(p.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-muted rounded-full">
                      <Box className="h-6 w-6" />
                    </div>
                    <p>No products found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {loading && (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><div className="h-12 bg-muted animate-pulse rounded-lg w-full" /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <StockActionModal 
        product={stockModalProduct}
        isOpen={!!stockModalProduct}
        onClose={() => setStockModalProduct(null)}
      />
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
