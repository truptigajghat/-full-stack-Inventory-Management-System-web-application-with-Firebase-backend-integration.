import { Product, ShopifyStoreConfig } from '../types';

export const verifyShopifyConnection = async (domain: string, token: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/verify-shopify', {
      method: 'GET',
      headers: {
        'x-shopify-domain': domain,
        'x-shopify-token': token,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error verifying Shopify connection:', error);
    return false;
  }
};

export const fetchShopifyProducts = async (store: ShopifyStoreConfig): Promise<Product[]> => {
  let allProducts: Product[] = [];
  let pageInfo: string | null = null;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = new URL('/api/sync-shopify', window.location.origin);
      if (pageInfo) {
        url.searchParams.set('page_info', pageInfo);
      }

      console.log(`[Shopify Sync] Calling API proxy for store: ${store.name}${pageInfo ? ' (next page)' : ''}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-shopify-domain': store.domain,
          'x-shopify-token': store.token,
          'x-shopify-store-name': store.name,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      
      // Map the API results back to our local product type if needed, or use them as is
      // Note: api/sync-shopify already does some transformation
      const pageProducts = (data.products || []).map((p: any) => ({
        ...p,
        // Ensure we have a unique ID for local tracking
        id: `shopify_${store.id}_${p.sku || Math.random().toString(36).substr(2, 9)}`,
        updatedAt: new Date(),
        createdAt: new Date(),
      })) as Product[];

      allProducts = [...allProducts, ...pageProducts];
      pageInfo = data.nextPageInfo;
      hasMore = !!pageInfo;

      if (hasMore) {
        console.log(`[Shopify Sync] Page complete. Found cursor for next page.`);
      }
    }

    return allProducts;
  } catch (error: any) {
    console.error(`Error fetching products from ${store.name}:`, error);
    throw error;
  }
};
