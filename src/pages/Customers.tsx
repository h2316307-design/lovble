import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

interface PaymentRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  contract_number: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  entry_type: string | null;
}

interface ContractRow {
  Contract_Number: string | null;
  "Customer Name": string | null;
  "Total Rent": string | number | null;
  "Start Date"?: string | null;
  "End Date"?: string | null;
}

export default function Customers() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [customers, setCustomers] = useState<{id:string; name:string; phone?: string | null; company?: string | null}[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // add/edit customer states
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerCompanyInput, setCustomerCompanyInput] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const [pRes, cRes, cuRes] = await Promise.all([
        supabase.from('customer_payments').select('id,customer_id,customer_name,contract_number,amount,method,reference,notes,paid_at,entry_type').order('paid_at', { ascending: false }),
        supabase.from('Contract').select('Contract_Number, "Customer Name", "Total Rent", "Contract Date", "Start Date", "End Date", customer_id'),
        supabase.from('customers').select('id,name,phone,company').order('name', { ascending: true })
      ]);

      if (!pRes.error) setPayments((pRes.data || []) as any);
      if (!cRes.error) setContracts((cRes.data || []) as any);
      if (!cuRes.error) setCustomers((cuRes.data || []) as any);
    })();
  }, []);

  // Build summary per customer using customers table, payments + contracts
  const customersSummary = useMemo(() => {
    // initialize map from customers list
    const map = new Map<string, { id: string; name: string; contractsCount: number; totalRent: number; totalPaid: number }>();
    for (const c of (customers || [])) {
      const id = (c as any).id;
      const name = (c as any).name || '—';
      map.set(id, { id, name, contractsCount: 0, totalRent: 0, totalPaid: 0 });
    }

    // contracts info
    for (const ct of contracts) {
      const cid = (ct as any).customer_id ?? null;
      const rent = Number((ct as any)['Total Rent'] || 0) || 0;
      if (cid && map.has(cid)) {
        const cur = map.get(cid)!;
        cur.contractsCount += 1;
        cur.totalRent += rent;
      } else {
        // fallback: group by name if customer_id missing
        const name = (ct['Customer Name'] || '').toString() || '—';
        const key = `name:${name}`;
        if (!map.has(key)) map.set(key, { id: key, name, contractsCount: 0, totalRent: 0, totalPaid: 0 } as any);
        const cur = map.get(key)!;
        cur.contractsCount += 1;
        cur.totalRent += rent;
      }
    }

    // payments
    for (const p of payments) {
      const cid = (p.customer_id || null) as string | null;
      const amt = Number(p.amount || 0) || 0;
      if (cid && map.has(cid)) {
        const cur = map.get(cid)!;
        cur.totalPaid += amt;
      } else if (p.customer_name) {
        // try to find customer by name
        const match = Array.from(map.values()).find(x => x.name && x.name.toLowerCase() === String(p.customer_name).toLowerCase());
        if (match) {
          match.totalPaid += amt;
        } else {
          const name = p.customer_name || '—';
          const key = `name:${name}`;
          if (!map.has(key)) map.set(key, { id: key, name, contractsCount: 0, totalRent: 0, totalPaid: 0 } as any);
          const cur = map.get(key)!;
          cur.totalPaid += amt;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalRent - a.totalRent);
  }, [payments, contracts, customers]);

  const totalAllPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const [detailsContracts, setDetailsContracts] = useState<ContractRow[]>([]);
  const [detailsPayments, setDetailsPayments] = useState<PaymentRow[]>([]);

  const openCustomer = async (idOrKey: string) => {
    // idOrKey may be a real customer id, or a fallback key like 'name:Customer Name'
    let id = idOrKey;
    let nameFallback: string | null = null;
    if (typeof idOrKey === 'string' && idOrKey.startsWith('name:')) {
      nameFallback = idOrKey.slice(5);
      id = '';
    }

    setSelectedCustomer(idOrKey);
    setDialogOpen(true);

    try {
      // First fetch payments for this customer (by id), fallback to name
      let paymentsData: any[] = [];

      if (id) {
        const pRes: any = await supabase.from('customer_payments').select('id,customer_id,customer_name,contract_number,amount,method,reference,notes,paid_at,entry_type').eq('customer_id', id).order('paid_at', { ascending: false });
        paymentsData = pRes.data || [];
      }

      // determine customer name if available (from customers list) or fallback
      const cust = customers.find(x => x.id === id);
      const name = cust?.name || nameFallback || null;

      if ((!paymentsData || paymentsData.length === 0) && name) {
        const pByName = await supabase.from('customer_payments').select('id,customer_id,customer_name,contract_number,amount,method,reference,notes,paid_at,entry_type').ilike('customer_name', name).order('paid_at', { ascending: false });
        paymentsData = pByName.data || [];
      }

      setDetailsPayments(paymentsData);

      // collect contract numbers from payments
      const contractNumbers = Array.from(new Set((paymentsData || []).map((p:any)=>p.contract_number).filter(Boolean)));

      // fetch contracts by customer_id if we have id, otherwise by name or contract numbers
      let contractsData: any[] = [];

      if (id) {
        const contractsById = await supabase.from('Contract').select('Contract_Number, "Customer Name", "Total Rent", "Contract Date", "Start Date", "End Date", customer_id').eq('customer_id', id);
        contractsData = contractsById.data || [];
      }

      if ((contractsData || []).length === 0 && name) {
        const byName = await supabase.from('Contract').select('Contract_Number, "Customer Name", "Total Rent", "Contract Date", "Start Date", "End Date", customer_id').ilike('Customer Name', name);
        contractsData = byName.data || [];
      }

      if ((contractsData || []).length === 0 && contractNumbers.length > 0) {
        // attempt fetching by contract numbers
        const byNumbers = await supabase.from('Contract').select('Contract_Number, "Customer Name", "Total Rent", "Contract Date", "Start Date", "End Date", customer_id').in('Contract_Number', contractNumbers);
        contractsData = byNumbers.data || [];
      }

      // dedupe by Contract_Number
      const seen = new Set();
      const deduped = [] as any[];
      for (const c of contractsData) {
        const key = String(c.Contract_Number || c['Contract Number'] || JSON.stringify(c));
        if (!seen.has(key)) { seen.add(key); deduped.push(c); }
      }

      setDetailsContracts(deduped);
    } catch (e) {
      console.warn('openCustomer error', e);
      setDetailsContracts([]);
      setDetailsPayments([]);
    }
  };


  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedCustomer(null);
    setDetailsContracts([]);
    setDetailsPayments([]);
  };

  const customerContracts = detailsContracts;
  const customerPayments = detailsPayments;

  const printReceipt = (payment: PaymentRow) => {
    const html = `
      <html dir="rtl"><head><meta charset="utf-8"><title>إيصال دفع</title></head>
      <body>
        <div style="font-family: sans-serif; padding:20px; max-width:600px; margin:auto;">
          <h2>إيصال دفع</h2>
          <p><strong>العميل:</strong> ${payment.customer_name}</p>
          <p><strong>العقد:</strong> ${payment.contract_number || '—'}</p>
          <p><strong>المبلغ:</strong> ${(Number(payment.amount)||0).toLocaleString('ar-LY')} د.ل</p>
          <p><strong>الطريقة:</strong> ${payment.method || '—'}</p>
          <p><strong>المرجع:</strong> ${payment.reference || '—'}</p>
          <p><strong>التاريخ:</strong> ${payment.paid_at ? new Date(payment.paid_at).toLocaleString('ar-LY') : ''}</p>
          <hr />
          <p>شكر��ً لتعاملكم.</p>
        </div>
        <script>window.print();</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  };

  const searchQ = search.trim().toLowerCase();
  const visible = customersSummary.filter(c => !searchQ || c.name.toLowerCase().includes(searchQ));

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle>الزبائن — ملخص</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Input placeholder="ابحث بالزبون" value={search} onChange={(e)=>setSearch(e.target.value)} />
            <div className="flex items-center justify-center gap-2">
              <Button onClick={() => { setCustomerNameInput(''); setCustomerPhoneInput(''); setCustomerCompanyInput(''); setEditingCustomerId(null); setNewCustomerOpen(true); }}>إضافة زبون جديد</Button>
              <Button disabled={syncing} onClick={async () => {
                try {
                  setSyncing(true);
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = (sessionData as any)?.session?.access_token || null;
                  const resp = await fetch('/.netlify/functions/sync-customers', {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      ...(token ? { authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ createMissing: false })
                  });

                  let json: any = null;
                  try {
                    json = await resp.json();
                  } catch (err) {
                    // sometimes body stream may be consumed or invalid JSON; try text
                    try {
                      const text = await resp.text();
                      json = text ? { text } : null;
                    } catch (err2) {
                      json = null;
                    }
                  }

                  if (!resp.ok) {
                    console.error('sync error', json || resp.statusText);
                    toast.error((json && (json.error || json.text)) || 'فشل المزامنة');
                  } else {
                    toast.success(`تمت المزامنة. تم تحديث ${json?.updated || 0} عقود، إضافة عملاء: ${json?.createdCustomers || 0}`);
                    // reload data if something changed
                    if ((json?.updated || 0) > 0 || (json?.createdCustomers || 0) > 0) loadData();
                  }
                } catch (e) {
                  console.error('sync error', e);
                  toast.error('خطأ في المزامنة');
                } finally {
                  setSyncing(false);
                }
              }}>
                {syncing ? 'جاري المزامنة...' : 'مزامنة العملاء'}
              </Button>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">إجمالي المدفوعات: {totalAllPaid.toLocaleString('ar-LY')} د.ل</div>
          </div>

          {/* Add/Edit customer dialog */}
          <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCustomerId ? 'تعديل الزبون' : 'إضافة زبون جديد'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="اسم الزبون" value={customerNameInput} onChange={(e)=>setCustomerNameInput(e.target.value)} />
                <Input placeholder="هاتف" value={customerPhoneInput} onChange={(e)=>setCustomerPhoneInput(e.target.value)} />
                <Input placeholder="اسم الشركة" value={customerCompanyInput} onChange={(e)=>setCustomerCompanyInput(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>إلغاء</Button>
                  <Button onClick={async () => {
                    const name = customerNameInput.trim();
                    const phone = customerPhoneInput.trim();
                    const company = customerCompanyInput.trim();
                    if (!name) return;
                    try {
                      if (editingCustomerId) {
                        const { error } = await supabase.from('customers').update({ name, phone: phone || null, company: company || null }).eq('id', editingCustomerId);
                        if (!error) {
                          setCustomers(prev => prev.map(c => c.id === editingCustomerId ? { ...c, name, phone: phone || null, company: company || null } : c));
                          setNewCustomerOpen(false);
                          setEditingCustomerId(null);
                          setCustomerNameInput('');
                          setCustomerPhoneInput('');
                          setCustomerCompanyInput('');
                        }
                      } else {
                        const { data: newC, error } = await supabase.from('customers').insert({ name, phone: phone || null, company: company || null }).select().single();
                        if (!error && newC && (newC as any).id) {
                          setCustomers(prev => [{ id: (newC as any).id, name: (newC as any).name || name, phone: (newC as any).phone || phone || null, company: (newC as any).company || company || null }, ...prev]);
                          setNewCustomerOpen(false);
                          setCustomerNameInput('');
                          setCustomerPhoneInput('');
                          setCustomerCompanyInput('');
                        }
                      }
                    } catch (e) {
                      console.warn('customer save error', e);
                    }
                  }}>حفظ</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الشركة</TableHead>
                  <TableHead>عدد العقود</TableHead>
                  <TableHead>إجمالي الإيجار</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(c => (
                  <TableRow key={c.id} className="hover:bg-card/50 transition-colors">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{(c as any).phone || '-'}</TableCell>
                    <TableCell>{(c as any).company || '-'}</TableCell>
                    <TableCell>{c.contractsCount}</TableCell>
                    <TableCell>{c.totalRent.toLocaleString('ar-LY')} د.ل</TableCell>
                    <TableCell>{c.totalPaid.toLocaleString('ar-LY')} د.ل</TableCell>
                    <TableCell>{(c.totalRent - c.totalPaid).toLocaleString('ar-LY')} د.ل</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => openCustomer(c.id)}>عرض</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingCustomerId(c.id); setCustomerNameInput(c.name); setCustomerPhoneInput((c as any).phone || ''); setCustomerCompanyInput((c as any).company || ''); setNewCustomerOpen(true); }}>تعديل</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">لا توجد بيانات</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العميل {selectedCustomer}</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>عقود {selectedCustomer} ({customerContracts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2">
                    {customerContracts.map(ct => {
                      const paidForContract = payments.filter(p => (p.contract_number||'') === (ct.Contract_Number||'')).reduce((s, x) => s + (Number(x.amount)||0), 0);
                      const totalRent = Number(ct['Total Rent'] || 0) || 0;
                      const remaining = Math.max(0, totalRent - paidForContract);
                      return (
                        <div key={ct.Contract_Number} className="flex items-center justify-between border rounded p-3">
                          <div>
                            <div className="font-medium">عقد: {ct.Contract_Number}</div>
                            <div className="text-sm text-muted-foreground">{ct['Start Date'] || ct['Contract Date'] || '—'} → {ct['End Date'] || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div>الإجمالي: {totalRent.toLocaleString('ar-LY')} د.ل</div>
                            <div>مدفوع: {paidForContract.toLocaleString('ar-LY')} د.ل</div>
                            <div>المتبقي: {remaining.toLocaleString('ar-LY')} د.ل</div>
                          </div>
                        </div>
                      );
                    })}
                    {customerContracts.length === 0 && (<div className="text-sm text-muted-foreground">لا توجد عقود لهذا العميل</div>)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>الدفعات والإيصالات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {customerPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between border rounded p-3">
                        <div>
                          <div className="font-medium">{p.contract_number || '—'}</div>
                          <div className="text-sm text-muted-foreground">{p.reference || ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{(Number(p.amount)||0).toLocaleString('ar-LY')} د.ل</div>
                          <div className="text-xs text-muted-foreground">{p.paid_at ? new Date(p.paid_at).toLocaleString('ar-LY') : '—'}</div>
                          <div className="mt-2">
                            <Button size="sm" onClick={() => printReceipt(p)}>طباعة إيصال</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {customerPayments.length === 0 && (<div className="text-sm text-muted-foreground">لا توجد دفعات</div>)}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
