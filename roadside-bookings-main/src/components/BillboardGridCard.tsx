import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Building, Eye } from 'lucide-react';
import { Billboard } from '@/types';
import { formatGregorianDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface BillboardGridCardProps {
  billboard: Billboard;
  onBooking?: (billboard: Billboard) => void;
  onViewDetails?: (billboard: Billboard) => void;
  showBookingActions?: boolean;
}

export const BillboardGridCard: React.FC<BillboardGridCardProps> = ({
  billboard,
  onBooking,
  onViewDetails,
  showBookingActions = true
}) => {
  const { isAdmin } = useAuth();
  const isAvailable = billboard.Status === 'متاح' || billboard.Status === 'available' || !billboard.Contract_Number;
  const isMaintenance = billboard.Status === 'صيانة' || billboard.Status === 'maintenance';
  const statusLabel = isAvailable ? 'متاح' : isMaintenance ? 'صيانة' : 'محجوز';
  const statusClass = isAvailable
    ? 'bg-green-500 hover:bg-green-600'
    : isMaintenance
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-red-500 hover:bg-red-600';

  // حساب الأيام المتبقية
  const getDaysRemaining = () => {
    if (!billboard.Rent_End_Date) return null;

    try {
      const endDate = new Date(billboard.Rent_End_Date);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays > 0 ? diffDays : 0;
    } catch {
      return null;
    }
  };

  const daysRemaining = getDaysRemaining();
  const isNearExpiry = daysRemaining !== null && daysRemaining <= 20;

  const contractNumber = String((billboard as any).Contract_Number ?? (billboard as any)['Contract Number'] ?? '').trim();
  const endDate = (billboard as any).Rent_End_Date ?? (billboard as any)['End Date'] ?? '';
  const customerName = (billboard as any).Customer_Name ?? (billboard as any)['Customer Name'] ?? '';
  const adType = (billboard as any).Ad_Type ?? (billboard as any)['Ad Type'] ?? '';

  return (
    <Card className="overflow-hidden rounded-2xl bg-gradient-card border-0 shadow-card hover:shadow-luxury transition-smooth">
      <div className="relative">
        {/* صورة اللوحة */}
        <div className="aspect-video bg-muted relative overflow-hidden">
          {billboard.Image_URL ? (
            <img 
              src={billboard.Image_URL} 
              alt={billboard.Billboard_Name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
              <Building className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* حجم اللوحة */}
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-primary/90 text-primary-foreground">
              {billboard.Size}
            </Badge>
          </div>

          {/* حالة اللوحة */}
          <div className="absolute top-3 left-3">
            <Badge
              variant={isAvailable ? "default" : "destructive"}
              className={statusClass}
            >
              {statusLabel}
            </Badge>
          </div>

          {/* تحذير القريبة من الانتهاء */}
          {isNearExpiry && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="bg-yellow-500/90 text-yellow-900 border-yellow-600">
                <Calendar className="h-3 w-3 mr-1" />
                {daysRemaining} يوم متبقي
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* معرف اللوحة */}
          <div className="mb-3">
            <h3 className="font-extrabold text-2xl md:text-3xl text-foreground tracking-tight">
              {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
            </h3>
          </div>

          {/* الموقع */}
          <div className="space-y-2 mb-4">
            {/* السطر 1: أقرب نقطة دالة (بدلاً من المدينة) */}
            {(billboard.Nearest_Landmark || billboard.District || billboard.Municipality) && (
              <div className="flex items-center text-lg text-foreground font-semibold">
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{billboard.Nearest_Landmark || billboard.District || billboard.Municipality}</span>
              </div>
            )}


            {/* السطر 3: المنطقة + البلدية */}
            {(billboard.District || billboard.Municipality) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {billboard.District && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{billboard.District}</span>
                )}
                {billboard.Municipality && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{billboard.Municipality}</span>
                )}
              </div>
            )}
          </div>

          {/* معلومات إضافية */}
          <div className="mb-4 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">عدد الأوجه:</span>{' '}
              <span className="font-medium">{billboard.Faces_Count || '1'}</span>
            </div>
            {adType && (
              <div>
                <span className="text-muted-foreground">نوع الإعلان:</span>{' '}
                <span className="font-medium">{adType}</span>
              </div>
            )}
          </div>

          {/* معلومات العقد (تظهر للمدير فقط) */}
          {isAdmin && (contractNumber || endDate || customerName) && (
            <div className="mb-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                {contractNumber && (
                  <Badge variant="outline">رقم العقد: {contractNumber}</Badge>
                )}
                {endDate && (
                  <Badge variant="secondary">ينتهي: {formatGregorianDate(endDate, 'ar-LY')}</Badge>
                )}
                {customerName && (
                  <Badge variant="outline">{customerName}</Badge>
                )}
              </div>
            </div>
          )}

          {/* أزرار الإجراءا�� */}
          {showBookingActions && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                variant={isAvailable ? "default" : "secondary"}
                onClick={() => onBooking?.(billboard)}
              >
                {isAvailable ? 'حجز سريع' : 'تفريغ'}
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  if (billboard.GPS_Link) {
                    window.open(billboard.GPS_Link, '_blank');
                  }
                }}
                disabled={!billboard.GPS_Link}
              >
                <MapPin className="h-4 w-4" />
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onViewDetails?.(billboard)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
};
