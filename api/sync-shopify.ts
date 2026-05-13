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

  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    return res.status(400).json({ 
      error: 'Missing Shopify credentials in request headers (x-shopify-domain, x-shopify-token).' 
    });
  }

  try {
    let allProducts: any[] = [];
    let url: string | null = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json?limit=250&status=active`;

    while (url) {
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
      allProducts = [...allProducts, ...data.products];

      // Check for next page using Link header
      const linkHeader = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }
    }
    
    // Transform Shopify products to match our app's Product format
    const transformedProducts = allProducts.map((p: any) => {
      // Get the first variant for price and quantity
      const firstVariant = p.variants?.[0] || {};
      
      return {
        name: p.title,
        sku: firstVariant.sku || `SHOPIFY-${p.id}`,
        description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '') : '', // strip HTML tags
        price: parseFloat(firstVariant.price || '0'),
        quantity: firstVariant.inventory_quantity || 0,
        minQuantity: 5, // default
        category: p.product_type || 'Uncategorized',
        imageUrl: p.image?.src || '',
      };
    });

    return res.status(200).json({ products: transformedProducts });
    
  } catch (error: any) {
    console.error('Error fetching from Shopify:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
