import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// Fields returned in tenant config (no secrets)
const TENANT_FIELDS = `
  id, name, dealer_group, plan, active,
  logo_url, brand_color, secondary_color,
  website, phone, email, address, city, state, zip,
  trade_url, sms_greeting, sms_signature,
  onboarded, onboarded_at, onboard_step,
  source, autocurb_tenant_id, created_at
`;

/**
 * GET /api/tenant/:id
 * Returns full tenant config for a rooftop.
 * Used by all frontend pages to load branding.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: rooftop, error } = await supabase
      .from('rooftops')
      .select(TENANT_FIELDS)
      .eq('id', id)
      .single();

    if (error || !rooftop) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Also fetch reps for this rooftop
    const { data: reps } = await supabase
      .from('reps')
      .select('id, name, nickname, title, email, photo_url, onboarded')
      .eq('rooftop_id', id)
      .order('created_at', { ascending: true });

    res.json({ tenant: rooftop, reps: reps || [] });

  } catch (err) {
    console.error('[tenant] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tenant/by-slug/:slug
 * Look up tenant by website domain (for subdomain routing).
 */
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: rooftop, error } = await supabase
      .from('rooftops')
      .select(TENANT_FIELDS)
      .or(`website.eq.${slug},website.eq.www.${slug}`)
      .single();

    if (error || !rooftop) {
      return res.status(404).json({ error: 'Tenant not found for domain' });
    }

    res.json({ tenant: rooftop });

  } catch (err) {
    console.error('[tenant] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
