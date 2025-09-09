import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getPriceFor, CustomerType, CUSTOMERS } from '@/data/pricing';
import { Button } from '@/components/ui/button';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Eye, Edit, Trash2, Calendar, User, DollarSign, Search, Filter, Building, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createContract,
  getContracts,
  getContractWithBillboards,
  getAvailableBillboards,
  updateContract,
  deleteContract,
  addBillboardsToContract,
  removeBillboardFromContract,
  Contract,
  ContractCreate
} from '@/services/contractService';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  const [customersList, setCustomersList] = useState<{id:string; name:string}[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignContractNumber, setAssignContractNumber] = useState<string | null>(null);
  const [assignCustomerId, setAssignCustomerId] = useState<string | null>(null);

  const [formData, setFormData] = useState<ContractCreate>({
    customer_name: '',
    ad_type: '',
    start_date: '',
    end_date: '',
    rent_cost: 0,
    billboard_ids: []
  });
  const [pricingCategory, setPricingCategory] = useState<CustomerType>('عادي');
  const [durationMonths, setDurationMonths] = useState<number>(3);

  const [bbSearch, setBbSearch] = useState('');

  const loadData = async () => {
    try {
      const contractsData = await getContracts();
      const billboardsData = await getAvailableBillboards();
      setContracts(contractsData as Contract[]);
      setAvailableBillboards(billboardsData || []);
      // load customers list
      try {
        const { data: cdata, error: cErr } = await supabase.from('customers').select('id,name').order('name', { ascending: true });
        if (!cErr && Array.isArray(cdata)) setCustomersList(cdata as any);
      } catch (e) {
        console.warn('failed to load customers list', e);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // احسب تاريخ النهاية تلقائياً حسب المدة المختارة
  useEffect(() => {
    if (!formData.start_date || !durationMonths) return;
    const d = new Date(formData.start_date);
    if (isNaN(d.getTime())) return;
    const end = new Date(d);
    end.setMonth(end.getMonth() + durationMonths);
    setFormData(prev => ({ ...prev, end_date: end.toISOString().split('T')[0] }));
  }, [formData.start_date, durationMonths]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn && !viewOpen) {
      handleViewContract(String(cn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleCreateContract = async () => {
    try {
      if (!formData.customer_name || !formData.start_date || !formData.end_date || formData.billboard_ids.length === 0) {
        toast.error('يرجى ملء جميع الحقول المطلو��ة');
        return;
      }

      await createContract(formData);
      toast.success('تم إنشاء ا��عقد بنجاح');
      setCreateOpen(false);
      setFormData({
        customer_name: '',
        ad_type: '',
        start_date: '',
        end_date: '',
        rent_cost: 0,
        billboard_ids: []
      });
      loadData();
    } catch (error) {
      console.error('خطأ في إنشاء العقد:', error);
      toast.error('فشل في إنشاء العقد');
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(contractId);
      setSelectedContract(contractWithBillboards);
      setViewOpen(true);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل العقد:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العقد؟')) {
      try {
        await deleteContract(contractId);
        toast.success('تم حذف العقد بنجاح');
        loadData();
      } catch (error) {
        console.error('خطأ في حذف العقد:', error);
        toast.error('فشل في حذف العقد');
      }
    }
  };

  const openAssignDialog = (contractNumber: string, currentCustomerId?: string | null) => {
    setAssignContractNumber(contractNumber);
    setAssignCustomerId(currentCustomerId ?? null);
    setAssignOpen(true);
  };

  const saveAssign = async () => {
    if (!assignContractNumber || !assignCustomerId) {
      toast.error('اختر زبونًا ثم احفظ');
      return;
    }
    const customer = customersList.find(c => c.id === assignCustomerId);
    try {
      await updateContract(assignContractNumber, { customer_id: assignCustomerId, 'Customer Name': customer?.name || '' });
      toast.success('تم تحديث العميل للعقد');
      setAssignOpen(false);
      setAssignContractNumber(null);
      setAssignCustomerId(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('فشل تحديث العقد');
    }
  };

  const getContractStatus = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return <Badge variant="secondary">غير محدد</Badge>;
    }
    
    if (today < startDate) {
      return <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        لم يبدأ
      </Badge>;
    } else if (today > endDate) {
      return <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        منتهي
      </Badge>;
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 30) {
        return <Badge className="bg-warning text-warning-foreground border-warning gap-1">
          <Clock className="h-3 w-3" />
          ينتهي قريباً ({daysRemaining} أيام)
        </Badge>;
      }
      return <Badge className="bg-success text-success-foreground border-success gap-1">
        <CheckCircle className="h-3 w-3" />
        نشط
      </Badge>;
    }
  };

  // تصفية العق��د
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((contract as any)['Ad Type'] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(contract.id || '').includes(searchQuery);

    const matchesCustomer = customerFilter === 'all' || contract.customer_name === customerFilter;
    
    if (statusFilter === 'all') return matchesSearch && matchesCustomer;
    
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) return false;
    
    let matchesStatus = false;
    if (statusFilter === 'active') {
      matchesStatus = today >= startDate && today <= endDate;
    } else if (statusFilter === 'expired') {
      matchesStatus = today > endDate;
    } else if (statusFilter === 'upcoming') {
      matchesStatus = today < startDate;
    } else if (statusFilter === 'expiring') {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      matchesStatus = daysRemaining <= 30 && daysRemaining > 0;
    }

    return matchesSearch && matchesCustomer && matchesStatus;
  });

  // تقسيم العقود حسب الحالة
  const contractStats = {
    total: contracts.length,
    active: contracts.filter(c => {
      if (!c.end_date || !c.start_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const startDate = new Date(c.start_date);
      return today >= startDate && today <= endDate;
    }).length,
    expired: contracts.filter(c => {
      if (!c.end_date) return false;
      return new Date() > new Date(c.end_date);
    }).length,
    expiring: contracts.filter(c => {
      if (!c.end_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 30 && daysRemaining > 0;
    }).length
  };

  const uniqueCustomers = [...new Set(contracts.map(c => c.customer_name))].filter(Boolean);

  const filteredAvailable = availableBillboards.filter((b) => {
    const q = bbSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.location, b.size, (b as any).city]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const selectedBillboardsDetails = (formData.billboard_ids
    .map((id) => availableBillboards.find((b) => b.id === id))
    .filter(Boolean)) as Billboard[];

  // حساب التكلفة التقديرية حسب باقات الأسعار والفئة
  const estimatedTotal = useMemo(() => {
    const months = Number(durationMonths || 0);
    if (!months) return 0;
    return selectedBillboardsDetails.reduce((acc, b) => {
      const size = (b.size || (b as any).Size || '') as string;
      const level = (b.level || (b as any).Level) as any;
      const price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      if (price !== null) return acc + price;
      const monthly = Number((b as any).price) || 0;
      return acc + monthly * months;
    }, 0);
  }, [selectedBillboardsDetails, durationMonths, pricingCategory]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, rent_cost: estimatedTotal }));
  }, [estimatedTotal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل العقود...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* العن��ان والأزرار */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة العقود</h1>
          <p className="text-muted-foreground">إنشاء وإدارة عقود الإيجار مع اللوحات الإعلانية</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth">
              <Plus className="h-4 w-4 ml-2" />
              إنشاء عقد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>إنشاء عقد جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* العمود الأيسر: بيانات الحجز */}
                <div className="space-y-4">
                  <Card className="border">
                    <CardHeader>
                      <CardTitle className="text-base">بيانات الحجز</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>اسم الزبون *</Label>
                        <Input
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          placeholder="اسم الزبون"
                        />
                      </div>
                      <div>
                        <Label>نوع الإعلان</Label>
                        <Input
                          value={formData.ad_type}
                          onChange={(e) => setFormData({ ...formData, ad_type: e.target.value })}
                          placeholder="نوع الإعلان"
                        />
                      </div>
                      <div>
                        <Label>ا��فئة السعرية</Label>
                        <Select value={pricingCategory} onValueChange={(v)=>setPricingCategory(v as CustomerType)}>
                          <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
                          <SelectContent>
                            {CUSTOMERS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>تاريخ البداية *</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>المدة (بالأشهر)</Label>
                        <Select value={String(durationMonths)} onValueChange={(v)=>setDurationMonths(Number(v))}>
                          <SelectTrigger><SelectValue placeholder="اختر المدة" /></SelectTrigger>
                          <SelectContent>
                            {[1,2,3,6,12].map(m => (<SelectItem key={m} value={String(m)}>{m}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>تاريخ النهاية *</Label>
                        <Input type="date" value={formData.end_date} readOnly disabled />
                      </div>
                      <div>
                        <Label>التكلف�� التقديرية</Label>
                        <Input type="number" value={formData.rent_cost} onChange={(e)=>setFormData({...formData, rent_cost: Number(e.target.value)})} />
                        <div className="text-xs text-muted-foreground mt-1">يتم تحديثها تلقائياً حسب الفئة والمدة وعدد اللوحات</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* العمود الأيمن: اللوحات */}
                <div className="md:col-span-2 space-y-4">
                  <Card className="border">
                    <CardHeader>
                      <CardTitle className="text-base">اللوحات المختارة ({formData.billboard_ids.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-auto space-y-2">
                        {selectedBillboardsDetails.map((b) => (
                          <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <div className="font-medium">{b.name}</div>
                              <div className="text-xs text-muted-foreground">{b.location} • {b.size}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setFormData({ ...formData, billboard_ids: formData.billboard_ids.filter((id) => id !== b.id) })}
                            >
                              إزالة
                            </Button>
                          </div>
                        ))}
                        {formData.billboard_ids.length === 0 && (
                          <p className="text-sm text-muted-foreground">لم يت�� اختيار أي لوحة</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader>
                      <CardTitle className="text-base">كل اللوحات المتاحة ({filteredAvailable.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <Input placeholder="بحث..." value={bbSearch} onChange={(e) => setBbSearch(e.target.value)} />
                      </div>
                      <div className="max-h-96 overflow-auto space-y-2">
                        {filteredAvailable.map((b) => (
                          <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <div className="font-medium">{b.name}</div>
                              <div className="text-xs text-muted-foreground">{b.location} • {b.size}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={formData.billboard_ids.includes(b.id || '')}
                              onClick={() => setFormData({
                                ...formData,
                                billboard_ids: formData.billboard_ids.includes(b.id || '')
                                  ? formData.billboard_ids
                                  : [...formData.billboard_ids, b.id || '']
                              })}
                            >
                              إضافة
                            </Button>
                          </div>
                        ))}
                        {filteredAvailable.length === 0 && (
                          <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleCreateContract}>
                إنشاء العقد
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* إحصائيات س��يعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العقود</p>
                <p className="text-2xl font-bold text-foreground">{contractStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-success/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عقود نشطة</p>
                <p className="text-2xl font-bold text-success">{contractStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-warning/10 rounded-lg">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قريبة الانتهاء</p>
                <p className="text-2xl font-bold text-warning">{contractStats.expiring}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عقود منتهية</p>
                <p className="text-2xl font-bold text-destructive">{contractStats.expired}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث والفلاتر */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في العقود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة العقد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="expiring">قريبة الانتهاء</SelectItem>
                <SelectItem value="expired">منتهية</SelectItem>
                <SelectItem value="upcoming">لم تبدأ</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="العميل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العملاء</SelectItem>
                {uniqueCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول العقود */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            قائمة العقود ({filteredContracts.length} من {contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>نوع الإعلا��</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-card/50 transition-colors">
                    <TableCell className="font-medium">{contract.customer_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Building className="h-3 w-3" />
                        {(contract as any)['Ad Type'] || 'غير محدد'}
                      </Badge>
                    </TableCell>
                    <TableCell>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</TableCell>
                    <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {(contract.rent_cost || 0).toLocaleString()} د.ل
                    </TableCell>
                    <TableCell>{getContractStatus(contract)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewContract(String(contract.id))}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/contracts/edit?contract=${String(contract.id)}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openAssignDialog(String(contract.Contract_Number ?? contract.id), contract.customer_id ?? null)}
                          className="h-8 px-2"
                        >
                          تعيين زبون
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteContract(String(contract.id))}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              setPrinting(contract.id);
                              const details = await getContractWithBillboards(String(contract.id));

                              // template PDF URL (from uploaded file)
                              const templateUrl = 'https://cdn.builder.io/o/assets%2Fb496a75bf3a847fbbb30839d00fe0721%2F66e10faf2c4d44f787d0db0b9079715c?alt=media&token=205fc1ff-ab26-46fd-bdd1-9ab5ee566add&apiKey=b496a75bf3a847fbbb30839d00fe0721';
                              const existingPdfBytes = await fetch(templateUrl).then(r => r.arrayBuffer());

                              const pdfDoc = await PDFDocument.load(existingPdfBytes);
                              const pages = pdfDoc.getPages();
                              // Embed a Unicode-capable Arabic font (Noto Sans Arabic)
                              const fontUrl = 'https://fonts.gstatic.com/s/noto/v14/NotoSansArabic-Regular.ttf';
                              let helv: any;
                              try {
                                const fontBytes = await fetch(fontUrl).then(r => r.arrayBuffer());
                                helv = await pdfDoc.embedFont(fontBytes);
                              } catch (err) {
                                // fallback to builtin font if fetch fails (will not support Arabic properly)
                                try { helv = await pdfDoc.embedFont(StandardFonts.Helvetica); } catch { helv = undefined; }
                              }

                              // Page 0: header fields
                              const p0 = pages[0];
                              const { width, height } = p0.getSize();

                              const contractNumber = details?.Contract_Number || contract.Contract_Number || String(contract.id);
                              const partyTwo = details?.['Customer Name'] || contract.customer_name || '';
                              const partyOne = 'شركة الفارس الذهبي للدعاية والإعلان';
                              const dateStr = (details?.['Contract Date'] || contract.contract_date || contract.start_date) ? new Date(details?.['Contract Date'] || contract.contract_date || contract.start_date).toLocaleDateString('ar-LY') : '';
                              const total = (details?.total_rent || details?.['Total Rent'] || contract.rent_cost || 0).toLocaleString();

                              // draw some header text (positions may need tuning)
                              const drawOpts = (font: any, size: number) => ({ font: font, size, color: rgb(0,0,0) });
                              if (helv) {
                                p0.drawText(`إيجار لمواقع إعلانية رقم: ${contractNumber}`, { x: 40, y: height - 120, ...drawOpts(helv, 12) });
                                p0.drawText(`التاريخ: ${dateStr}`, { x: 40, y: height - 140, ...drawOpts(helv, 11) });
                                p0.drawText(`الطرف الأول: ${partyOne}`, { x: 40, y: height - 170, ...drawOpts(helv, 11) });
                                p0.drawText(`الطرف الثاني: ${partyTwo}`, { x: 40, y: height - 190, ...drawOpts(helv, 11) });
                                p0.drawText(`قي��ة العقد: ${total} د.ل`, { x: 40, y: height - 210, ...drawOpts(helv, 11) });
                              } else {
                                // fallback: draw ascii-only placeholders
                                p0.drawText(`Contract: ${contractNumber}`, { x: 40, y: height - 120, size: 12, color: rgb(0,0,0) });
                                p0.drawText(`Date: ${dateStr}`, { x: 40, y: height - 140, size: 11, color: rgb(0,0,0) });
                                p0.drawText(`Party 1: ${partyOne}`, { x: 40, y: height - 170, size: 11, color: rgb(0,0,0) });
                                p0.drawText(`Party 2: ${partyTwo}`, { x: 40, y: height - 190, size: 11, color: rgb(0,0,0) });
                                p0.drawText(`Total: ${total} LYD`, { x: 40, y: height - 210, size: 11, color: rgb(0,0,0) });
                              }

                              // Page 1: table of billboards
                              const p1 = pages[1] || pages[0];
                              const { width: w1, height: h1 } = p1.getSize();
                              let startY = h1 - 160;
                              const rowHeight = 18;

                              const billboards = details?.billboards || details?.items || details?.billboard_ids || [];

                              if (Array.isArray(billboards) && billboards.length > 0) {
                                // header
                                p1.drawText('اللوحة - الموقع - القياس - الوجوه - تاريخ الانتهاء', { x: 40, y: startY, size: 11, font: helv, color: rgb(0,0,0) });
                                startY -= rowHeight;
                                for (const b of billboards) {
                                  if (startY < 60) break; // avoid overflow
                                  const id = b.id || b.Contract_Number || b.contract_number || b['Contract Number'] || String(b);
                                  const loc = (b.location || b['location'] || b['Location'] || b['Customer Name'] || '') as string;
                                  const size = (b.size || b['size'] || b['Size'] || '') as string;
                                  const faces = (b.faces || b['faces'] || b['Faces'] || '') as string;
                                  const endDate = b.end_date || b['End Date'] || '';
                                  const endStr = endDate ? new Date(endDate).toLocaleDateString('ar-LY') : '';
                                  const line = `${id} - ${loc} - ${size} - ${faces} - ${endStr}`;
                                  p1.drawText(line, { x: 40, y: startY, size: 10, font: helv, color: rgb(0,0,0) });
                                  startY -= rowHeight;
                                }
                              }

                              const pdfBytes = await pdfDoc.save();
                              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                              const url = URL.createObjectURL(blob);
                              window.open(url, '_blank');

                            } catch (e) {
                              console.error('print contract error', e);
                              // use toast if available
                              try { toast.error('فشل إنشاء ملف العقد'); } catch {}
                            } finally {
                              setPrinting(null);
                            }
                          }}
                          className="h-8 px-2"
                        >
                          طباعة
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredContracts.length === 0 && contracts.length > 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد نتائج</h3>
              <p className="text-muted-foreground">لم يتم العثور على عقود تطابق معايير البحث</p>
            </div>
          )}

          {contracts.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد عقود</h3>
              <p className="text-muted-foreground">ابدأ بإنشاء عقد جديد</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مودال عرض تفاصيل العقد */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العقد</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-6">
              {/* معلومات العقد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      معلومات الزبون
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>الاسم:</strong> {selectedContract.customer_name}</p>
                      <p><strong>نوع الإعلان:</strong> {selectedContract.ad_type || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      تفاصيل العقد
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>تاريخ البداية:</strong> {selectedContract.start_date ? new Date(selectedContract.start_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>��اريخ النهاية:</strong> {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>ا��تكلفة الإجمالية:</strong> {(selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* اللوحات المرتبطة */}
              {selectedContract.billboards && selectedContract.billboards.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">اللوحات المرتبطة ({selectedContract.billboards.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedContract.billboards.map((billboard: any) => (
                        <div key={billboard.ID} className="border rounded-lg p-4">
                          <h4 className="font-semibold">{billboard.Billboard_Name}</h4>
                          <p className="text-sm text-muted-foreground">{billboard.Nearest_Landmark}</p>
                          <p className="text-xs">{billboard.City} • {billboard.Size}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign customer dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعيين زبون للعقد {assignContractNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-2">
            <Select value={assignCustomerId || '__none'} onValueChange={(v) => setAssignCustomerId(v === '__none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="اختر زبون" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__none">اختيار</SelectItem>
                {customersList.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAssignOpen(false); setAssignCustomerId(null); setAssignContractNumber(null); }}>إلغاء</Button>
              <Button onClick={saveAssign}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
