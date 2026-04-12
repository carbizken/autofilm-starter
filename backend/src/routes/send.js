import express from 'express';
import { supabase } from '../lib/supabase.js';
import { twilioClient, TWILIO_FROM } from '../lib/twilio.js';
import { kvPut } from '../lib/cloudflare.js';

const router = express.Router();

const CF_WORKER_URL = process.env.CF_WORKER_URL || 'https://links.autofilm.io';
const PLAYER_BASE   = 'https://autofilm.io/autofilm-player.html';

/**
 * POST /api/send
 * Body: { short_code, customer_name, customer_phone, vehicle?, trade_url? }
 * Returns: { success: true, sms_sid, short_url }
 */
router.post('/', async (req, res) => {
  try {
    const { short_code, customer_name, customer_phone, vehicle, trade_url } = req.body;

    if (!short_code)      return res.status(400).json({ error: 'short_code required' });
    if (!customer_name)   return res.status(400).json({ error: 'customer_name required' });
    if (!customer_phone)  return res.status(400).json({ error: 'customer_phone required' });

    // Validate phone format (E.164: +1XXXXXXXXXX)
    const phoneClean = customer_phone.replace(/[\s\-().]/g, '');
    if (!/^\+1\d{10}$/.test(phoneClean)) {
      return res.status(400).json({ error: 'customer_phone must be E.164 format (+1XXXXXXXXXX)' });
    }

    // 1. Fetch video + rep + full rooftop branding from Supabase
    const { data: videoRow, error: videoErr } = await supabase
      .from('videos')
      .select('*, reps(name, nickname, title, photo_url, rooftops(name, brand_color, logo_url, website, trade_url, sms_greeting, sms_signature))')
      .eq('short_code', short_code)
      .single();

    if (videoErr || !videoRow) {
      return res.status(404).json({ error: 'Video not found for short_code: ' + short_code });
    }

    const rep = videoRow.reps;
    const rooftop = rep?.rooftops || {};
    const dealerName = rooftop.name || 'Your Dealer';
    const repDisplay = rep?.nickname || rep?.name?.split(' ')[0] || 'Your Rep';

    // 2. Build full player URL — push tenant branding into params
    const params = new URLSearchParams({
      rep:          rep?.name || '',
      rep_display:  repDisplay,
      title:        rep?.title || 'Sales Consultant',
      dealer:       dealerName,
      code:         short_code,
      customer:     customer_name,
      phone:        customer_phone,
    });

    if (videoRow.mux_playback_id) {
      params.set('playback_id', videoRow.mux_playback_id);
    }
    if (rep?.photo_url) {
      params.set('photo', rep.photo_url);
    }
    if (rooftop.brand_color) {
      params.set('color', rooftop.brand_color);
    }
    if (rooftop.logo_url) {
      params.set('logo', rooftop.logo_url);
    }
    if (rooftop.website) {
      params.set('web', rooftop.website);
    }
    if (vehicle) {
      params.set('vehicle', vehicle);
    }
    // Trade URL: use request param first, then rooftop default
    const resolvedTradeUrl = trade_url || rooftop.trade_url;
    if (resolvedTradeUrl) {
      params.set('trade_url', resolvedTradeUrl);
    }

    const playerUrl = `${PLAYER_BASE}?${params.toString()}`;
    const shortUrl  = `${CF_WORKER_URL}/v/${short_code}`;

    // 3. Store in Cloudflare KV FIRST (so link works before SMS arrives)
    await kvPut(`v_${short_code}`, playerUrl);
    console.log(`[send] KV stored: v_${short_code}`);

    // 4. Send Twilio SMS (only after KV confirmed)
    const greeting = rooftop.sms_greeting
      || (vehicle
        ? `Hey ${customer_name}, ${repDisplay} at ${dealerName} recorded a personal video about the ${vehicle} for you 🎬`
        : `Hey ${customer_name}, ${repDisplay} at ${dealerName} recorded a personal video for you 🎬`);
    const signature = rooftop.sms_signature || `— ${repDisplay} · ${dealerName}`;
    const smsBody = `${greeting}\n\nWatch it here: ${shortUrl}\n\n${signature}`;

    const message = await twilioClient.messages.create({
      body: smsBody,
      from: TWILIO_FROM,
      to: phoneClean,
    });

    console.log(`[send] SMS sent to ${phoneClean} — SID: ${message.sid}`);

    // 5. Update Supabase video record
    await supabase.from('videos').update({
      customer_name,
      customer_phone,
      vehicle: vehicle || null,
      sent_at: new Date().toISOString(),
    }).eq('short_code', short_code);

    res.json({ success: true, sms_sid: message.sid, short_url: shortUrl });

  } catch (err) {
    console.error('[send] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
