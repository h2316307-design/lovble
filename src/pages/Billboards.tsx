import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelect from '@/components/ui/multi-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { MapPin, DollarSign, Filter, Plus, Search, Eye, Edit } from 'lucide-react';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Billboard } from '@/types';
import { searchBillboards } from '@/services/billboardService';
import { fetchAllBillboards } from '@/services/supabaseService';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

export default function Billboards() {
  const navigate = useNavigate();
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [adTypeFilter, setAdTypeFilter] = useState<string>('all');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Billboard | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Add billboard dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const openEdit = (bb: Billboard) => {
    setEditing(bb);
    setEditForm({
      Billboard_Name: bb.name || '',
      City: (bb as any).City || bb.city || '',
      Municipality: (bb as any).Municipality || (bb as any).municipality || '',
      District: (bb as any).District || (bb as any).district || '',
      Nearest_Landmark: (bb as any).Nearest_Landmark || bb.location || '',
      Size: (bb as any).Size || bb.size || '',
      Status: (bb as any).Status || bb.status || 'available',
      Level: (bb as any).Level || bb.level || 'A',
      Contract_Number: (bb as any).contractNumber || (bb as any).Contract_Number || '',
      Customer_Name: (bb as any).clientName || (bb as any).Customer_Name || '',
      Ad_Type: (bb as any).adType || (bb as any).Ad_Type || '',
      Image_URL: (bb as any).Image_URL || bb.image || '',
      // partnership fields
      is_partnership: !!(bb as any).is_partnership,
      partner_companies: (bb as any).partner_companies || (bb as any).partners || [],
      capital: (bb as any).capital || 0,
      capital_remaining: (bb as any).capital_remaining || (bb as any).capitalRemaining || (bb as any).capital || 0
    });
    setEditOpen(true);
  };

  // initialize add form defaults
  useEffect(() => {
    setAddForm({
      Billboard_Name: '',
      City: '',
      Municipality: '',
      District: '',
      Nearest_Landmark: '',
      Size: '',
      Status: 'available',
      Level: 'A',
      Image_URL: '',
      is_partnership: false,
      partner_companies: [],
      capital: 0,
      capital_remaining: 0
    });
  }, []);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const id = editing.id;
    const { Billboard_Name, City, Municipality, District, Nearest_Landmark, Size, Level, Image_URL, is_partnership, partner_companies, capital, capital_remaining } = editForm as any;
    const payload: any = { Billboard_Name, City, Municipality, District, Nearest_Landmark, Size, Level, Image_URL, is_partnership: !!is_partnership, partner_companies: Array.isArray(partner_companies) ? partner_companies : String(partner_companies).split(',').map(s=>s.trim()).filter(Boolean), capital: Number(capital)||0, capital_remaining: Number(capital_remaining)||Number(capital)||0 };

    const { error } = await supabase.from('billboards').update(payload).eq('ID', Number(id));

    if (error) {
      toast.error(`فشل حفظ التعديلات: ${error.message}`);
    } else {
      toast.success('تم حفظ التعديلات');
      try {
        await loadBillboards();
      } catch {}
      setEditOpen(false);
      setEditing(null);
    }
    setSaving(false);
  };

  const addBillboard = async () => {
    setAdding(true);
    const { Billboard_Name, City, Municipality, District, Nearest_Landmark, Size, Level, Image_URL, is_partnership, partner_companies, capital, capital_remaining } = addForm as any;
    const payload: any = { Billboard_Name, City, Municipality, District, Nearest_Landmark, Size, Level, Image_URL, is_partnership: !!is_partnership, partner_companies: Array.isArray(partner_companies) ? partner_companies : String(partner_companies).split(',').map(s=>s.trim()).filter(Boolean), capital: Number(capital)||0, capital_remaining: Number(capital_remaining)||Number(capital)||0 };
    try {
      const { data, error } = await supabase.from('billboards').insert(payload).select().single();
      if (error) throw error;
      toast.success('تم إضافة اللوحة');
      await loadBillboards();
      setAddOpen(false);
    } catch (e:any) {
      console.error('add billboard error', e);
      toast.error(e?.message || 'فشل الإضافة');
    } finally {
      setAdding(false);
    }
  };

  const loadBillboards = async () => {
    try {
      const data = await fetchAllBillboards();
      setBillboards(data as any);
      console.log('Loaded billboards (with fallbacks):', data.length);
    } catch (error) {
      console.error('خطأ في تحميل اللوحات:', (error as any)?.message || JSON.stringify(error));
      setBillboards([] as any);
    }
  };

  useEffect(() => {
    const fetchBillboards = async () => {
      setLoading(true);
      await loadBillboards();
      setLoading(false);
    };

    fetchBillboards();
  }, []);

  const getStatusBadge = (status: Billboard['status']) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-success text-success-foreground border-success">متاح</Badge>;
      case 'rented':
        return <Badge className="bg-warning text-warning-foreground border-warning">مؤجر</Badge>;
      case 'maintenance':
        return <Badge className="bg-destructive text-destructive-foreground border-destructive">صيانة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const cities = [...new Set(billboards.map(b => b.city).filter(Boolean))];
  const sizes = [...new Set(billboards.map(b => (b as any).Size || b.size).filter(Boolean))];
  const municipalities = [...new Set(billboards.map(b => (b as any).Municipality || (b as any).municipality).filter(Boolean))];
  const districts = [...new Set(billboards.map(b => (b as any).District || (b as any).district).filter(Boolean))];
  const levels = [...new Set(billboards.map(b => (b as any).Level || b.level).filter(Boolean))];
  const uniqueAdTypes = [...new Set(billboards.map((b:any) => (b.Ad_Type ?? b['Ad Type'] ?? b.adType ?? '')).filter(Boolean))] as string[];
  const uniqueCustomers = [...new Set(billboards.map((b:any) => (b.Customer_Name ?? b.clientName ?? b.contract?.customer_name ?? '')).filter(Boolean))] as string[];
  const uniqueContractNumbers = [...new Set(billboards.map((b:any) => String(b.Contract_Number ?? b.contractNumber ?? '')).filter((v:string) => v && v !== 'undefined' && v !== 'null'))] as string[];

  const searched = searchBillboards(billboards, searchQuery);
  const filteredBillboards = searched.filter((billboard) => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(billboard.status as any);
    const matchesCity = selectedCities.length === 0 || selectedCities.includes((billboard.city || '') as any);
    const matchesSize = sizeFilter === 'all' || ((billboard as any).Size || billboard.size) === sizeFilter;
    const matchesMunicipality = municipalityFilter === 'all' || ((billboard as any).Municipality || (billboard as any).municipality || '') === municipalityFilter;
    const adTypeVal = String((billboard as any).Ad_Type ?? (billboard as any)['Ad Type'] ?? (billboard as any).adType ?? '');
    const matchesAdType = adTypeFilter === 'all' || adTypeVal === adTypeFilter;
    const customerVal = String((billboard as any).Customer_Name ?? (billboard as any).clientName ?? (billboard as any).contract?.customer_name ?? '');
    const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(customerVal);
    const contractNoVal = String((billboard as any).Contract_Number ?? (billboard as any).contractNumber ?? '');
    const matchesContractNo = selectedContractNumbers.length === 0 || selectedContractNumbers.includes(contractNoVal);
    return matchesStatus && matchesCity && matchesSize && matchesMunicipality && matchesAdType && matchesCustomer && matchesContractNo;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBillboards.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBillboards = filteredBillboards.slice(startIndex, startIndex + PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل اللوحات الإعلانية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* العنوان والأزرار */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة اللوحات الإعلانية</h1>
          <p className="text-muted-foreground">عرض وإدارة جميع اللوحات الإعلانية مع معلومات العقود المرتبطة</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)} className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth">
            <Plus className="h-4 w-4 ml-2" />
            إضافة لوحة
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/shared-billboards')}>اللوحات المشتركة</Button>
        </div>
      </div>

      {/* أدوات التصفية والبحث */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-primary" />
            البحث في اللوحات...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن اللوحات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <MultiSelect
              options={[
                { label: 'متاح', value: 'available' },
                { label: 'مؤجر', value: 'rented' },
                { label: 'صيانة', value: 'maintenance' },
              ]}
              value={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="الحالة (متعدد)"
            />

            <MultiSelect
              options={cities.map(c => ({ label: c, value: c }))}
              value={selectedCities}
              onChange={setSelectedCities}
              placeholder="جميع المدن"
            />

            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حجم اللوحة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأحجام</SelectItem>
                {sizes.map((s) => (<SelectItem key={String(s)} value={String(s)}>{String(s)}</SelectItem>))}
              </SelectContent>
            </Select>

            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="البلدية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع البلديات</SelectItem>
                {municipalities.map((m) => (<SelectItem key={String(m)} value={String(m)}>{String(m)}</SelectItem>))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {adTypeFilter === 'all' ? 'نوع الإعلان (الكل)' : `نوع الإعلان: ${adTypeFilter}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث عن نوع الإعلان..." />
                  <CommandList>
                    <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setAdTypeFilter('all')}>الكل</CommandItem>
                      {uniqueAdTypes.map((t) => (
                        <CommandItem key={t} onSelect={() => setAdTypeFilter(t)}>{t}</CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <MultiSelect
              options={uniqueCustomers.map((c) => ({ label: c, value: c }))}
              value={selectedCustomers}
              onChange={setSelectedCustomers}
              placeholder="أسماء الزبائن (متعدد)"
            />

            <MultiSelect
              options={uniqueContractNumbers.map((n) => ({ label: n, value: n }))}
              value={selectedContractNumbers}
              onChange={setSelectedContractNumbers}
              placeholder="أرقام العقود (متعدد)"
            />
          </div>
        </CardContent>
      </Card>

      {/* عرض اللوحات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pagedBillboards.map((billboard, idx) => {
          const keyVal = String((billboard as any).id ?? (billboard as any).ID ?? `${(billboard as any).Billboard_Name ?? 'bb'}-${startIndex + idx}`);
          return (
            <div key={keyVal} className="space-y-2">
              <BillboardGridCard billboard={billboard as any} showBookingActions={false} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(billboard)}>
                  <Edit className="h-4 w-4 ml-1" />
                  تعديل
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredBillboards.length > 0 && (
        <div className="mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    isActive={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {filteredBillboards.length === 0 && (
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد لوحات</h3>
            <p className="text-muted-foreground">لم يتم العثور على لوحات تطابق معايير البحث المحددة</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل اللوحة</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>الاسم</Label>
              <Input value={editForm.Billboard_Name || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, Billboard_Name: e.target.value }))} />
            </div>
            <div>
              <Label>المدينة</Label>
              <Select value={editForm.City || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, City: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (<SelectItem key={c} value={c as string}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>أقرب معلم</Label>
              <Input value={editForm.Nearest_Landmark || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} />
            </div>
            <div>
              <Label>البلدية</Label>
              <Input list="municipality-list" value={editForm.Municipality || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, Municipality: e.target.value }))} placeholder="اختر أو اكتب بلدية" />
              <datalist id="municipality-list">
                {municipalities.map((m) => (<option key={String(m)} value={String(m)} />))}
              </datalist>
            </div>
            <div>
              <Label>المنطقة</Label>
              <Input list="district-list" value={editForm.District || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, District: e.target.value }))} placeholder="اختر أو اكتب منطقة" />
              <datalist id="district-list">
                {districts.map((d) => (<option key={String(d)} value={String(d)} />))}
              </datalist>
            </div>
            <div>
              <Label>المقاس</Label>
              <Select value={editForm.Size || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Size: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المقاس" /></SelectTrigger>
                <SelectContent>
                  {sizes.map((s) => (<SelectItem key={s} value={s as string}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المستوى</Label>
              <Select value={editForm.Level || ''} onValueChange={(v) => setEditForm((p: any) => ({ ...p, Level: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levels.map((lv) => (<SelectItem key={String(lv)} value={String(lv)}>{String(lv)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>رابط الصورة</Label>
              <Input value={editForm.Image_URL || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, Image_URL: e.target.value }))} />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <Label>لوحة شراكة</Label>
                <input type="checkbox" checked={!!editForm.is_partnership} onChange={(e)=> setEditForm((p:any)=>({...p, is_partnership: e.target.checked}))} />
              </div>
            </div>

            {editForm.is_partnership && (
              <>
                <div className="sm:col-span-2">
                  <Label>الشركات المشاركة (فصل بالفواصل)</Label>
                  <Input value={(Array.isArray(editForm.partner_companies)? editForm.partner_companies.join(', ') : editForm.partner_companies || '')} onChange={(e)=> setEditForm((p:any)=>({...p, partner_companies: e.target.value}))} />
                </div>
                <div>
                  <Label>رأس مال اللوحة</Label>
                  <Input type="number" value={editForm.capital || 0} onChange={(e)=> setEditForm((p:any)=>({...p, capital: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>المتبقي من رأس المال</Label>
                  <Input type="number" value={editForm.capital_remaining || editForm.capital || 0} onChange={(e)=> setEditForm((p:any)=>({...p, capital_remaining: Number(e.target.value)}))} />
                </div>
              </>
            )}

          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Billboard Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة لوحة جديدة</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>الاسم</Label>
              <Input value={addForm.Billboard_Name || ''} onChange={(e) => setAddForm((p: any) => ({ ...p, Billboard_Name: e.target.value }))} />
            </div>
            <div>
              <Label>المدينة</Label>
              <Input value={addForm.City || ''} onChange={(e) => setAddForm((p: any) => ({ ...p, City: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>أقرب معلم</Label>
              <Input value={addForm.Nearest_Landmark || ''} onChange={(e) => setAddForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} />
            </div>
            <div>
              <Label>المقاس</Label>
              <Input value={addForm.Size || ''} onChange={(e) => setAddForm((p: any) => ({ ...p, Size: e.target.value }))} />
            </div>
            <div>
              <Label>المستوى</Label>
              <Input value={addForm.Level || ''} onChange={(e) => setAddForm((p: any) => ({ ...p, Level: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>رابط الصورة</Label>
              <Input value={addForm.Image_URL || ''} onChange={(e) => setAddForm((p: any) => ({ ...p, Image_URL: e.target.value }))} />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <Label>لوحة شراكة</Label>
                <input type="checkbox" checked={!!addForm.is_partnership} onChange={(e)=> setAddForm((p:any)=>({...p, is_partnership: e.target.checked}))} />
              </div>
            </div>

            {addForm.is_partnership && (
              <>
                <div className="sm:col-span-2">
                  <Label>الشركات المشاركة (فصل بالفواصل)</Label>
                  <Input value={(Array.isArray(addForm.partner_companies)? addForm.partner_companies.join(', ') : addForm.partner_companies || '')} onChange={(e)=> setAddForm((p:any)=>({...p, partner_companies: e.target.value}))} />
                </div>
                <div>
                  <Label>رأس مال اللوحة</Label>
                  <Input type="number" value={addForm.capital || 0} onChange={(e)=> setAddForm((p:any)=>({...p, capital: Number(e.target.value)}))} />
                </div>
                <div>
                  <Label>المتبقي من رأس المال</Label>
                  <Input type="number" value={addForm.capital_remaining || addForm.capital || 0} onChange={(e)=> setAddForm((p:any)=>({...p, capital_remaining: Number(e.target.value)}))} />
                </div>
              </>
            )}

          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={addBillboard} disabled={adding}>{adding ? 'جاري الإضافة...' : 'إضافة'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
