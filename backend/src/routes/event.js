import express from 'express';
import { supabase } from '../lib/supabase.js';
import { sendPush } from '../lib/push.js';

const router = express.Router();

const MILESTONES = [25, 50, 75, 100];

/**
 * POST /api/event
 * Called by the player page on play, pause, complete events.
 * Body: { code, type, pct, ts }
 * Returns: { ok: true }
 */
router.post('/', async (req, res) => {
  try {
    const { code, type, pct: rawPct } = req.body;

    if (!code) return res.json({ ok: true, skipped: 'no code' });

    const pct = Math.min(100, Math.max(0, parseInt(rawPct) || 0));

    // Find video by short_code
    const { data: videoRow, error: videoErr } = await supabase
      .from('videos')
      .select('id, rep_id, customer_name, vehicle, max_watch_pct, reps(push_subscription, name, nickname)')
      .eq('short_code', code)
      .single();

    if (videoErr || !videoRow) {
      return res.json({ ok: true, found: false });
    }

    // Insert watch event
    await supabase.from('watch_events').insert({
      video_id:      videoRow.id,
      watch_pct:     pct,
      watch_seconds: 0,
      ip:            req.headers['x-forwarded-for'] || req.ip,
      user_agent:    req.headers['user-agent'],
    });

    // Check milestones
    const prevMax = videoRow.max_watch_pct || 0;
    const crossedMilestone = MILESTONES.find(m => m > prevMax && m <= pct);

    if (crossedMilestone || pct > prevMax) {
      await supabase.from('videos').update({
        max_watch_pct:   pct,
        last_watched_at: new Date().toISOString(),
      }).eq('id', videoRow.id);
    }

    if (crossedMilestone) {
      console.log(`[event] ${code} crossed ${crossedMilestone}% (${type})`);

      const rep = videoRow.reps;
      const customerName = videoRow.customer_name || 'Your customer';
      const vehicle = videoRow.vehicle ? ` — ${videoRow.vehicle}` : '';

      if (rep?.push_subscription) {
        await sendPush(rep.push_subscription, {
          title: `🔥 ${customerName} watched ${crossedMilestone}%`,
          body:  `${customerName}${vehicle}`,
          icon:  '/icon-192.png',
          data:  { short_code: code, pct: crossedMilestone, type },
        });
      }
    }

    res.json({ ok: true, pct, type, milestone: crossedMilestone || null });

  } catch (err) {
    console.error('[event] Error:', err.message);
    res.json({ ok: true, error: err.message });
  }
});

export default router;
