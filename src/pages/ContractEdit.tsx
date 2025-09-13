import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Printer, Eye } from 'lucide-react';
import { ContractPrintDialog } from '@/components/Contract';

// Mock contract data
const mockContract = {
  id: '1',
  Contract_Number: 'C-2024-001',
  customer_name: 'أحمد محمد الصالح',
  'Customer Name': 'أحمد محمد الصالح',
  ad_type: 'إعلان تجاري',
  'Ad Type': 'إعلان تجاري',
  start_date: '2024-01-15',
  'Contract Date': '2024-01-15',
  end_date: '2024-07-15',
  'End Date': '2024-07-15',
  rent_cost: 5000,
  'Total Rent': 5000,
  status: 'نشط',
  phoneNumber: '0912345678',
  duration_months: 6,
  notes: 'عقد إيجار لوحة إعلانية في موقع استراتيجي',
  billboards: [
    {
      id: '1',
      name: 'لوحة شارع الجمهورية',
      location: 'شارع الجمهورية - طرابلس',
      size: '6x4 متر',
      image: '/billboard-city.jpg',
      Image: '/billboard-city.jpg',
      billboard_image: '/billboard-city.jpg'
    }
  ]
};

export default function ContractEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(mockContract);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string | number) => {
    setContract(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('تم حفظ التغييرات بنجاح');
    } catch (error) {
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'نشط':
        return 'bg-green-100 text-green-800';
      case 'منتهي':
        return 'bg-red-100 text-red-800';
      case 'معلق':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('ar-LY')} د.ل`;
  };

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/contracts')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للعقود
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل العقد</h1>
            <p className="text-gray-600 mt-1">{contract.Contract_Number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ContractPrintDialog 
            contract={contract}
            trigger={
              <Button variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                طباعة العقد
              </Button>
            }
          />
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Contract Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل العقد الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contract-number">رقم العقد</Label>
                  <Input
                    id="contract-number"
                    value={contract.Contract_Number}
                    onChange={(e) => handleInputChange('Contract_Number', e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>حالة العقد:</Label>
                  <Badge className={getStatusColor(contract.status)}>
                    {contract.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="customer-name">اسم العميل</Label>
                <Input
                  id="customer-name"
                  value={contract.customer_name}
                  onChange={(e) => handleInputChange('customer_name', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={contract.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="ad-type">نوع الإعلان</Label>
                <Input
                  id="ad-type"
                  value={contract.ad_type}
                  onChange={(e) => handleInputChange('ad_type', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">تاريخ البداية</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={contract.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">تاريخ النهاية</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={contract.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rent-cost">قيمة الإيجار (د.ل)</Label>
                <Input
                  id="rent-cost"
                  type="number"
                  value={contract.rent_cost}
                  onChange={(e) => handleInputChange('rent_cost', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={contract.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billboards Section */}
          <Card>
            <CardHeader>
              <CardTitle>اللوحات الإعلانية المرتبطة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contract.billboards.map((billboard, index) => (
                  <div key={billboard.id} className="border rounded-lg p-4">
                    <div className="flex gap-4">
                      {billboard.image && (
                        <img 
                          src={billboard.image} 
                          alt={billboard.name}
                          className="w-24 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{billboard.name}</h4>
                        <p className="text-sm text-gray-600">{billboard.location}</p>
                        <p className="text-sm text-gray-500">الحجم: {billboard.size}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ملخص العقد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">إجمالي قيمة الإيجار</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(contract.rent_cost)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">مدة العقد</p>
                <p className="text-lg">{contract.duration_months} أشهر</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">عدد اللوحات</p>
                <p className="text-lg">{contract.billboards.length} لوحة</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">تاريخ الإنشاء</p>
                <p className="text-sm text-gray-600">{new Date(contract.start_date).toLocaleDateString('ar-LY')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>إجراءات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ContractPrintDialog 
                contract={contract}
                trigger={
                  <Button variant="outline" className="w-full">
                    <Printer className="h-4 w-4 mr-2" />
                    طباعة العقد
                  </Button>
                }
              />
              <Button variant="outline" className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                معاينة العقد
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
