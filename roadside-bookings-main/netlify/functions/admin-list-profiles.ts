import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase service role key or URL not configured for admin-list-profiles function.');
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method not allowed' };
    }

    const authHeader = event.headers['authorization'] || event.headers['x-admin-key'] || event.headers['x-admin-token'];
    const provided = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (authHeader as string | undefined);

    if ((!ADMIN_API_KEY || provided !== ADMIN_API_KEY) && !provided) {
      return { statusCode: 401, body: JSON.stringify({ error: 'missing_authorization' }) };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'supabase_not_configured' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let isAdminUser = false;

    if (ADMIN_API_KEY && provided === ADMIN_API_KEY) {
      isAdminUser = true;
    } else if (provided) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(provided);
      if (userErr || !userData?.user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'invalid_token' }) };
      }
      const uid = userData.user.id;
      const { data: profile, error: profErr } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
      if (profErr) return { statusCode: 500, body: JSON.stringify({ error: profErr.message }) };
      if (profile && (profile as any).role === 'admin') {
        isAdminUser = true;
      }
    }

    if (!isAdminUser) {
      return { statusCode: 403, body: JSON.stringify({ error: 'not_authorized' }) };
    }

    const url = new URL(event.rawUrl || `http://x${event.path}${event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters as any).toString() : ''}`);
    const from = parseInt(url.searchParams.get('from') || '0');
    const to = parseInt(url.searchParams.get('to') || '39');

    let hasAssignedClient = true;
    let hasPermissions = true; // kept for parity; not used in select here

    let resp = await supabase
      .from('profiles')
      .select('id,name,email,role,created_at,allowed_clients,price_tier', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (resp.error && (resp.error.code === '42703' || /does not exist/i.test(resp.error.message))) {
      // try without the optional columns
      hasAssignedClient = false;
      resp = await supabase
        .from('profiles')
        .select('id,name,email,role,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    if (resp.error) {
      return { statusCode: 500, body: JSON.stringify({ error: resp.error.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ data: resp.data || [], count: resp.count || 0, hasAssignedClient, hasPermissions })
    };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || String(err) }) };
  }
};

export { handler };
