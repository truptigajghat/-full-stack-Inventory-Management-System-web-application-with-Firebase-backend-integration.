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
    const products = data.products || [];
    
    // Parse Link header for next page info
    const linkHeader = response.headers.get('Link') || response.headers.get('link');
    let nextPageInfo = null;
    
    if (linkHeader) {
      const parts = linkHeader.split(',');
      for (const part of parts) {
        if (part.includes('rel="next"')) {
          const match = part.match(/page_info=([^&>]+)/);
          if (match) nextPageInfo = match[1];
        }
      }
    }

    // Transform variants
    const transformedProducts: any[] = [];
    for (const p of products) {
      const variants = p.variants || [];
      for (const variant of variants) {
        const variantImage = p.images?.find((img: any) => img.variant_ids?.includes(variant.id))?.src || p.image?.src || '';
        
        transformedProducts.push({
          name: variant.title === 'Default Title' ? p.title : `${p.title} - ${variant.title}`,
          sku: variant.sku || `SHOPIFY-${p.id}-${variant.id}`,
          description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '') : '',
          price: parseFloat(variant.price || '0'),
          quantity: 0,
          minQuantity: 5,
          category: p.product_type || 'Uncategorized',
          imageUrl: variantImage,
        });
      }
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
