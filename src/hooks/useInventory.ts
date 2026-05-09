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
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Product, Category, Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export function useInventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setCategories([]);
      setTransactions([]);
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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    return () => {
      unsubProducts();
      unsubCategories();
      unsubTransactions();
    };
  }, [user]);

  const addProduct = async (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'products'), {
        ...product,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
      const storageRef = ref(storage, `products/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
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
    uploadImage
  };
}
