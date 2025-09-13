import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Edit, Trash2 } from 'lucide-react';

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
  "Ad Type": string | null;
  "Total Rent": string | number | null;
  "Start Date"?: string | null;
  "End Date"?: string | null;
  customer_id?: string | null;
}

export default function Customers() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [customers, setCustomers] = useState<{id:string; name:string; phone?: string | null; company?: string | null}[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // add/edit customer states
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerCompanyInput, setCustomerCompanyInput] = useState('');
  const [syncing, setSyncing] = useState(false);

  // edit receipt states
  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState('');

  // add invoice/receipt dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<'invoice'|'receipt'>('invoice');
  const [addAmount, setAddAmount] = useState('');
  const [addMethod, setAddMethod] = useState('');
  const [addReference, setAddReference] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addDate, setAddDate] = useState<string>(()=>new Date().toISOString().slice(0,10));
  const [addContract, setAddContract] = useState<string>('');

  const loadData = async () => {
    try {
      console.log('Loading data...');
      const [pRes, cRes, cuRes] = await Promise.all([
        supabase.from('customer_payments').select('*').order('paid_at', { ascending: false }),
        supabase.from('Contract').select('*'),
        supabase.from('customers').select('*').order('name', { ascending: true })
      ]);

      console.log('Payments result:', pRes);
      console.log('Contracts result:', cRes);
      console.log('Customers result:', cuRes);

      if (pRes.error) {
        console.error('Payments error:', pRes.error);
      } else {
        setPayments(pRes.data || []);
      }

      if (cRes.error) {
        console.error('Contracts error:', cRes.error);
      } else {
        setContracts(cRes.data || []);
      }

      if (cuRes.error) {
        console.error('Customers error:', cuRes.error);
      } else {
        setCustomers(cuRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('خطأ في تحميل البيانات');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Build summary per customer using customers table, payments + contracts
  const customersSummary = useMemo(() => {
    console.log('Building customer summary...');
    console.log('Customers:', customers);
    console.log('Contracts:', contracts);
    console.log('Payments:', payments);

    // initialize map from customers list
    const map = new Map<string, { id: string; name: string; contractsCount: number; totalRent: number; totalPaid: number }>();
    for (const c of (customers || [])) {
      const id = c.id;
      const name = c.name || '—';
      map.set(id, { id, name, contractsCount: 0, totalRent: 0, totalPaid: 0 });
    }

    // contracts info
    for (const ct of contracts) {
      const cid = ct.customer_id ?? null;
      const rent = Number(ct['Total Rent'] || 0) || 0;
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

    const result = Array.from(map.values()).sort((a, b) => b.totalRent - a.totalRent);
    console.log('Customer summary result:', result);
    return result;
  }, [payments, contracts, customers]);

  const totalAllPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const [detailsContracts, setDetailsContracts] = useState<ContractRow[]>([]);
  const [detailsPayments, setDetailsPayments] = useState<PaymentRow[]>([]);

  const openCustomer = async (idOrKey: string) => {
    console.log('Opening customer details for:', idOrKey);
    
    // idOrKey may be a real customer id, or a fallback key like 'name:Customer Name'
    let id = idOrKey;
    let nameFallback: string | null = null;
    if (typeof idOrKey === 'string' && idOrKey.startsWith('name:')) {
      nameFallback = idOrKey.slice(5);
      id = '';
    }

    // Find customer name for dialog title
    const customer = customers.find(c => c.id === id);
    const customerName = customer?.name || nameFallback || 'غير معروف';
    
    console.log('Customer found:', customer);
    console.log('Customer name:', customerName);
    
    setSelectedCustomer(idOrKey);
    setSelectedCustomerName(customerName);
    setDialogOpen(true);

    try {
      // First fetch payments for this customer (by id), fallback to name
      let paymentsData: PaymentRow[] = [];

      if (id) {
        console.log('Fetching payments by customer_id:', id);
        const pRes = await supabase
          .from('customer_payments')
          .select('*')
          .eq('customer_id', id)
          .order('paid_at', { ascending: false });
        
        console.log('Payments by ID result:', pRes);
        paymentsData = pRes.data || [];
      }

      // determine customer name if available (from customers list) or fallback
      const cust = customers.find(x => x.id === id);
      const name = cust?.name || nameFallback || null;

      if ((!paymentsData || paymentsData.length === 0) && name) {
        console.log('Fetching payments by customer name:', name);
        const pByName = await supabase
          .from('customer_payments')
          .select('*')
          .ilike('customer_name', `%${name}%`)
          .order('paid_at', { ascending: false });
        
        console.log('Payments by name result:', pByName);
        paymentsData = pByName.data || [];
      }

      setDetailsPayments(paymentsData);

      // collect contract numbers from payments
      const contractNumbers = Array.from(new Set((paymentsData || []).map((p:any)=>p.contract_number).filter(Boolean)));
      console.log('Contract numbers from payments:', contractNumbers);

      // fetch contracts by customer_id if we have id, otherwise by name or contract numbers
      let contractsData: ContractRow[] = [];

      if (id) {
        console.log('Fetching contracts by customer_id:', id);
        const contractsById = await supabase
          .from('Contract')
          .select('*')
          .eq('customer_id', id);
        
        console.log('Contracts by ID result:', contractsById);
        contractsData = contractsById.data || [];
      }

      if ((contractsData || []).length === 0 && name) {
        console.log('Fetching contracts by customer name:', name);
        const byName = await supabase
          .from('Contract')
          .select('*')
          .ilike('Customer Name', `%${name}%`);
        
        console.log('Contracts by name result:', byName);
        contractsData = byName.data || [];
      }

      if ((contractsData || []).length === 0 && contractNumbers.length > 0) {
        console.log('Fetching contracts by contract numbers:', contractNumbers);
        // attempt fetching by contract numbers
        const byNumbers = await supabase
          .from('Contract')
          .select('*')
          .in('Contract_Number', contractNumbers);
        
        console.log('Contracts by numbers result:', byNumbers);
        contractsData = byNumbers.data || [];
      }

      // dedupe by Contract_Number
      const seen = new Set();
      const deduped = [] as ContractRow[];
      for (const c of contractsData) {
        const key = String(c.Contract_Number || c['Contract Number'] || JSON.stringify(c));
        if (!seen.has(key)) { 
          seen.add(key); 
          deduped.push(c); 
        }
      }

      console.log('Final contracts data:', deduped);
      setDetailsContracts(deduped);
    } catch (e) {
      console.error('openCustomer error', e);
      setDetailsContracts([]);
      setDetailsPayments([]);
      toast.error('خطأ في تحميل بيانات العميل');
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedCustomer(null);
    setSelectedCustomerName('');
    setDetailsContracts([]);
    setDetailsPayments([]);
  };

  const customerContracts = detailsContracts;
  const customerPayments = detailsPayments;

  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setReceiptAmount(String(payment.amount || ''));
    setReceiptMethod(payment.method || '');
    setReceiptReference(payment.reference || '');
    setReceiptNotes(payment.notes || '');
    setReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .update({
          amount: Number(receiptAmount) || 0,
          method: receiptMethod || null,
          reference: receiptReference || null,
          notes: receiptNotes || null,
          paid_at: receiptDate ? new Date(receiptDate).toISOString() : null
        })
        .eq('id', editingReceipt.id);

      if (error) {
        console.error('Error updating receipt:', error);
        toast.error('فشل في تحديث الإيصال');
      } else {
        toast.success('تم تحديث الإيصال بنجاح');
        setEditReceiptOpen(false);
        setEditingReceipt(null);
        // Refresh the payments data
        if (selectedCustomer) {
          openCustomer(selectedCustomer);
        }
        loadData();
      }
    } catch (e) {
      console.error('Save receipt error:', e);
      toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (paymentId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإيصال؟')) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', paymentId);

      if (error) {
        console.error('Error deleting receipt:', error);
        toast.error('فشل في حذف الإيصال');
      } else {
        toast.success('تم حذف الإيصال بنجاح');
        // Refresh the payments data
        if (selectedCustomer) {
          openCustomer(selectedCustomer);
        }
        loadData();
      }
    } catch (e) {
      console.error('Delete receipt error:', e);
      toast.error('خطأ في حذف الإيصال');
    }
  };

  const printReceipt = (payment: PaymentRow) => {
    const html = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>إيصال دفع</title>
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 20px; 
              max-width: 600px; 
              margin: auto;
              background: white;
              color: black;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #2c5aa0;
              margin-bottom: 10px;
            }
            .company {
              font-size: 16px;
              color: #666;
            }
            .content {
              line-height: 2;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .label {
              font-weight: bold;
              color: #333;
            }
            .value {
              color: #555;
            }
            .amount {
              font-size: 24px;
              font-weight: bold;
              color: #2c5aa0;
              text-align: center;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
            }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">إيصال دفع</div>
            <div class="company">شركة الفارس الذهبي للدعاية والإعلان</div>
          </div>
          
          <div class="content">
            <div class="row">
              <span class="label">اسم العميل:</span>
              <span class="value">${payment.customer_name || '—'}</span>
            </div>
            <div class="row">
              <span class="label">رقم العقد:</span>
              <span class="value">${payment.contract_number || '—'}</span>
            </div>
            <div class="row">
              <span class="label">طريقة الدفع:</span>
              <span class="value">${payment.method || '—'}</span>
            </div>
            <div class="row">
              <span class="label">المرجع:</span>
              <span class="value">${payment.reference || '—'}</span>
            </div>
            <div class="row">
              <span class="label">التاريخ:</span>
              <span class="value">${payment.paid_at ? new Date(payment.paid_at).toLocaleString('ar-LY') : '—'}</span>
            </div>
            ${payment.notes ? `
            <div class="row">
              <span class="label">ملاحظات:</span>
              <span class="value">${payment.notes}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="amount">
            المبلغ المدفوع: ${(Number(payment.amount)||0).toLocaleString('ar-LY')} دينار ليبي
          </div>
          
          <div class="footer">
            <p>شكرا�� لتعاملكم معنا</p>
            <p>تم إنشاء هذا الإيصال في: ${new Date().toLocaleString('ar-LY')}</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>`;
    
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
                        <Button size="sm" onClick={() => openCustomer(c.id)}>عرض فواتير الزبون</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingCustomerId(c.id); setCustomerNameInput(c.name); setCustomerPhoneInput((c as any).phone || ''); setCustomerCompanyInput((c as any).company || ''); setNewCustomerOpen(true); }}>تعديل</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">لا توجد بيانات</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">فواتير وعقود العميل: {selectedCustomerName}</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>عقود العميل ({customerContracts.length})</span>
                    <span className="text-sm text-muted-foreground">إجمالي قيمة العقود</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerContracts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>نوع الإعلان</TableHead>
                            <TableHead>تاريخ البداية</TableHead>
                            <TableHead>تاريخ النهاية</TableHead>
                            <TableHead>القيمة الإجمالية</TableHead>
                            <TableHead>المدفوع</TableHead>
                            <TableHead>المتبقي</TableHead>
                            <TableHead>الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerContracts.map(ct => {
                            const paidForContract = customerPayments.filter(p => (p.contract_number||'') === (ct.Contract_Number||'')).reduce((s, x) => s + (Number(x.amount)||0), 0);
                            const totalRent = Number(ct['Total Rent'] || 0) || 0;
                            const remaining = Math.max(0, totalRent - paidForContract);
                            const endDate = ct['End Date'] ? new Date(ct['End Date']) : null;
                            const today = new Date();
                            const isExpired = endDate && endDate < today;
                            const isActive = endDate && endDate >= today;
                            
                            return (
                              <TableRow key={ct.Contract_Number}>
                                <TableCell className="font-medium">{ct.Contract_Number}</TableCell>
                                <TableCell>{ct['Ad Type'] || '—'}</TableCell>
                                <TableCell>{ct['Start Date'] ? new Date(ct['Start Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                                <TableCell>{ct['End Date'] ? new Date(ct['End Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                                <TableCell className="font-semibold">{totalRent.toLocaleString('ar-LY')} د.ل</TableCell>
                                <TableCell className="text-green-600">{paidForContract.toLocaleString('ar-LY')} د.ل</TableCell>
                                <TableCell className={remaining > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{remaining.toLocaleString('ar-LY')} د.ل</TableCell>
                                <TableCell>
                                  {isExpired ? (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">منتهي</span>
                                  ) : isActive ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">نشط</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">غير محدد</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا ت��جد عقود مسجلة لهذا العميل</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>سجل الدفعات والإيصالات ({customerPayments.length})</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setAddType('invoice'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(customerContracts[0]?.Contract_Number ? String(customerContracts[0]?.Contract_Number) : ''); }}>إضافة فاتورة</Button>
                      <Button size="sm" variant="outline" onClick={() => { setAddType('receipt'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(customerContracts[0]?.Contract_Number ? String(customerContracts[0]?.Contract_Number) : ''); }}>إضافة إيصال</Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>طريقة الدفع</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead>تاريخ الدفع</TableHead>
                            <TableHead>ملاحظات</TableHead>
                            <TableHead>إجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerPayments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.contract_number || '—'}</TableCell>
                              <TableCell className="font-semibold text-green-600">{(Number(p.amount)||0).toLocaleString('ar-LY')} د.ل</TableCell>
                              <TableCell>{p.method || '—'}</TableCell>
                              <TableCell>{p.reference || '—'}</TableCell>
                              <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-LY') : '—'}</TableCell>
                              <TableCell>{p.notes || '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => printReceipt(p)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    طباعة إيصال
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openEditReceipt(p)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => deleteReceipt(p.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد دفعات مسجلة لهذا العميل</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Invoice/Receipt Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{addType === 'invoice' ? 'إضافة فاتورة' : 'إضافة إيصال'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">العميل: {selectedCustomerName}</div>
            <div>
              <label className="text-sm font-medium">العقد</label>
              <Select value={addContract} onValueChange={setAddContract}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر عقدًا" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {customerContracts.map((ct)=> (
                    <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)}>{String(ct.Contract_Number)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={addAmount} onChange={(e)=>setAddAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={addMethod} onValueChange={setAddMethod}>
                <SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input value={addReference} onChange={(e)=>setAddReference(e.target.value)} placeholder="رقم المرجع أو الشيك" />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={addDate} onChange={(e)=>setAddDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={addNotes} onChange={(e)=>setAddNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                try {
                  if (!addAmount || !addContract) { toast.error('أكمل البيانات'); return; }
                  const payload = {
                    customer_id: customers.find(c => c.name === selectedCustomerName)?.id || (typeof selectedCustomer === 'string' && !selectedCustomer.startsWith('name:') ? selectedCustomer : null),
                    customer_name: selectedCustomerName,
                    contract_number: addContract || null,
                    amount: Number(addAmount) || 0,
                    method: addMethod || null,
                    reference: addReference || null,
                    notes: addNotes || null,
                    paid_at: addDate ? new Date(addDate).toISOString() : new Date().toISOString(),
                    entry_type: addType,
                  } as any;
                  const { error } = await supabase.from('customer_payments').insert(payload);
                  if (error) { console.error(error); toast.error('فشل الحفظ'); return; }
                  toast.success('تمت الإضافة');
                  setAddOpen(false);
                  if (selectedCustomer) await openCustomer(selectedCustomer);
                  await loadData();
                } catch (e) {
                  console.error(e);
                  toast.error('خطأ غير متوقع');
                }
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الإيصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input
                type="number"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                placeholder="المبلغ"
              />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={receiptMethod} onValueChange={setReceiptMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                placeholder="رقم المرجع أو الشيك"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ الدفع</label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="ملاحظات إضافية"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditReceiptOpen(false)}>إلغاء</Button>
              <Button onClick={saveReceiptEdit}>حفظ التعديلات</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
