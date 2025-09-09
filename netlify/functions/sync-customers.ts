import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase service role key or URL not configured for sync-customers function.');
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
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

    // authenticate admin: either API key or validate provided user token and role
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

    // Parse body for options
    const body = event.body ? JSON.parse(event.body) : {};
    const createMissing = Boolean(body.createMissing);

    // fetch customers
    const { data: customersData, error: custErr } = await supabase.from('customers').select('id,name');
    if (custErr) return { statusCode: 500, body: JSON.stringify({ error: custErr.message }) };
    const customers = (customersData || []) as Array<{ id: string; name: string }>;

    // fetch contracts that may need customer_id (customer_id null or empty)
    const { data: allContracts, error: contractErr } = await supabase.from('Contract').select('Contract_Number, "Customer Name", customer_id');
    if (contractErr) return { statusCode: 500, body: JSON.stringify({ error: contractErr.message }) };

    const contractsArray = (allContracts || []) as any[];
    const contractsToFix = contractsArray.filter((c: any) => c.customer_id === null || String(c.customer_id || '').trim() === '');
    const allCustomerIds = new Set((customers || []).map((c:any) => String(c.id)));
    const contractsWithBadId = contractsArray.filter((c:any) => c.customer_id && !allCustomerIds.has(String(c.customer_id)));

    const results: any = {
      totalContracts: contractsArray.length,
      contractsWithoutCustomerId: contractsToFix.length,
      contractsWithInvalidCustomerId: contractsWithBadId.length,
      updated: 0,
      createdCustomers: 0,
      notMatched: [] as string[],
      samples: {
        withoutCustomerId: contractsToFix.slice(0, 10),
        withInvalidId: contractsWithBadId.slice(0, 10)
      }
    };

    // build map of normalized customer name -> customer
    const norm = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
    const customerMap = new Map<string, { id: string; name: string }>();
    for (const c of customers) {
      customerMap.set(norm(c.name), c);
    }

    // collect unmatched names if createMissing true, to insert
    const unmatchedNames = new Set<string>();

    for (const contract of contractsToFix) {
      const cnameRaw = contract['Customer Name'] || contract['Customer_Name'] || '';
      const n = norm(cnameRaw);
      if (!n) continue;
      const matched = customerMap.get(n);
      if (matched) {
        // update contract by Contract_Number
        const { data: upd, error: updErr } = await supabase.from('Contract').update({ customer_id: matched.id }).eq('Contract_Number', contract.Contract_Number).select('Contract_Number');
        if (!updErr && upd && (upd as any[]).length > 0) results.updated += (upd as any[]).length;
      } else {
        unmatchedNames.add(String(cnameRaw).trim());
      }
    }

    if (createMissing && unmatchedNames.size > 0) {
      for (const name of Array.from(unmatchedNames)) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const { data: newC, error: newErr } = await supabase.from('customers').insert({ name: trimmed }).select().single();
        if (!newErr && newC && (newC as any).id) {
          results.createdCustomers += 1;
          customerMap.set(norm((newC as any).name), { id: (newC as any).id, name: (newC as any).name });
        }
      }

      // After creating missing customers, run another pass to update contracts matching newly created customers
      for (const contract of contractsToFix) {
        const cnameRaw = contract['Customer Name'] || contract['Customer_Name'] || '';
        const n = norm(cnameRaw);
        if (!n) continue;
        const matched = customerMap.get(n);
        if (matched) {
          const { data: upd, error: updErr } = await supabase.from('Contract').update({ customer_id: matched.id }).eq('Contract_Number', contract.Contract_Number).select('Contract_Number');
          if (!updErr && upd && (upd as any[]).length > 0) results.updated += (upd as any[]).length;
        }
      }
    }

    // remaining unmatched names
    for (const name of Array.from(unmatchedNames)) {
      if (!customerMap.has(norm(name))) results.notMatched.push(name);
    }

    return { statusCode: 200, body: JSON.stringify(results) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || String(err) }) };
  }
};

export { handler };
