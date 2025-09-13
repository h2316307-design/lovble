import React, { useEffect } from 'react';
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateContractPDF, downloadPDF, type InvoiceData, getBillboardImageFromContract } from '@/lib/pdfGenerator';
import { toast } from 'sonner';

interface ContractPDFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
}

export default function ContractPDFDialog({ open, onOpenChange, contract }: ContractPDFDialogProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [formData, setFormData] = useState<InvoiceData>({
    adsType: contract?.ad_type || contract?.['Ad Type'] || 'عقد إيجار لوحات إعلانية',
    date: new Date().toLocaleDateString('ar-LY'),
    contractNumber: contract?.id || contract?.Contract_Number || contract?.['Contract Number'] || '',
    companyName: 'شركة الفارس الذهبي للدعاية والإعلان',
    clientName: contract?.customer_name || contract?.['Customer Name'] || '',
    phoneNumber: '',
    price: '',
    duration: '',
    image: getBillboardImageFromContract(contract || {})
  });

  const handleInputChange = (field: keyof InvoiceData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          image: result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateContractDetails = () => {
    const startDate = contract?.start_date || contract?.['Contract Date'];
    const endDate = contract?.end_date || contract?.['End Date'];
    const totalCost = contract?.rent_cost || contract?.['Total Rent'] || 0;
    
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      duration = `${months} ${months === 1 ? 'شهر' : 'أشهر'}`;
    }

    return {
      price: `${totalCost.toLocaleString()} د.ل`,
      duration
    };
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      const contractDetails = calculateContractDetails();
      
      const invoiceData: InvoiceData = {
        ...formData,
        price: formData.price || contractDetails.price,
        duration: formData.duration || contractDetails.duration
      };

      const pdfBytes = await generateContractPDF(contract, invoiceData);
      const filename = `contract-${formData.contractNumber || 'default'}.pdf`;
      downloadPDF(pdfBytes, filename);
      
      toast.success('تم إنشاء عقد PDF بنجاح!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating contract PDF:', error);
      toast.error('فشل في إنشاء عقد PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const contractDetails = calculateContractDetails();

  // Auto-fill from contract when dialog opens or contract changes
  useEffect(() => {
    if (!contract) return;
    const img = getBillboardImageFromContract(contract as any);
    const details = calculateContractDetails();
    setFormData((prev) => ({
      adsType: contract?.ad_type || (contract as any)['Ad Type'] || prev.adsType || 'عقد إيجار لوحات إعلانية',
      date: prev.date || new Date().toLocaleDateString('ar-LY'),
      contractNumber: (contract as any)?.id || (contract as any)?.Contract_Number || (contract as any)?.['Contract Number'] || prev.contractNumber || '',
      companyName: prev.companyName || 'شركة الفارس الذهبي للدعاية والإعلان',
      clientName: (contract as any)?.customer_name || (contract as any)?.['Customer Name'] || prev.clientName || '',
      phoneNumber: prev.phoneNumber || '',
      price: prev.price || details.price,
      duration: prev.duration || details.duration,
      image: prev.image || img,
    }));
  }, [open, contract]);

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>طباعة عقد PDF</UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="adsType">نوع العقد</Label>
              <Input
                id="adsType"
                value={formData.adsType}
                onChange={(e) => handleInputChange('adsType', e.target.value)}
                placeholder="نوع العقد"
              />
            </div>
            <div>
              <Label htmlFor="date">التاريخ</Label>
              <Input
                id="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                placeholder="التاريخ"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contractNumber">رقم العقد</Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber}
                onChange={(e) => handleInputChange('contractNumber', e.target.value)}
                placeholder="رقم العقد"
              />
            </div>
            <div>
              <Label htmlFor="companyName">اسم الشركة</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                placeholder="اسم الشركة"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">اسم العميل</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                placeholder="اسم العميل"
                required
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">رقم الهاتف</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="رقم الهاتف"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">قيمة العقد</Label>
              <Input
                id="price"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder={contractDetails.price}
              />
            </div>
            <div>
              <Label htmlFor="duration">مدة العقد</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                placeholder={contractDetails.duration}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="image">صورة اللوحة الإعلانية</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="cursor-pointer"
            />
            {formData.image && (
              <div className="mt-2">
                <img 
                  src={formData.image} 
                  alt="Preview" 
                  className="w-32 h-32 object-cover rounded border"
                />
              </div>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">ملخص العقد</h3>
            <div className="text-sm space-y-1">
              <p>رقم العقد: {formData.contractNumber}</p>
              <p>العميل: {formData.clientName}</p>
              <p>قيمة العقد: {contractDetails.price}</p>
              <p>مدة العقد: {contractDetails.duration}</p>
              {contract?.billboards && (
                <p>عدد اللوحات: {contract.billboards.length}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              إلغاء
            </Button>
            <Button 
              onClick={handleGeneratePDF}
              disabled={isGenerating || !formData.clientName}
              className="bg-primary text-primary-foreground"
            >
              {isGenerating ? 'جاري الإنشاء...' : 'طباعة عقد PDF'}
            </Button>
          </div>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
