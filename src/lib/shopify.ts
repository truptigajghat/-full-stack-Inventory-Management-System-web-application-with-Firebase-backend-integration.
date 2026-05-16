import { Product, ProductVariant, ShopifyStoreConfig } from '../types';

export const verifyShopifyConnection = async (domain: string, token: string): Promise<boolean> => {
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${cleanDomain}/admin/api/2024-01/shop.json`;
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying Shopify connection:', error);
    return false;
  }
};

export const fetchShopifyProducts = async (store: ShopifyStoreConfig): Promise<Product[]> => {
  let allProducts: any[] = [];
  let hasNextPage = true;
  let pageInfo = '';

  const cleanDomain = store.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    let currentUrl = `https://${cleanDomain}/admin/api/2024-01/products.json?limit=50&status=active`;

    while (currentUrl) {
      if (allProducts.length > 0) {
        // Wait 1.5 seconds between pages to prevent rate limiting from free CORS proxies
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Use api.codetabs.com which is significantly more stable for long URLs and doesn't rate limit as aggressively
      const proxiedUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(currentUrl.trim())}`;
      
      console.log(`[Shopify Sync] Fetching page ${allProducts.length / 50 + 1}...`);
      console.log(`[Shopify Sync] Original URL: ${currentUrl}`);
      
      let response;
      let retries = 3;
      
      while (retries > 0) {
        try {
          response = await fetch(proxiedUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': store.token,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
          });
          if (response.ok) break;
          console.warn(`[Shopify Sync] Proxy returned status ${response.status}. Retrying...`);
          if (response.status === 429 || response.status >= 500) {
            retries--;
            if (retries === 0) throw new Error(`Shopify API responded with status ${response.status}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`Shopify API responded with status ${response.status}`);
        } catch (e: any) {
          console.error(`[Shopify Sync] Fetch error: ${e.message}. Retrying...`);
          retries--;
          if (retries === 0) throw e;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Shopify API failed after retries`);
      }

      const data = await response.json();
      allProducts = [...allProducts, ...data.products];

      // Parse pagination link header
      currentUrl = '';
      const linkHeader = response.headers.get('Link') || response.headers.get('link');
      if (linkHeader) {
        const links = linkHeader.split(',');
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match = link.match(/<([^>]+)>/);
            if (match && match[1]) {
              currentUrl = match[1];
            }
          }
        }
      }
    }

    // Map to StockPro Product type
    const mappedProducts: Product[] = allProducts.map((p: any) => {
      let totalQty = 0;
      const variants: ProductVariant[] = p.variants.map((v: any) => {
        totalQty += v.inventory_quantity || 0;
        return {
          id: v.id.toString(),
          title: v.title,
          sku: v.sku || '',
          price: parseFloat(v.price || 0),
          quantity: v.inventory_quantity || 0,
        };
      });

      return {
        id: `shopify_${store.id}_${p.id}`,
        name: p.title,
        sku: p.variants?.[0]?.sku || '',
        description: p.body_html?.replace(/<[^>]+>/g, '') || '', // Strip basic HTML
        price: parseFloat(p.variants?.[0]?.price || 0),
        quantity: totalQty,
        minQuantity: 5,
        category: p.product_type || 'Uncategorized',
        imageUrl: p.images?.[0]?.src || '',
        userId: '', // Set later when saving
        createdAt: new Date(),
        updatedAt: new Date(),
        storeName: store.name,
        storeDomain: cleanDomain,
        source: 'Shopify',
        variants,
      };
    });

    return mappedProducts;
  } catch (error: any) {
    console.error(`Error fetching products from ${store.name}:`, error);
    throw error;
  }
};
