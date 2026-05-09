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
