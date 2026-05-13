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

  const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    return res.status(500).json({ 
      error: 'Missing Shopify configuration. Please check environment variables.' 
    });
  }

  try {
    // Make request to Shopify Admin REST API
    const response = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Transform Shopify products to match our app's Product format
    const transformedProducts = data.products.map((p: any) => {
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
