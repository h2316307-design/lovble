import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchDashboardStats } from '@/services/supabaseService';
import { Billboard } from '@/types';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { ContractsTable } from '@/components/ContractsTable';
import { PricingTable } from '@/components/PricingTable';
import { UsersTable } from '@/components/UsersTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  FileText,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  BarChart3,
  Users,
  DollarSign,
  Eye,
  Calendar
} from 'lucide-react';
import { BookingRequestsTable } from '@/components/BookingRequestsTable';
import { toast } from '@/hooks/use-toast';

interface DashboardStats {
  totalBillboards: number;
  availableBillboards: number;
  rentedBillboards: number;
  nearExpiryBillboards: number;
  totalContracts: number;
  totalRevenue: number;
  availableBillboardsList: Billboard[];
  nearExpiryBillboardsList: Billboard[];
}

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isAdmin) {
      loadDashboardStats();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadDashboardStats = async () => {
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (error) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذر تحميل إحصائي��ت لوحة التحكم",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBillboardAction = (billboard: Billboard) => {
    toast({
      title: "قريباً",
      description: "سيتم إضافة إجراءات إدارة اللوحات قريباً"
    });
  };

  const filterBillboards = (billboards: Billboard[], status: string) => {
    let filtered = billboards;
    
    if (searchTerm) {
      filtered = filtered.filter(billboard => 
        billboard.Billboard_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billboard.District?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billboard.City?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    switch (status) {
      case 'available':
        return filtered.filter(b => 
          b.Status === 'متاح' || b.Status === 'available' || !b.Contract_Number
        );
      case 'rented':
        return filtered.filter(b => 
          b.Status === 'مؤجر' || b.Status === 'rented' || b.Contract_Number
        );
      case 'near-expiry':
        return filtered.filter(b => isNearExpiry(b));
      default:
        return filtered;
    }
  };

  const isNearExpiry = (billboard: Billboard) => {
    if (!billboard.Rent_End_Date) return false;
    
    try {
      const endDate = new Date(billboard.Rent_End_Date);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays <= 20 && diffDays > 0;
    } catch {
      return false;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">غير مخول</h2>
            <p className="text-muted-foreground">يجب عليك تسجيل الدخول أولاً</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">غير مخول</h2>
            <p className="text-muted-foreground">
              هذه الصفحة مخصصة للمديرين فقط. ليس لديك الصلاحيات اللازمة للوصول إلى لوحة التحكم.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  const allBillboards = stats?.availableBillboardsList || [];
  const filteredBillboards = filterBillboards(allBillboards, 'all');

  return (
    <div className="min-h-screen bg-gradient-dark" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-primary rounded-lg">
              <BarChart3 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
              <p className="text-muted-foreground">إدارة اللوحات الإعلانية والعقود</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link to="/">العودة للصفحة الرئيسية</Link>
            </Button>
            <Badge variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              مدير النظام
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="billboards" className="gap-2">
              <Building className="h-4 w-4" />
              إدارة اللوحات
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileText className="h-4 w-4" />
              العقود
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              ��لأسعار
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              المستخدمين
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <Calendar className="h-4 w-4" />
              طلبات الحجز
            </TabsTrigger>
          </TabsList>

          {/* النظرة العامة */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي اللوحات</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalBillboards || 0}</div>
                  <p className="text-xs text-muted-foreground">جميع اللوحات في النظام</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">اللوحات المتاحة</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats?.availableBillboards || 0}</div>
                  <p className="text-xs text-muted-foreground">جاهزة للحجز</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">قريبة من الانتهاء</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats?.nearExpiryBillboards || 0}</div>
                  <p className="text-xs text-muted-foreground">تحتاج متابعة</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalRevenue?.toLocaleString() || 0} د.ل</div>
                  <p className="text-xs text-muted-foreground">العوائد الإجمالية</p>
                </CardContent>
              </Card>
            </div>

            {/* اللوحات القريبة من الانتهاء */}
            {stats?.nearExpiryBillboardsList && stats.nearExpiryBillboardsList.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    اللوحات القريبة من الانتهاء
                  </CardTitle>
                  <CardDescription>اللوحات التي تحتاج إلى متابعة أو تجديد</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.nearExpiryBillboardsList.map((billboard) => (
                      <BillboardGridCard
                        key={billboard.ID}
                        billboard={billboard}
                        onBooking={handleBillboardAction}
                        showBookingActions={false}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* إدارة اللوحات */}
          <TabsContent value="billboards" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>إدارة اللوحات</CardTitle>
                    <CardDescription>عرض وإدارة جميع اللوحات الإعلانية</CardDescription>
                  </div>
                  <Button className="gap-2">
                    <Building className="h-4 w-4" />
                    إضافة لوحة جديدة
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ابحث عن اللوحات..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    فلترة متقدمة
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* شبكة اللوحات */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBillboards.slice(0, 10).map((billboard) => (
                <BillboardGridCard
                  key={billboard.ID}
                  billboard={billboard}
                  onBooking={handleBillboardAction}
                  showBookingActions={false}
                />
              ))}
            </div>

            {filteredBillboards.length === 0 && (
              <div className="text-center py-12">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
                <p className="text-muted-foreground">جرب تعديل معايير البحث أو الفلترة</p>
              </div>
            )}
          </TabsContent>

          {/* العقود */}
          <TabsContent value="contracts">
            <ContractsTable />
          </TabsContent>

          {/* الأسعار */}
          <TabsContent value="pricing">
            <PricingTable />
          </TabsContent>

          {/* المستخدمين */}
          <TabsContent value="users">
            <UsersTable />
          </TabsContent>

          {/* طلبات الحجز */}
          <TabsContent value="requests">
            <BookingRequestsTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
