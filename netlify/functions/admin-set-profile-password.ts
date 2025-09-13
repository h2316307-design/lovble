import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY as string; // shared secret to protect this endpoint

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // At runtime we return an error, but keep file written.
  console.warn('Supabase service role key or URL not configured for admin-set-profile-password function.');
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method not allowed' };
    }

    const authHeader = event.headers['authorization'] || event.headers['x-admin-key'] || event.headers['x-admin-token'];
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'missing_authorization' }) };
    }

    // support "Bearer <token>" for JWT or admin key
    const provided = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'supabase_not_configured' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    let isAdminUser = false;

    // If provided matches ADMIN_API_KEY env (server-to-server secret), allow
    if (ADMIN_API_KEY && provided === ADMIN_API_KEY) {
      isAdminUser = true;
    } else {
      // Otherwise treat it as a user's access token and verify the user is admin
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser(provided as string);
        if (userErr || !userData?.user) {
          return { statusCode: 401, body: JSON.stringify({ error: 'invalid_token' }) };
        }
        const uid = userData.user.id;
        const { data: profile, error: profErr } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
        if (profErr) return { statusCode: 500, body: JSON.stringify({ error: profErr.message }) };
        if (profile && (profile as any).role === 'admin') {
          isAdminUser = true;
        }
      } catch (e: any) {
        return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'failed_to_verify_user' }) };
      }
    }

    if (!isAdminUser) {
      return { statusCode: 403, body: JSON.stringify({ error: 'not_authorized' }) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { userId, password } = body;
    if (!userId || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId_and_password_required' }) };
    }

    const { error } = await supabase.rpc('admin_set_profile_password', { p_user_id: userId, p_password: password });
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || String(err) }) };
  }
};

export { handler };
