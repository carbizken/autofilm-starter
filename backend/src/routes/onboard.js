import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

/**
 * POST /api/onboard
 * Creates a new tenant (rooftop) or updates onboarding progress.
 * Body: { step, data }
 *
 * Steps:
 *   0 → Create rooftop: { name, dealer_group?, source }
 *   1 → Business info: { rooftop_id, website, phone, email, address, city, state, zip }
 *   2 → Branding: { rooftop_id, brand_color, secondary_color?, logo_url? }
 *   3 → Product config: { rooftop_id, trade_url?, sms_greeting?, sms_signature? }
 *   4 → First rep: { rooftop_id, rep_name, rep_email, rep_title? }
 *   5 → Complete: { rooftop_id }
 */
router.post('/', async (req, res) => {
  try {
    const { step, data } = req.body;

    if (step === undefined || !data) {
      return res.status(400).json({ error: 'step and data required' });
    }

    switch (step) {
      // ── Step 0: Create the rooftop ─────────────────────
      case 0: {
        if (!data.name) return res.status(400).json({ error: 'Dealer name required' });

        const { data: rooftop, error } = await supabase
          .from('rooftops')
          .insert({
            name: data.name,
            dealer_group: data.dealer_group || null,
            source: data.source || 'autofilm',
            onboard_step: 1,
          })
          .select()
          .single();

        if (error) throw new Error(`Create failed: ${error.message}`);
        console.log(`[onboard] Step 0 — created rooftop ${rooftop.id}: ${data.name}`);
        return res.json({ rooftop_id: rooftop.id, step: 1 });
      }

      // ── Step 1: Business info ──────────────────────────
      case 1: {
        if (!data.rooftop_id) return res.status(400).json({ error: 'rooftop_id required' });

        const { error } = await supabase
          .from('rooftops')
          .update({
            website: data.website || null,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip: data.zip || null,
            onboard_step: 2,
          })
          .eq('id', data.rooftop_id);

        if (error) throw new Error(`Update failed: ${error.message}`);
        console.log(`[onboard] Step 1 — business info for ${data.rooftop_id}`);
        return res.json({ rooftop_id: data.rooftop_id, step: 2 });
      }

      // ── Step 2: Branding ───────────────────────────────
      case 2: {
        if (!data.rooftop_id) return res.status(400).json({ error: 'rooftop_id required' });

        const { error } = await supabase
          .from('rooftops')
          .update({
            brand_color: data.brand_color || '#D94F00',
            secondary_color: data.secondary_color || null,
            logo_url: data.logo_url || null,
            onboard_step: 3,
          })
          .eq('id', data.rooftop_id);

        if (error) throw new Error(`Update failed: ${error.message}`);
        console.log(`[onboard] Step 2 — branding for ${data.rooftop_id}`);
        return res.json({ rooftop_id: data.rooftop_id, step: 3 });
      }

      // ── Step 3: Product config ─────────────────────────
      case 3: {
        if (!data.rooftop_id) return res.status(400).json({ error: 'rooftop_id required' });

        const { error } = await supabase
          .from('rooftops')
          .update({
            trade_url: data.trade_url || null,
            sms_greeting: data.sms_greeting || null,
            sms_signature: data.sms_signature || null,
            onboard_step: 4,
          })
          .eq('id', data.rooftop_id);

        if (error) throw new Error(`Update failed: ${error.message}`);
        console.log(`[onboard] Step 3 — product config for ${data.rooftop_id}`);
        return res.json({ rooftop_id: data.rooftop_id, step: 4 });
      }

      // ── Step 4: First rep ──────────────────────────────
      case 4: {
        if (!data.rooftop_id) return res.status(400).json({ error: 'rooftop_id required' });
        if (!data.rep_name || !data.rep_email) {
          return res.status(400).json({ error: 'rep_name and rep_email required' });
        }

        const { data: rep, error } = await supabase
          .from('reps')
          .insert({
            rooftop_id: data.rooftop_id,
            name: data.rep_name,
            nickname: data.rep_nickname || null,
            title: data.rep_title || 'Sales Consultant',
            email: data.rep_email,
          })
          .select()
          .single();

        if (error) throw new Error(`Rep create failed: ${error.message}`);

        await supabase.from('rooftops').update({ onboard_step: 5 }).eq('id', data.rooftop_id);

        console.log(`[onboard] Step 4 — created rep ${rep.id} for ${data.rooftop_id}`);
        return res.json({ rooftop_id: data.rooftop_id, rep_id: rep.id, step: 5 });
      }

      // ── Step 5: Complete ───────────────────────────────
      case 5: {
        if (!data.rooftop_id) return res.status(400).json({ error: 'rooftop_id required' });

        const { error } = await supabase
          .from('rooftops')
          .update({
            onboarded: true,
            onboarded_at: new Date().toISOString(),
            onboard_step: 5,
          })
          .eq('id', data.rooftop_id);

        if (error) throw new Error(`Complete failed: ${error.message}`);
        console.log(`[onboard] Complete — rooftop ${data.rooftop_id} fully onboarded`);
        return res.json({ rooftop_id: data.rooftop_id, onboarded: true });
      }

      default:
        return res.status(400).json({ error: `Unknown step: ${step}` });
    }

  } catch (err) {
    console.error('[onboard] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/onboard/sync-autocurb
 * Pull tenant data from autocurb.io if they're already a customer there.
 * Body: { autocurb_tenant_id }
 */
router.post('/sync-autocurb', async (req, res) => {
  try {
    const { autocurb_tenant_id } = req.body;
    if (!autocurb_tenant_id) {
      return res.status(400).json({ error: 'autocurb_tenant_id required' });
    }

    // Check if already synced
    const { data: existing } = await supabase
      .from('rooftops')
      .select('id, name')
      .eq('autocurb_tenant_id', autocurb_tenant_id)
      .single();

    if (existing) {
      return res.json({
        rooftop_id: existing.id,
        already_synced: true,
        message: `${existing.name} is already linked`,
      });
    }

    // Fetch from autocurb.io API
    const AUTOCURB_API = process.env.AUTOCURB_API_URL || 'https://api.autocurb.io';
    const AUTOCURB_KEY = process.env.AUTOCURB_API_KEY;

    if (!AUTOCURB_KEY) {
      return res.status(503).json({ error: 'AutoCurb sync not configured' });
    }

    const acRes = await fetch(`${AUTOCURB_API}/api/tenant/${autocurb_tenant_id}`, {
      headers: { 'Authorization': `Bearer ${AUTOCURB_KEY}` },
    });

    if (!acRes.ok) {
      return res.status(404).json({ error: 'Tenant not found on autocurb.io' });
    }

    const acTenant = await acRes.json();

    // Create rooftop from autocurb data
    const { data: rooftop, error } = await supabase
      .from('rooftops')
      .insert({
        name: acTenant.name || acTenant.dealer_name,
        dealer_group: acTenant.dealer_group || null,
        logo_url: acTenant.logo_url || null,
        brand_color: acTenant.brand_color || '#D94F00',
        website: acTenant.website || null,
        phone: acTenant.phone || null,
        email: acTenant.email || null,
        address: acTenant.address || null,
        city: acTenant.city || null,
        state: acTenant.state || null,
        zip: acTenant.zip || null,
        trade_url: acTenant.trade_url || null,
        source: 'autocurb',
        autocurb_tenant_id,
        onboarded: true,
        onboarded_at: new Date().toISOString(),
        onboard_step: 5,
      })
      .select()
      .single();

    if (error) throw new Error(`Sync insert failed: ${error.message}`);

    // Sync reps if available
    let repsCreated = 0;
    if (acTenant.reps && Array.isArray(acTenant.reps)) {
      for (const acRep of acTenant.reps) {
        const { error: repErr } = await supabase
          .from('reps')
          .insert({
            rooftop_id: rooftop.id,
            name: acRep.name,
            nickname: acRep.nickname || null,
            title: acRep.title || 'Sales Consultant',
            email: acRep.email,
            photo_url: acRep.photo_url || null,
          });
        if (!repErr) repsCreated++;
      }
    }

    console.log(`[onboard] Synced from autocurb: ${rooftop.name} (${repsCreated} reps)`);

    res.json({
      rooftop_id: rooftop.id,
      synced: true,
      name: rooftop.name,
      reps_created: repsCreated,
    });

  } catch (err) {
    console.error('[onboard] Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
