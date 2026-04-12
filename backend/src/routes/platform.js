import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

/**
 * GET /api/platform/apps?rooftop_id=xxx
 * Returns all products in the ecosystem + which ones this tenant has access to.
 * Used by the app switcher in every frontend page.
 */
router.get('/apps', async (req, res) => {
  try {
    const { rooftop_id } = req.query;

    // Fetch all active products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order');

    if (prodErr) throw new Error(prodErr.message);

    // If rooftop_id provided, fetch their access
    let access = [];
    if (rooftop_id) {
      const { data: accessRows } = await supabase
        .from('product_access')
        .select('product_id, bundle_id, granted_at, expires_at')
        .eq('rooftop_id', rooftop_id)
        .is('expires_at', null)  // active only (null = no expiry)
        .or('expires_at.gt.' + new Date().toISOString());

      access = accessRows || [];
    }

    const accessMap = Object.fromEntries(
      access.map(a => [a.product_id, { bundle_id: a.bundle_id, granted_at: a.granted_at }])
    );

    // Build response: each product annotated with access status
    const apps = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      url: p.base_url,
      has_access: !!accessMap[p.id],
      bundle: accessMap[p.id]?.bundle_id || null,
    }));

    res.json({ apps, rooftop_id: rooftop_id || null });

  } catch (err) {
    console.error('[platform] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/platform/bundles
 * Returns all available pricing bundles.
 */
router.get('/bundles', async (req, res) => {
  try {
    const { data: bundles, error } = await supabase
      .from('bundles')
      .select('*')
      .order('sort_order');

    if (error) throw new Error(error.message);

    // Also fetch product details for each bundle
    const { data: products } = await supabase
      .from('products')
      .select('id, name, icon')
      .eq('active', true);

    const productMap = Object.fromEntries((products || []).map(p => [p.id, p]));

    const result = bundles.map(b => ({
      ...b,
      products: (b.product_ids || []).map(pid => productMap[pid]).filter(Boolean),
    }));

    res.json({ bundles: result });

  } catch (err) {
    console.error('[platform] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/platform/grant
 * Grant product access to a rooftop (called by Stripe webhook or admin).
 * Body: { rooftop_id, bundle_id }
 */
router.post('/grant', async (req, res) => {
  try {
    const { rooftop_id, bundle_id } = req.body;
    if (!rooftop_id || !bundle_id) {
      return res.status(400).json({ error: 'rooftop_id and bundle_id required' });
    }

    // Fetch the bundle to get product_ids
    const { data: bundle, error: bundleErr } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', bundle_id)
      .single();

    if (bundleErr || !bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Upsert access for each product in the bundle
    const grants = bundle.product_ids.map(product_id => ({
      rooftop_id,
      product_id,
      bundle_id,
      granted_at: new Date().toISOString(),
    }));

    const { error: accessErr } = await supabase
      .from('product_access')
      .upsert(grants, { onConflict: 'rooftop_id,product_id' });

    if (accessErr) throw new Error(accessErr.message);

    // Update rooftop plan
    await supabase.from('rooftops').update({ plan: bundle_id }).eq('id', rooftop_id);

    console.log(`[platform] Granted ${bundle_id} to rooftop ${rooftop_id} (${bundle.product_ids.join(', ')})`);

    res.json({
      granted: true,
      bundle: bundle_id,
      products: bundle.product_ids,
    });

  } catch (err) {
    console.error('[platform] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/platform/vehicle/:vin?rooftop_id=xxx
 * Returns the shared vehicle file for a VIN.
 */
router.get('/vehicle/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    const { rooftop_id } = req.query;

    if (!rooftop_id) return res.status(400).json({ error: 'rooftop_id required' });

    const { data: vehicle, error } = await supabase
      .from('vehicle_files')
      .select('*')
      .eq('vin', vin.toUpperCase())
      .eq('rooftop_id', rooftop_id)
      .single();

    if (error || !vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json({ vehicle });

  } catch (err) {
    console.error('[platform] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/platform/vehicle
 * Create or update a shared vehicle file.
 * Body: { rooftop_id, vin, year?, make?, model?, trim?, ... }
 */
router.post('/vehicle', async (req, res) => {
  try {
    const { rooftop_id, vin, ...fields } = req.body;

    if (!rooftop_id || !vin) {
      return res.status(400).json({ error: 'rooftop_id and vin required' });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicle_files')
      .upsert({
        rooftop_id,
        vin: vin.toUpperCase(),
        ...fields,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'rooftop_id,vin' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.json({ vehicle });

  } catch (err) {
    console.error('[platform] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
