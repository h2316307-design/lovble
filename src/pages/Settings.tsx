import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export default function Settings() {
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [readOnly, setReadOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    setReadOnly(false);
    try {
      const { data, error } = await supabase.from('municipalities').select('*').order('name');
      if (error) throw error;
      setMunicipalities(data || []);
    } catch (e: any) {
      console.error('load municipalities:', e?.message || e);
      toast.error(e?.message || 'فشل تحميل البلديات، سيتم استخدام قائمة مشتقة مؤقتًا');
      try {
        const { data: boards, error: bErr } = await supabase
          .from('billboards')
          .select('Municipality')
          .not('Municipality', 'is', null);
        if (bErr) throw bErr;
        const uniq = Array.from(new Set((boards || []).map((b: any) => String(b.Municipality).trim()).filter(Boolean)));
        setMunicipalities(uniq.map((name) => ({ id: name, name, code: '' })));
        setReadOnly(true);
      } catch (fb: any) {
        console.error('fallback municipalities:', fb?.message || fb);
        setMunicipalities([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addMunicipality = async () => {
    if (readOnly) { toast.error('وضع القراءة فقط، قاعدة البلديات غير متاحة'); return; }
    const name = String(newName || '').trim();
    const code = String(newCode || '').trim();
    if (!name || !code) { toast.error('أدخل الاسم والكود'); return; }
    try {
      const { data, error } = await supabase.from('municipalities').insert({ name, code }).select().single();
      if (error) throw error;
      toast.success('تمت الإضافة');
      setNewName(''); setNewCode('');
      load();
    } catch (e:any) { console.error('add municipality:', e?.message || e); toast.error(e?.message || 'فشل الإضافة'); }
  };

  const startEdit = (m: any) => {
    if (readOnly) { toast.error('وضع القراءة فقط، قاعدة البلديات غير متاحة'); return; }
    setEditId(m.id); setEditName(m.name); setEditCode(m.code);
  };

  const saveEdit = async () => {
    if (readOnly) { toast.error('وضع القراءة فقط، قاعدة البلديات غير متاحة'); return; }
    if (!editId) return;
    const name = String(editName || '').trim();
    const code = String(editCode || '').trim();
    if (!name || !code) { toast.error('أدخل الاسم والكود'); return; }
    try {
      const { error } = await supabase.from('municipalities').update({ name, code }).eq('id', editId);
      if (error) throw error;
      toast.success('تم الحفظ');
      setEditId(null); setEditName(''); setEditCode('');
      load();
    } catch (e:any) { console.error('save municipality:', e?.message || e); toast.error(e?.message || 'فشل الحفظ'); }
  };

  const cancelEdit = () => { setEditId(null); setEditName(''); setEditCode(''); };

  const deleteMunicipality = async (id: string) => {
    if (readOnly) { toast.error('وضع القراءة فقط، قاعدة البلديات غير متاحة'); return; }
    if (!confirm('هل أنت متأكد من حذف هذه البلدية؟')) return;
    try {
      const { error } = await supabase.from('municipalities').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم الحذف');
      load();
    } catch (e:any) { console.error('delete municipality:', e?.message || e); toast.error(e?.message || 'فشل الحذف'); }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle>الإعدادات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">إعدادات النظام ولوحة التحكم.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>البلديات</CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly && (
            <div className="mb-4 text-sm text-orange-600">تعذر الوصول لجدول البلديات. يتم عرض قائمة مشتقة من اللوحات (قراءة فقط).</div>
          )}
          <div className="flex gap-2 mb-4">
            <Input placeholder="اسم البلدية" value={newName} onChange={(e:any)=>setNewName(e.target.value)} disabled={readOnly || loading} />
            <Input placeholder="كود البلدية" value={newCode} onChange={(e:any)=>setNewCode(e.target.value)} disabled={readOnly || loading} />
            <Button onClick={addMunicipality} disabled={readOnly || loading}>إضافة بلدية</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الكود</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {municipalities.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {editId === m.id ? (
                      <Input value={editName} onChange={(e:any)=>setEditName(e.target.value)} disabled={readOnly} />
                    ) : m.name}
                  </TableCell>
                  <TableCell>
                    {editId === m.id ? (
                      <Input value={editCode} onChange={(e:any)=>setEditCode(e.target.value)} disabled={readOnly} />
                    ) : (m.code || '-')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {editId === m.id ? (
                        <>
                          <Button size="sm" onClick={saveEdit} disabled={readOnly}>حفظ</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>إلغاء</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => startEdit(m)} disabled={readOnly}>تعديل</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteMunicipality(m.id)} disabled={readOnly}>حذف</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
