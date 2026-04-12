import { supabase } from './supabase.js';

/**
 * Middleware factory: checks if a rooftop has access to a specific product.
 * Usage: app.use('/api/upload', requireProduct('autofilm'), uploadRoute);
 *
 * Reads rooftop_id from req.body, req.query, or req.params.
 * If no rooftop_id is provided, skips the check (public endpoints).
 */
export function requireProduct(productId) {
  return async (req, res, next) => {
    const rooftopId = req.body?.rooftop_id || req.query?.rooftop_id || req.params?.rooftop_id;

    // If no rooftop_id, skip (public endpoints like /v/:code/ping)
    if (!rooftopId) return next();

    try {
      const { data: access, error } = await supabase
        .from('product_access')
        .select('product_id, expires_at')
        .eq('rooftop_id', rooftopId)
        .eq('product_id', productId)
        .single();

      if (error || !access) {
        return res.status(403).json({
          error: 'no_access',
          product: productId,
          message: `This rooftop does not have access to ${productId}. Upgrade at autocurb.io/pricing`,
          upgrade_url: 'https://autocurb.io/pricing',
        });
      }

      // Check expiry
      if (access.expires_at && new Date(access.expires_at) < new Date()) {
        return res.status(403).json({
          error: 'expired',
          product: productId,
          message: `Your ${productId} access has expired. Renew at autocurb.io/pricing`,
          upgrade_url: 'https://autocurb.io/pricing',
        });
      }

      next();
    } catch (err) {
      console.error('[access] Error:', err.message);
      next(); // Fail open — don't block on access check errors
    }
  };
}
