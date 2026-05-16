export interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  price: number;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  quantity: number;
  minQuantity: number;
  category: string;
  imageUrl?: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  // Multi-store tracking
  storeName?: string;
  storeDomain?: string;
  variantId?: string;
  source?: string;
  variants?: ProductVariant[];
}

export interface ShopifyStoreConfig {
  id: string;
  name: string;
  domain: string;
  token: string;
  color?: string;
  status?: 'ACTIVE' | 'FAILED' | 'PENDING';
  connectedAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
  productsCount?: number;
}

export interface Category {
  id: string;
  name: string;
  userId: string;
}

export interface Transaction {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  userId: string;
  note?: string;
  createdAt: any;
}

export interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  outOfStockItems: number;
}
