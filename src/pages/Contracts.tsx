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
import { BRAND_LOGO } from '@/lib/branding';

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
  const [editBbSearch, setEditBbSearch] = useState('');

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
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      await createContract(formData);
      toast.success('تم إن��اء العقد بنجاح');
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

  // تص��ية العقود
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
      {/* العنوان والأزرار */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة العقود</h1>
          <p className="text-muted-foreground">إنشاء وإدارة عقود الإيجار مع اللوحات الإعلانية</p>
        </div>
        <Button
          className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth"
          onClick={() => navigate('/admin/contracts/new')}
        >
          <Plus className="h-4 w-4 ml-2" />
          إنشاء عقد جديد
        </Button>
      </div>

      {/* إحصائيات سريعة */}
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
                placeholder="اب��ث في العقود..."
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
                  <TableHead>نوع الإعلان</TableHead>
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
                          onClick={() => openAssignDialog(String((contract as any).Contract_Number ?? contract.id), (contract as any).customer_id ?? null)}
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
                            const w = window.open('', '_blank');
                            if (!w) { alert('يرجى السماح بالنوافذ المنبثقة للطباعة'); return; }
                            try {
                              setPrinting(contract.id);
                              const details = await getContractWithBillboards(String(contract.id));

                              // Try to build PDF with provided image as background
                              const imgWebp = 'https://cdn.builder.io/api/v1/image/assets%2Fa966b1ba65464d5e8a07467517a60ba4%2F4ea207f0364247f1a1fb77cd2a3a851c?format=webp&width=800';
                              let pdfDoc: PDFDocument;
                              let pages: any[] = [];
                              try {
                                pdfDoc = await PDFDocument.create();
                                const tryUrls = [
                                  imgWebp.replace('format=webp', 'format=png').replace('width=800','width=1240'),
                                  imgWebp.replace('format=webp', 'format=jpg').replace('width=800','width=1240'),
                                  imgWebp,
                                ];
                                let img: any = null;
                                for (const u of tryUrls) {
                                  try {
                                    const bytes = await fetch(u).then(r => r.arrayBuffer());
                                    try { img = await pdfDoc.embedPng(bytes); } catch {
                                      try { img = await pdfDoc.embedJpg(bytes); } catch {}
                                    }
                                    if (img) break;
                                  } catch {}
                                }
                                if (!img) {
                                  const blob = await fetch(imgWebp).then(r => r.blob());
                                  const dataUrl: string = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.readAsDataURL(blob); });
                                  const bytes = await fetch(dataUrl).then(r => r.arrayBuffer());
                                  img = await pdfDoc.embedPng(bytes);
                                }
                                const page = pdfDoc.addPage([img.width, img.height]);
                                page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                                pages = [page];
                              } catch (bgErr) {
                                const templateUrl = 'https://cdn.builder.io/o/assets%2Fb496a75bf3a847fbbb30839d00fe0721%2F66e10faf2c4d44f787d0db0b9079715c?alt=media&token=205fc1ff-ab26-46fd-bdd1-9ab5ee566add&apiKey=b496a75bf3a847fbbb30839d00fe0721';
                                const existingPdfBytes = await fetch(templateUrl).then(r => r.arrayBuffer());
                                pdfDoc = await PDFDocument.load(existingPdfBytes);
                                pages = pdfDoc.getPages();
                              }
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

                              const contractNumber = (details as any)?.Contract_Number || (contract as any).Contract_Number || String(contract.id);
                              const partyTwo = (details as any)?.['Customer Name'] || (contract as any).customer_name || '';
                              const partyOne = 'شركة الفارس الذهبي للدعاية والإعلان';
                              const dateStr = ((details as any)?.['Contract Date'] || (contract as any).contract_date || (contract as any).start_date)
                                ? new Date((details as any)?.['Contract Date'] || (contract as any).contract_date || (contract as any).start_date).toLocaleDateString('ar-LY')
                                : '';
                              const total = (((details as any)?.total_rent || (details as any)?.['Total Rent'] || (contract as any).rent_cost || 0) as number).toLocaleString();

                              // draw some header text (positions may need tuning)
                              const drawOpts = (font: any, size: number) => ({ font: font, size, color: rgb(0,0,0) });
                              if (helv) {
                                p0.drawText(`إيجار لمواقع إعلانية رقم: ${contractNumber}`, { x: 40, y: height - 120, ...drawOpts(helv, 12) });
                                p0.drawText(`التا��يخ: ${dateStr}`, { x: 40, y: height - 140, ...drawOpts(helv, 11) });
                                p0.drawText(`الطرف الأول: ${partyOne}`, { x: 40, y: height - 170, ...drawOpts(helv, 11) });
                                p0.drawText(`الطرف الثاني: ${partyTwo}`, { x: 40, y: height - 190, ...drawOpts(helv, 11) });
                                p0.drawText(`قيمة العقد: ${total} د.ل`, { x: 40, y: height - 210, ...drawOpts(helv, 11) });
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
                              const { height: h1 } = p1.getSize();
                              let startY = h1 - 160;
                              const rowHeight = 18;

                              const billboards = (details as any)?.billboards || (details as any)?.items || (details as any)?.billboard_ids || [];

                              if (helv && Array.isArray(billboards) && billboards.length > 0) {
                                p1.drawText('اللوحة - الموقع - القياس - الوجوه - تاريخ الانتهاء', { x: 40, y: startY, size: 11, font: helv, color: rgb(0,0,0) });
                                startY -= rowHeight;
                                for (const b of billboards) {
                                  if (startY < 60) break;
                                  const id = (b as any).id || (b as any).Contract_Number || (b as any).contract_number || (b as any)['Contract Number'] || String(b);
                                  const loc = ((b as any).location || (b as any)['location'] || (b as any)['Location'] || (b as any)['Customer Name'] || '') as string;
                                  const size = ((b as any).size || (b as any)['size'] || (b as any)['Size'] || '') as string;
                                  const faces = ((b as any).faces || (b as any)['faces'] || (b as any)['Faces'] || '') as string;
                                  const endDate = (b as any).end_date || (b as any)['End Date'] || '';
                                  const endStr = endDate ? new Date(endDate).toLocaleDateString('ar-LY') : '';
                                  const line = `${id} - ${loc} - ${size} - ${faces} - ${endStr}`;
                                  p1.drawText(line, { x: 40, y: startY, size: 10, font: helv, color: rgb(0,0,0) });
                                  startY -= rowHeight;
                                }
                              }

                              const pdfBytes = await pdfDoc.save();
                              const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                              const url = URL.createObjectURL(blob);
                              w.location.href = url;

                            } catch (e) {
                              console.error('print contract error', e);
                              try { toast.error('فشل إنشاء ملف العقد'); } catch {}
                            } finally {
                              setPrinting(null);
                            }
                          }}
                          className="h-8 px-2"
                        >
                          طباعة
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const w = window.open('', '_blank');
                            if (!w) { alert('يرجى السماح بالنوافذ المنبثقة للطباعة'); return; }
                            try {
                              setPrinting(contract.id);
                              const details = await getContractWithBillboards(String(contract.id));
                              const contractNumber = (details as any)?.Contract_Number || (details as any)['Contract Number'] || String((details as any)?.id || contract.id);
                              const startDate = (details as any)?.start_date || (details as any)['Contract Date'] || '';
                              const endDate = (details as any)?.end_date || (details as any)['End Date'] || '';
                              const dateStr = startDate ? new Date(startDate).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
                              const totalAmount = Number((details as any)?.rent_cost ?? (details as any)['Total Rent'] ?? 0) || 0;
                              const buyerName = (details as any)?.customer_name || (details as any)['Customer Name'] || '';
                              const adType = (details as any)?.ad_type || (details as any)['Ad Type'] || '';
                              const buyerPhone = String((details as any)?.customer_phone || (details as any)?.phone || '');
                              const itemsArr = Array.isArray((details as any)?.billboards) ? (details as any)?.billboards : [];
                              const perItem = itemsArr.length > 0 ? totalAmount / itemsArr.length : totalAmount;
                              const execDays = (() => {
                                if (!startDate || !endDate) return '';
                                const sd = new Date(startDate).getTime();
                                const ed = new Date(endDate).getTime();
                                const diff = Math.max(0, Math.ceil((ed - sd) / (1000 * 60 * 60 * 24)));
                                return String(diff);
                              })();
                              const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
                              const formatCurrency = (n: number) => new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD', minimumFractionDigits: 2 }).format(n || 0);
                              const rows = itemsArr.map((b: any, idx: number) => {
                                const name = b.Billboard_Name || b.name || `لوحة ${idx + 1}`;
                                const specs = [b.City || b.city, b.Municipality || b.municipality, b.Size || b.size, b.Nearest_Landmark || b.location].filter(Boolean).join(' / ');
                                const qty = 1;
                                const unit = 'موقع';
                                const price = perItem;
                                const total = perItem * qty;
                                return `<tr><td>${idx + 1}</td><td>${name}</td><td>${specs}</td><td>${qty}</td><td>${unit}</td><td>${formatCurrency(price)}</td><td>${formatCurrency(total)}</td></tr>`;
                              }).join('');
                              const bgPage1 = 'https://cdn.builder.io/api/v1/image/assets%2Fd73591ac255749fab003760323583a62%2Fd4a92c2ed92644e9899c8df4a515c151?format=webp&width=1600';
const bgPage2 = 'https://cdn.builder.io/api/v1/image/assets%2Fd73591ac255749fab003760323583a62%2F2e533f298c7a4c85b76338603e28bc30?format=webp&width=1600';
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>عقد رقم ${contractNumber}</title><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet"><style>
@page{size:A4;margin:0}
body{margin:0;font-family:'Amiri',serif;color:#111}
.page{width:210mm;height:297mm;position:relative;page-break-after:always;background:#fff}
.page .bg{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;background-position:center}
.page .content{position:absolute;inset:0;padding:22mm 18mm}
.header-line{display:flex;justify-content:space-between;font-weight:700;color:#000;margin-top:6mm}
.h2{font-size:16pt;color:#000;margin:10mm 0 4mm 0}
.meta{display:flex;gap:12mm;font-weight:700;margin:2mm 0 6mm}
.bold{font-weight:700}
.clauses p{margin:2.5mm 0;line-height:1.7}
.box-sign{position:absolute;left:18mm;right:18mm;bottom:18mm;display:flex;justify-content:space-between;align-items:center}
.table{width:100%;border-collapse:collapse;margin-top:18mm;background:#fff}
.table th,.table td{border:1px solid #ddd;padding:3mm 2mm;font-size:10pt;text-align:center}
.table th{background:#111;color:#fff}
.small{font-size:10pt;color:#333}
</style></head><body>
  <section class="page"><div class="bg" style="background-image:url(${bgPage1})"></div><div class="content">
    <div class="header-line small"><div>التاريخ: ${formatDate(startDate)}</div><div>رقم العقد: ${contractNumber}</div></div>
    <div class="h2"><span class="bold">نوع الإعلان:</span> ${adType || '—'}</div>
    <div class="clauses">
      <p>الطرف الأول: شركة الفارس الذهبي للدعاية والإعلان – طرابلس – طريق المطار – حي الأندلس. يمثله المدير المسؤول.</p>
      <p>الطرف الثاني: ${buyerName || '—'} – هاتف: ${buyerPhone || '—'}.</p>
      <p>المقدمة: نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية.</p>
      <p>البند الأول: يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ المذكور في المادة السادسة.</p>
      <p>البند الثاني: يلتزم الطرف الأول بطباعة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل الأ��ير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.</p>
      <p>البند الثالث: في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول الحصول على الموافقات اللازمة من الجه��ت ذات العلاقة.</p>
      <p>البند الرابع: لا يجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.</p>
      <p>البند الخامس: قيمة العقد ${totalAmount.toLocaleString('ar-LY')} د.ل دون طباعة، تُدفع 35% عند التوقيع والباقي على دفعتين كل شهرين، ويحق للطرف الأول إعادة التأجير بعد 30 يومًا من التأخير.</p>
      <p>البند السادس: مدة العقد ${execDays || '—'} يومًا تبدأ من ${formatDate(startDate)} وتنتهي في ${formatDate(endDate)}، ويجوز تجديده برضى الطرفين قبل انتها��ه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها لاحقًا.</p>
      <p>البند السابع: في حال حدوث خلاف بين الطرفين يتم حله وديًا، وإذا تعذر ذلك يُعين طرفان محايدان لتسوية النزاع بقرار نهائي وملزم للطرفين.</p>
    </div>
    <div class="meta small"><div>اسم العميل: ${buyerName || '—'}</div><div>الهاتف: ${buyerPhone || '—'}</div><div>نوع الإعلان: ${adType || '—'}</div></div>
    <div class="box-sign small"><div>الطرف الأول</div><div>الطرف الثاني</div></div>
  </div></section>
  <section class="page"><div class="bg" style="background-image:url(${bgPage2})"></div><div class="content">
    <h3 class="h2">البند الثامن: المواقع المتفق عليها بين الطرفين</h3>
    <table class="table">
      <thead><tr><th>رقم الوحدة</th><th>صورة</th><th>المدينة</th><th>المنطقة</th><th>أقرب معلم</th><th>المقاس</th><th>الوجوه</th><th>السعر</th><th>تاريخ الانتهاء</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div></section>
  <script>window.onload=()=>{try{window.print()}catch(e){setTimeout(()=>window.print(),300)}}</script>
</body></html>`;
                              w.document.open();
                              w.document.write(html);
                              w.document.close();
                              w.focus();
                            } catch (e) {
                              console.error(e);
                              try { toast.error('فشل ��باعة العقد'); } catch {}
                            } finally {
                              setPrinting(null);
                            }
                          }}
                          className="h-8 px-2"
                        >
                          طباعة العقد (قالب)
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
                      <p><strong>تاريخ النهاية:</strong> {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>التكلفة الإجمالي��:</strong> {(selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
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
                        <Card key={billboard.ID || billboard.id} className="border">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{billboard.Billboard_Name || billboard.name}</h4>
                              <p className="text-sm text-muted-foreground">{billboard.Nearest_Landmark || billboard.location}</p>
                              <p className="text-sm">الحجم: {billboard.Size || billboard.size}</p>
                              <p className="text-sm">المدينة: {billboard.City || billboard.city}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                try {
                                  const contractNumber = String(selectedContract.Contract_Number ?? selectedContract['Contract Number'] ?? selectedContract.id);
                                  await removeBillboardFromContract(contractNumber, billboard.ID || billboard.id);
                                  toast.success('تم إزالة اللوحة من العقد');
                                  const refreshed = await getContractWithBillboards(contractNumber);
                                  setSelectedContract(refreshed);
                                  const av = await getAvailableBillboards();
                                  setAvailableBillboards(av || []);
                                } catch (e) {
                                  console.error(e);
                                  toast.error('فشل إزالة اللوحة');
                                }
                              }}
                            >
                              إزالة
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* التعديل: إضافة لوحات أثناء سريان العقد */}
              {(() => {
                const today = new Date();
                const start = selectedContract.start_date ? new Date(selectedContract.start_date) : (selectedContract['Contract Date'] ? new Date(selectedContract['Contract Date']) : null);
                const end = selectedContract.end_date ? new Date(selectedContract.end_date) : (selectedContract['End Date'] ? new Date(selectedContract['End Date']) : null);
                const active = start && end && today >= start && today <= end;
                if (!active) return null;
                const filtered = (availableBillboards || []).filter((b) => {
                  const q = editBbSearch.trim().toLowerCase();
                  if (!q) return true;
                  return [(b as any).Billboard_Name, (b as any).Nearest_Landmark, (b as any).City, (b as any).Size]
                    .some((v: any) => String(v || '').toLowerCase().includes(q));
                });
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">إضافة لوحات إلى العقد (نشط)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <Input placeholder="بحث عن لوحة..." value={editBbSearch} onChange={(e) => setEditBbSearch(e.target.value)} />
                      </div>
                      <div className="max-h-96 overflow-auto space-y-2">
                        {filtered.map((b: any) => (
                          <div key={b.ID} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <div className="font-medium">{b.Billboard_Name}</div>
                              <div className="text-xs text-muted-foreground">{b.Nearest_Landmark} • {b.Size}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const contractNumber = String(selectedContract.Contract_Number ?? selectedContract['Contract Number'] ?? selectedContract.id);
                                  await addBillboardsToContract(contractNumber, [b.ID], {
                                    start_date: selectedContract.start_date || selectedContract['Contract Date'],
                                    end_date: selectedContract.end_date || selectedContract['End Date'],
                                    customer_name: selectedContract.customer_name || selectedContract['Customer Name'] || '',
                                  });
                                  toast.success('تم إضافة اللوحة إلى العقد');
                                  const refreshed = await getContractWithBillboards(contractNumber);
                                  setSelectedContract(refreshed);
                                  const av = await getAvailableBillboards();
                                  setAvailableBillboards(av || []);
                                } catch (e) {
                                  console.error(e);
                                  toast.error('فشل إضافة اللوحة');
                                }
                              }}
                            >
                              إضافة
                            </Button>
                          </div>
                        ))}
                        {filtered.length === 0 && (
                          <p className="text-sm text-muted-foreground">لا توجد لوحات متاحة مطابقة</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
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
