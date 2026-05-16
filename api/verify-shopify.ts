export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-shopify-domain, x-shopify-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const domain = req.headers['x-shopify-domain'];
  const token = req.headers['x-shopify-token'];

  if (!domain || !token) {
    return res.status(400).json({ error: 'Missing domain or token' });
  }

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${cleanDomain}/admin/api/2024-01/shop.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
