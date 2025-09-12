import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { getContracts, getContractWithBillboards, Contract } from '@/services/contractService';
import { Printer, FilePlus, Receipt, Save, Edit2 } from 'lucide-react';

interface PaymentRecord {
  id?: string;
  type: 'invoice' | 'receipt';
  number: string;
  contract_id: string;
  customer_name: string;
  date: string; // ISO
  amount: number;
  notes?: string;
}

const LS_KEY = 'payments_receipts_v1';

function loadLocal(): PaymentRecord[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveLocal(rows: PaymentRecord[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch {} }

export default function Payments() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PaymentRecord>({
    type: 'invoice', number: '', contract_id: '', customer_name: '', date: new Date().toISOString().slice(0,10), amount: 0, notes: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await getContracts();
        setContracts(list as any);
      } catch {}
      // try fetch from supabase (payments_receipts), else payments/receipts tables, else local
      try {
        let data: any[] = [];
        const pr = await supabase.from('payments_receipts').select('*').order('date',{ascending:false});
        if (!pr.error && Array.isArray(pr.data)) data = pr.data;
        if (data.length === 0) {
          const p = await supabase.from('payments').select('*');
          const r = await supabase.from('receipts').select('*');
          if (!p.error && Array.isArray(p.data)) data.push(...p.data.map(d=>({ ...d, type: 'invoice' })));
          if (!r.error && Array.isArray(r.data)) data.push(...r.data.map(d=>({ ...d, type: 'receipt' })));
        }
        if (data.length) {
          const mapped: PaymentRecord[] = data.map((d: any) => ({
            id: String(d.id ?? d.number ?? d.timestamp ?? crypto.randomUUID()),
            type: (d.type === 'invoice' || d.type === 'receipt') ? d.type : (d.type === 'payment' ? 'invoice' : 'receipt'),
            number: String(d.number ?? d.No ?? d.id ?? ''),
            contract_id: String(d.contract_id ?? d.contract ?? ''),
            customer_name: String(d.customer_name ?? d.customer ?? d['Customer Name'] ?? ''),
            date: (d.date ?? d.created_at ?? new Date().toISOString()).slice(0,10),
            amount: Number(d.amount ?? d.total ?? 0),
            notes: d.notes ?? '',
          }));
          setRecords(mapped.sort((a,b)=>b.date.localeCompare(a.date)));
          saveLocal(mapped);
        } else {
          setRecords(loadLocal());
        }
      } catch {
        setRecords(loadLocal());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!form.contract_id) return;
    (async () => {
      try {
        const det = await getContractWithBillboards(String(form.contract_id));
        const name = det?.customer_name || (det as any)['Customer Name'] || '';
        setForm(prev => ({ ...prev, customer_name: name }));
      } catch {}
    })();
  }, [form.contract_id]);

  const addOrUpdate = async () => {
    try {
      if (!form.contract_id || !form.number || !form.date || !form.amount) {
        toast.error('أكمل جميع الحقول المطلوبة');
        return;
      }
      const payload: any = {
        type: form.type,
        number: form.number,
        contract_id: form.contract_id,
        customer_name: form.customer_name,
        date: form.date,
        amount: form.amount,
        notes: form.notes || null,
      };
      let ok = false; let inserted: any = null;
      // prefer unified table
      try {
        const { data, error } = await supabase.from('payments_receipts').upsert(payload).select().single();
        if (!error && data) { ok = true; inserted = data; }
      } catch {}
      if (!ok) {
        const table = form.type === 'invoice' ? 'payments' : 'receipts';
        try {
          const { data, error } = await supabase.from(table).upsert(payload).select().single();
          if (!error && data) { ok = true; inserted = data; }
        } catch {}
      }
      if (!ok) {
        const next: PaymentRecord = { ...form, id: editingId || crypto.randomUUID() };
        const list = editingId ? records.map(r => r.id === editingId ? next : r) : [next, ...records];
        setRecords(list); saveLocal(list);
      } else {
        const rec: PaymentRecord = {
          id: String(inserted.id ?? editingId ?? crypto.randomUUID()),
          type: form.type,
          number: String(inserted.number ?? form.number),
          contract_id: String(inserted.contract_id ?? form.contract_id),
          customer_name: String(inserted.customer_name ?? form.customer_name),
          date: (inserted.date ?? form.date).slice(0,10),
          amount: Number(inserted.amount ?? form.amount),
          notes: inserted.notes ?? form.notes,
        };
        const list = editingId ? records.map(r => r.id === editingId ? rec : r) : [rec, ...records];
        setRecords(list); saveLocal(list);
      }
      setEditingId(null);
      toast.success('تم الحفظ');
    } catch (e) {
      console.error(e);
      toast.error('فشل الحفظ');
    }
  };

  const startEdit = (r: PaymentRecord) => {
    setForm({ ...r });
    setEditingId(r.id || null);
  };

  const printInvoice = (r: PaymentRecord) => {
    const html = `<!doctype html><html dir=rtl lang=ar><head><meta charset=utf-8 />
      <title>فاتورة ${r.number}</title>
      <style>
        @page{size:A4;margin:15mm}
        body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:3px solid #d4af37;padding-bottom:8px}
        .title{font-weight:800;font-size:22px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #eee;padding:8px;text-align:right}
        th{background:#faf6e8}
      </style></head><body>
      <div class=header><div class=title>فاتورة</div><div>${new Date(r.date).toLocaleDateString('ar-LY')}</div></div>
      <div>رقم الفاتورة: <b>${r.number}</b></div>
      <div>رقم العقد: <b>${r.contract_id}</b></div>
      <div>العميل: <b>${r.customer_name}</b></div>
      <table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead>
      <tbody><tr><td>قيمة مستحقة حسب العقد</td><td>${r.amount.toLocaleString('ar-LY')} د.ل</td></tr></tbody>
      <tfoot><tr><td>الإجمالي</td><td>${r.amount.toLocaleString('ar-LY')} د.ل</td></tr></tfoot></table>
      <div style="margin-top:12px">ملاحظات: ${r.notes || '—'}</div>
      <div style="margin-top:16px"><button onclick="window.print()">طباعة</button></div>
    </body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); w.focus();
  };

  const printReceipt = (r: PaymentRecord) => {
    const html = `<!doctype html><html dir=rtl lang=ar><head><meta charset=utf-8 />
      <title>إيصال قبض ${r.number}</title>
      <style>
        @page{size:A4;margin:15mm}
        body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:3px solid #d4af37;padding-bottom:8px}
        .title{font-weight:800;font-size:22px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #eee;padding:8px;text-align:right}
        th{background:#faf6e8}
      </style></head><body>
      <div class=header><div class=title>إيصال قبض</div><div>${new Date(r.date).toLocaleDateString('ar-LY')}</div></div>
      <div>رقم الإيصال: <b>${r.number}</b></div>
      <div>استلمنا من: <b>${r.customer_name}</b></div>
      <div>عن عقد رقم: <b>${r.contract_id}</b></div>
      <table><thead><tr><th>المبلغ</th><th>تفاصيل</th></tr></thead>
      <tbody><tr><td>${r.amount.toLocaleString('ar-LY')} د.ل</td><td>${r.notes || '—'}</td></tr></tbody></table>
      <div style="margin-top:16px"><button onclick="window.print()">طباعة</button></div>
    </body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); w.focus();
  };

  const nextNumber = useMemo(() => {
    const prefix = new Date().getFullYear();
    const seq = String(records.length + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  }, [records.length]);

  useEffect(() => {
    if (!editingId && !form.number) setForm(prev => ({ ...prev, number: nextNumber }));
  }, [nextNumber, editingId]);

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilePlus className="h-5 w-5 text-primary" /> سجل الدفعات والإيصالات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v)=>setForm(prev=>({...prev, type: v as any}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">فاتورة</SelectItem>
                  <SelectItem value="receipt">إيصال قبض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>رقم الوثيقة</Label>
              <Input value={form.number} onChange={(e)=>setForm(prev=>({...prev, number: e.target.value}))} />
            </div>
            <div>
              <Label>العقد</Label>
              <Select value={form.contract_id} onValueChange={(v)=>setForm(prev=>({...prev, contract_id: v}))}>
                <SelectTrigger><SelectValue placeholder="اختر عقدًا" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {contracts.map((c) => (
                    <SelectItem key={String((c as any).id)} value={String((c as any).id)}>
                      {String((c as any).id)} • {(c as any).customer_name || (c as any)['Customer Name'] || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e)=>setForm(prev=>({...prev, date: e.target.value}))} />
            </div>
            <div>
              <Label>المبلغ</Label>
              <Input type="number" value={form.amount} onChange={(e)=>setForm(prev=>({...prev, amount: Number(e.target.value) || 0}))} />
            </div>
            <div className="md:col-span-5">
              <Label>ملاحظات</Label>
              <Input value={form.notes || ''} onChange={(e)=>setForm(prev=>({...prev, notes: e.target.value}))} />
            </div>
            <div className="md:col-span-5 flex gap-2">
              <Button onClick={addOrUpdate} className="bg-primary text-primary-foreground"><Save className="h-4 w-4 ml-2" /> {editingId ? 'تحديث' : 'حفظ'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">السجلات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>رقم</TableHead>
                  <TableHead>العقد</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.type === 'invoice' ? 'فاتورة' : 'إيصال'}</TableCell>
                    <TableCell>{r.number}</TableCell>
                    <TableCell>{r.contract_id}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell>{new Date(r.date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell>{r.amount.toLocaleString('ar-LY')} د.ل</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {r.type === 'invoice' ? (
                          <Button size="sm" variant="outline" onClick={()=>printInvoice(r)}><Printer className="h-4 w-4 ml-1" /> طباعة فاتورة</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={()=>printReceipt(r)}><Printer className="h-4 w-4 ml-1" /> طباعة إيصال</Button>
                        )}
                        {r.type === 'receipt' && (
                          <Button size="sm" variant="ghost" onClick={()=>startEdit(r)}><Edit2 className="h-4 w-4 ml-1" /> تعديل</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-muted-foreground">لا توجد سجلات بعد</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
