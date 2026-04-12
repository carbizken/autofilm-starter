import express from 'express';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/stripe-webhook
 * Handles Stripe events for subscription lifecycle.
 * Uses raw body for signature verification.
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  // Verify webhook signature if secret is configured
  if (STRIPE_WEBHOOK_SECRET) {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

    try {
      // Dynamic import so Stripe isn't required if webhook isn't used
      const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[stripe] Signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }
  } else {
    // Dev mode — trust the payload
    event = JSON.parse(req.body.toString());
    console.warn('[stripe] No STRIPE_WEBHOOK_SECRET — skipping signature check');
  }

  console.log(`[stripe] ${event.type} — ${event.id}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const rooftopId = session.metadata?.rooftop_id;

        if (rooftopId) {
          const bundleId = session.metadata?.bundle_id || 'starter';

          await supabase.from('rooftops').update({
            stripe_customer_id: customerId,
            plan: bundleId,
            active: true,
          }).eq('id', rooftopId);

          // Grant product access for the purchased bundle
          const { data: bundle } = await supabase
            .from('bundles').select('product_ids').eq('id', bundleId).single();

          if (bundle?.product_ids) {
            const grants = bundle.product_ids.map(pid => ({
              rooftop_id: rooftopId,
              product_id: pid,
              bundle_id: bundleId,
              granted_at: new Date().toISOString(),
            }));
            await supabase.from('product_access')
              .upsert(grants, { onConflict: 'rooftop_id,product_id' });
            console.log(`[stripe] Granted ${bundleId} products: ${bundle.product_ids.join(', ')}`);
          }

          console.log(`[stripe] Activated rooftop ${rooftopId} with ${bundleId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const active = sub.status === 'active' || sub.status === 'trialing';

        await supabase.from('rooftops').update({
          active,
          plan: active ? 'standard' : 'cancelled',
        }).eq('stripe_customer_id', customerId);
        console.log(`[stripe] Subscription updated for ${customerId} — active: ${active}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;

        await supabase.from('rooftops').update({
          active: false,
          plan: 'cancelled',
        }).eq('stripe_customer_id', customerId);
        console.log(`[stripe] Subscription cancelled for ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`[stripe] Payment failed for ${invoice.customer} — ${invoice.id}`);
        break;
      }

      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (err) {
    console.error('[stripe] Handler error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
