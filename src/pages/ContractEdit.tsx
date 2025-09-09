import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Search, Calendar, User, DollarSign, X } from 'lucide-react';
import { loadBillboards } from '@/services/billboardService';
import type { Billboard } from '@/types';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { useLocation, useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { getPriceFor, CustomerType } from '@/data/pricing';

export default function ContractEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractNumber, setContractNumber] = useState<string>('');

  // selection
  const [selected, setSelected] = useState<string[]>([]);

  // customers combobox (id+name)
  const [customers, setCustomers] = useState<{id:string; name:string}[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>('all');
  const [size, setSize] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  // form fields
  const [customerName, setCustomerName] = useState('');
  const [adType, setAdType] = useState('');
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [startDate, setStartDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [endDate, setEndDate] = useState('');
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn) setContractNumber(String(cn));
  }, [location.search]);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadBillboards();
        setBillboards(data);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('customers').select('id,name').order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCustomers((data as any) || []);
        }
      } catch (e) {
        console.warn('load customers failed');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setCustomerId(c.customer_id ?? null);
        setAdType(c.ad_type || c['Ad Type'] || '');
        const s = c.start_date || c['Contract Date'] || '';
        const e = c.end_date || c['End Date'] || '';
        setStartDate(s);
        setEndDate(e);
        // infer duration in months
        if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            let months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
            if (months <= 0) months = 3;
            setDurationMonths(months);
          }
        }
        const savedTotal = typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] || 0);
        setRentCost(savedTotal);
        setOriginalTotal(savedTotal || 0);
        const disc = Number((c as any).Discount ?? 0);
        if (!isNaN(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(disc);
        }
        setSelected((c.billboards || []).map((b: any) => String(b.ID)));
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  const cities = useMemo(() => Array.from(new Set(billboards.map(b => b.city || b.City))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => b.size || b.Size))).filter(Boolean) as string[], [billboards]);

  // compute end date automatically based on start and selected duration
  useEffect(() => {
    if (!startDate || !durationMonths) return;
    const d = new Date(startDate);
    const end = new Date(d);
    end.setMonth(end.getMonth() + durationMonths);
    const iso = end.toISOString().split('T')[0];
    setEndDate(iso);
  }, [startDate, durationMonths]);

  // estimated total based on pricing
  const estimatedTotal = useMemo(() => {
    const months = Number(durationMonths || 0);
    if (!months) return 0;
    const sel = billboards.filter(b => selected.includes(String(b.ID)));
    return sel.reduce((acc, b) => {
      const size = (b.size || (b as any).Size || '') as string;
      const level = (b.level || (b as any).Level) as any;
      const price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      if (price !== null) return acc + price;
      const monthly = Number((b as any).price) || 0;
      return acc + monthly * months;
    }, 0);
  }, [billboards, selected, durationMonths, pricingCategory]);

  const baseTotal = useMemo(() => (rentCost && rentCost > 0 ? rentCost : estimatedTotal), [rentCost, estimatedTotal]);

  // auto update rent cost with new estimation unless user manually edited it
  useEffect(() => {
    if (!userEditedRentCost) {
      setRentCost(estimatedTotal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedTotal]);
  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountType === 'percent' ? (baseTotal * Math.max(0, Math.min(100, discountValue)) / 100) : Math.max(0, discountValue);
  }, [discountType, discountValue, baseTotal]);
  const finalTotal = useMemo(() => Math.max(0, baseTotal - discountAmount), [baseTotal, discountAmount]);

  const filtered = useMemo(() => {
    return billboards.filter((b) => {
      const text = (b.name || b.Billboard_Name || '').toLowerCase();
      const loc = (b.location || b.Nearest_Landmark || '').toLowerCase();
      const c = (b.city || b.City || '').toString();
      const s = (b.size || b.Size || '').toString();
      const st = (b.status || b.Status || '').toString();
      const matchesQ = !q || text.includes(q.toLowerCase()) || loc.includes(q.toLowerCase());
      const matchesCity = city === 'all' || c === city;
      const matchesSize = size === 'all' || s === size;
      // allow selecting items already in this contract; otherwise prefer available only when status filter is 'available'
      const isInContract = selected.includes(String(b.ID));
      const matchesStatus = status === 'all' || (status === 'available' ? (st === 'available' || (!b.contractNumber && !b.Contract_Number) || isInContract) : true);
      return matchesQ && matchesCity && matchesSize && matchesStatus;
    });
  }, [billboards, q, city, size, status, selected]);

  const toggleSelect = (b: Billboard) => {
    const id = String(b.ID);
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const removeSelected = (id: string) => setSelected((prev) => prev.filter(x => x !== id));

  const save = async () => {
    try {
      if (!contractNumber) return;
      // fetch current to compare (could also track previous state separately)
      const c = await getContractWithBillboards(contractNumber);
      const current: string[] = (c.billboards || []).map((b: any) => String(b.ID));
      const toAdd = selected.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !selected.includes(id));

      if (toAdd.length > 0) {
        await addBillboardsToContract(contractNumber, toAdd, {
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
        });
      }
      for (const id of toRemove) {
        await removeBillboardFromContract(contractNumber, id);
      }

      const updates: any = {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        'Total Rent': finalTotal,
        'Discount': discountAmount,
      };
      if (customerId) updates.customer_id = customerId;
      await updateContract(contractNumber, updates);

      toast.success('تم حفظ التعديلات');
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل حفظ التعديلات');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">تعديل عقد {contractNumber && `#${contractNumber}`}</h1>
          <p className="text-muted-foreground">تعديل تفاصيل العقد واللوحات المرتبطة به</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/contracts')}>
            عودة
          </Button>
          <Button onClick={save} className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth">
            حفظ التعديلات
          </Button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* main area */}
        <div className="flex-1 space-y-6">
          {/* selected on top */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                اللوحات المرتبطة ({selected.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected.length === 0 ? (
                <p className="text-muted-foreground">لا توجد لوحات</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {billboards.filter(b => selected.includes(String(b.ID))).map((b) => {
                    const months = Number(durationMonths || 0);
                    const size = (b.size || (b as any).Size || '') as string;
                    const level = (b.level || (b as any).Level) as any;
                    const price = months ? getPriceFor(size, level, pricingCategory as CustomerType, months) : null;
                    const fallback = (Number((b as any).price) || 0) * (months || 1);
                    const totalForBoard = price !== null ? price : fallback;
                    return (
                      <Card key={b.ID} className="overflow-hidden">
                        <CardContent className="p-0">
                          {b.image && (
                            <img src={b.image} alt={b.name || b.Billboard_Name} className="w-full h-36 object-cover" />
                          )}
                          <div className="p-3 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{b.name || b.Billboard_Name}</div>
                              <div className="text-xs text-muted-foreground">{b.location || b.Nearest_Landmark}</div>
                              <div className="text-xs">الحجم: {b.size || b.Size} • {b.city || b.City}</div>
                              <div className="text-xs font-medium mt-1">السعر: {totalForBoard.toLocaleString('ar-LY')} د.ل {months ? `/${months} شهر` : ''}</div>
                            </div>
                            <Button size="sm" variant="destructive" onClick={() => removeSelected(String(b.ID))}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* filters */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                البحث والتصفية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 relative min-w-[220px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="بحث عن لوحة" value={q} onChange={(e) => setQ(e.target.value)} className="pr-9" />
                </div>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="المدينة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المدن</SelectItem>
                    {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="المقاس" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المقاسات</SelectItem>
                    {sizes.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="available">المتاحة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* grid below */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                كل اللوحات ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 text-center">جاري ��لتحميل...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((b) => {
                    const isSelected = selected.includes(String(b.ID));
                    const st = (b.status || b.Status || '').toString();
                    const notAvailable = st === 'rented' || (!!b.contractNumber || !!b.Contract_Number);
                    const disabled = notAvailable && !isSelected;
                    return (
                      <Card key={b.ID} className={`overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
                        <CardContent className="p-0">
                          {b.image && (
                            <img src={b.image} alt={b.name || b.Billboard_Name} className="w-full h-40 object-cover" />
                          )}
                          <div className="p-3 space-y-1">
                            <div className="font-semibold">{b.name || b.Billboard_Name}</div>
                            <div className="text-xs text-muted-foreground">{b.location || b.Nearest_Landmark}</div>
                            <div className="text-xs">{b.city || b.City} • {b.size || b.Size}</div>
                            <div className="text-sm font-medium">{(Number(b.price) || 0).toLocaleString('ar-LY')} د.ل / شهر</div>
                            <div className="pt-2">
                              <Button size="sm" variant={isSelected ? 'destructive' : 'outline'} onClick={() => toggleSelect(b)} disabled={disabled}>
                                {isSelected ? 'إزالة' : 'إضافة'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* sidebar */}
        <div className="w-full lg:w-[360px] space-y-4">
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> 
                بيانات الزبون
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm">اسم الزبون</label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {customerName ? customerName : 'اختر أو اكتب اسم الزبون'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Command>
                      <CommandInput placeholder="ابحث أو اكتب اسم جديد" value={customerQuery} onValueChange={setCustomerQuery} />
                      <CommandList>
                        <CommandEmpty>
                          <Button variant="ghost" className="w-full justify-start" onClick={async () => {
                            if (customerQuery.trim()) {
                              const name = customerQuery.trim();
                              try {
                                const { data: newC, error } = await supabase.from('customers').insert({ name }).select().single();
                                if (!error && newC && (newC as any).id) {
                                  setCustomerId((newC as any).id);
                                  setCustomerName(name);
                                  setCustomers(prev => [{ id: (newC as any).id, name }, ...prev]);
                                }
                              } catch (e) { console.warn(e); }
                              setCustomerOpen(false);
                              setCustomerQuery('');
                            }
                          }}>
                            إضافة "{customerQuery}" كعميل جديد
                          </Button>
                        </CommandEmpty>
                        <CommandGroup>
                          {customers.map((c) => (
                            <CommandItem key={c.id} value={c.name} onSelect={() => {
                              setCustomerName(c.name);
                              setCustomerId(c.id);
                              setCustomerOpen(false);
                              setCustomerQuery('');
                            }}>
                              {c.name}
                            </CommandItem>
                          ))}
                          {customerQuery && !customers.some(x => x.name === customerQuery.trim()) && (
                            <CommandItem
                              value={`__add_${customerQuery}`}
                              onSelect={async () => {
                                const name = customerQuery.trim();
                                try {
                                  const { data: newC, error } = await supabase.from('customers').insert({ name }).select().single();
                                  if (!error && newC && (newC as any).id) {
                                    setCustomerId((newC as any).id);
                                    setCustomerName(name);
                                    setCustomers(prev => [{ id: (newC as any).id, name }, ...prev]);
                                  }
                                } catch (e) { console.warn(e); }
                                setCustomerOpen(false);
                                setCustomerQuery('');
                              }}
                            >
                              إضافة "{customerQuery}" كعميل جديد
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm">نوع الإعلان</label>
                <Input value={adType} onChange={(e) => setAdType(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">فئة السعر</label>
                <Select value={pricingCategory} onValueChange={setPricingCategory}>
                  <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="عادي">عادي</SelectItem>
                    <SelectItem value="شركات">شركات</SelectItem>
                    <SelectItem value="مسوق">مسوق</SelectItem>
                    <SelectItem value="المدينة">المدينة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> 
                المدة والتواريخ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm">تاريخ البداية</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">المدة (بالأشهر)</label>
                <Select value={String(durationMonths)} onValueChange={(v) => setDurationMonths(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="اختر المدة" /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,6,12].map(m => (<SelectItem key={m} value={String(m)}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">تاريخ النهاية</label>
                <Input type="date" value={endDate} readOnly disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> التكلفة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">تقدير تلقائي حسب الفئة والمدة: {estimatedTotal.toLocaleString('ar-LY')} د.ل</div>
              <Input type="number" value={rentCost} onChange={(e) => { setRentCost(Number(e.target.value)); setUserEditedRentCost(true); }} placeholder="تكلفة قبل الخصم (تُحدّث تلقائياً)" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">نوع الخصم</label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                    <SelectTrigger><SelectValue placeholder="نوع الخصم" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">نسبة %</SelectItem>
                      <SelectItem value="amount">قيمة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">قيمة الخصم</label>
                  <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value) || 0)} placeholder="0" />
                </div>
              </div>
              <div className="text-sm">الإجمالي قبل الخصم: {baseTotal.toLocaleString('ar-LY')} د.ل</div>
              <div className="text-sm">الخصم: {discountAmount.toLocaleString('ar-LY')} د.ل</div>
              <div className="text-base font-semibold">الإجمالي بعد الخصم: {finalTotal.toLocaleString('ar-LY')} د.ل</div>
              <div className="text-sm text-muted-foreground">السابق: {originalTotal.toLocaleString('ar-LY')} د.ل • الفرق: {(finalTotal - originalTotal).toLocaleString('ar-LY')} د.ل</div>
              <Button className="w-full" onClick={save}>حفظ التعديلات</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/contracts')}>إلغاء</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
