import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Category, Transaction, ShopifyStoreConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export function useInventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shopifySettings, setShopifySettings] = useState<ShopifyStoreConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setCategories([]);
      setTransactions([]);
      setShopifySettings([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const productsQuery = query(
      collection(db, 'products'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const categoriesQuery = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid)
    );

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      setProducts(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      setLoading(false);
      setError(err.message);
      console.error('Products query error:', err);
    });

    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(data);
    }, (err) => {
      console.error('Categories query error:', err);
    });

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    }, (err) => {
      console.error('Transactions query error:', err);
    });

    const unsubShopifySettings = onSnapshot(doc(db, 'user_settings', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Fallback for legacy single-store settings if they exist
        if (data.shopifyDomain && !data.stores) {
          setShopifySettings([{
            id: '1',
            name: 'Primary Store',
            domain: data.shopifyDomain,
            token: data.shopifyAccessToken,
            color: 'blue'
          }]);
        } else if (data.stores) {
          setShopifySettings(data.stores);
        } else {
          setShopifySettings([]);
        }
      } else {
        setShopifySettings([]);
      }
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubTransactions();
      unsubShopifySettings();
    };
  }, [user]);

  const addProduct = async (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'products'), {
        ...product,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
    }
  };

  const adjustStock = async (productId: string, quantityChange: number, type: 'IN' | 'OUT' | 'ADJUSTMENT', note?: string) => {
    if (!user) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newQuantity = product.quantity + quantityChange;
    if (newQuantity < 0) throw new Error('Stock cannot be negative');

    try {
      // Record transaction
      await addDoc(collection(db, 'transactions'), {
        productId,
        type,
        quantity: quantityChange,
        previousQuantity: product.quantity,
        newQuantity,
        userId: user.uid,
        note,
        createdAt: serverTimestamp(),
      });

      // Update product quantity
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        quantity: newQuantity,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions_and_products`);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const addCategory = async (name: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name,
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  const uploadImage = async (file: File) => {
    if (!user) return null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'jb2vsvny');
      formData.append('cloud_name', 'dd2gxxwqy');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/dd2gxxwqy/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Failed to upload image to Cloudinary');
    }
  };

  return {
    products,
    categories,
    transactions,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    addCategory,
    deleteCategory,
    uploadImage,
    saveShopifySettings: async (stores: ShopifyStoreConfig[]) => {
      if (!user) return;
      try {
        await setDoc(doc(db, 'user_settings', user.uid), {
          stores,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `user_settings/${user.uid}`);
      }
    },
    shopifySettings,
    error
  };
}
