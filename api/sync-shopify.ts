export default async function handler(req: any, res: any) {
  // Allow CORS for local development if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const SHOPIFY_STORE_DOMAIN = req.headers['x-shopify-domain'];
  const SHOPIFY_ACCESS_TOKEN = req.headers['x-shopify-token'];
  const PAGE_INFO = req.query.page_info;

  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    return res.status(400).json({ 
      error: 'Missing Shopify credentials in request headers (x-shopify-domain, x-shopify-token).' 
    });
  }

  try {
    let url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json?limit=250&status=active`;
    
    // If page_info is provided, we must only use page_info and limit
    if (PAGE_INFO) {
      url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json?limit=250&page_info=${PAGE_INFO}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN as string,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const products = (data.products || []).filter((p: any) => {
      const title = (p.title || '').toLowerCase();
      // Filter out non-inventory items commonly used in Shopify
      return !title.includes('partial payment') && 
             !title.includes('deposit') && 
             !title.includes('shipping fee') &&
             !title.includes('gift card');
    });
    
    // Parse Link header for next page info
    const linkHeader = response.headers.get('Link') || response.headers.get('link');
    let nextPageInfo = null;
    
    if (linkHeader) {
      const parts = linkHeader.split(',');
      for (const part of parts) {
        if (part.includes('rel="next"')) {
          const urlMatch = part.match(/<([^>]+)>/);
          if (urlMatch) {
            try {
              const nextUrl = new URL(urlMatch[1]);
              nextPageInfo = nextUrl.searchParams.get('page_info');
            } catch (e) {
              // Fallback to regex if URL parsing fails
              const match = urlMatch[1].match(/page_info=([^&>]+)/);
              if (match) nextPageInfo = match[1];
            }
          }
        }
      }
    }

    // Transform Shopify products into base items (no variants) to prevent duplicates
    const transformedProducts: any[] = [];
    const storeName = req.headers['x-shopify-store-name'] as string || 'Unknown Store';
    
    for (const p of products) {
      // Use the first variant for price/sku, or fallback
      const defaultVariant = p.variants?.[0] || {};
      
      transformedProducts.push({
        name: p.title,
        sku: defaultVariant.sku || `SHOPIFY-${p.id}`,
        description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '') : '',
        price: parseFloat(defaultVariant.price || '0'),
        quantity: 0, // Stock managed in Firebase
        minQuantity: 5,
        category: p.product_type || 'Uncategorized',
        imageUrl: p.image?.src || p.images?.[0]?.src || '',
        storeName: storeName,
        storeDomain: SHOPIFY_STORE_DOMAIN,
        // We keep the default variant ID so it matches the first synced variant and preserves its stock
        variantId: defaultVariant.id?.toString() || p.id.toString(),
        source: 'shopify',
      });
    }

    return res.status(200).json({ 
      products: transformedProducts,
      nextPageInfo
    });
    
  } catch (error: any) {
    console.error('Error fetching from Shopify:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
