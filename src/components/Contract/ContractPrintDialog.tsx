import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { ContractData } from '@/lib/pdfGenerator';

interface ContractPrintDialogProps {
  contract: ContractData;
  trigger?: React.ReactNode;
}

export function ContractPrintDialog({ contract, trigger }: ContractPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Function to get billboard image from contract
  const getBillboardImage = (contract: ContractData): string => {
    if (!contract?.billboards || contract.billboards.length === 0) {
      return '';
    }
    
    for (const billboard of contract.billboards) {
      const image = billboard.image || billboard.Image || billboard.billboard_image || (billboard as any).Image_URL || (billboard as any)['@IMAGE'] || (billboard as any).image_url;
      if (image && typeof image === 'string' && image.trim() !== '') {
        return image;
      }
    }
    
    return '';
  };

  // Function to extract contract data
  const extractContractData = (contract: ContractData) => {
    const contractNumber = contract.Contract_Number || contract.id || '';
    const customerName = contract.customer_name || contract['Customer Name'] || '';
    const adType = contract.ad_type || contract['Ad Type'] || 'عقد إيجار لوحات إعلانية';
    const startDate = contract.start_date || contract['Contract Date'] || '';
    const endDate = contract.end_date || contract['End Date'] || '';
    const totalCost = contract.rent_cost || contract['Total Rent'] || 0;
    
    // Calculate duration in months
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      duration = `${durationMonths} ${durationMonths === 1 ? 'شهر' : 'أشهر'}`;
    }
    
    // Format price
    const formattedPrice = `${totalCost.toLocaleString('ar-LY')} د.ل`;
    
    // Format date
    const formattedDate = startDate ? new Date(startDate).toLocaleDateString('ar-LY') : new Date().toLocaleDateString('ar-LY');
    
    // Get billboard count
    const billboardCount = contract.billboards ? contract.billboards.length : 0;
    const billboardInfo = billboardCount > 0 ? ` (${billboardCount} لوحة ��علانية)` : '';
    
    return {
      contractNumber: contractNumber.toString(),
      customerName: customerName,
      adType: adType + billboardInfo,
      date: formattedDate,
      price: formattedPrice,
      duration: duration,
      companyName: 'شركة الفارس الذهبي للدعاية والإعلان',
      phoneNumber: contract.phoneNumber || '',
      billboardImage: getBillboardImage(contract)
    };
  };

  const handlePrintContract = async () => {
    try {
      setIsGenerating(true);
      
      // Extract contract data
      const contractData = extractContractData(contract);
      
      // Create HTML content for printing
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              background: white;
              color: #000;
              line-height: 1.6;
            }
            
            .page {
              width: 210mm;
              height: 297mm;
              margin: 0 auto;
              position: relative;
              page-break-after: always;
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
            }
            
            .page:last-child {
              page-break-after: auto;
            }
            
            .page-1 {
              background-image: url('/bgc1.jpg');
            }
            
            .page-2 {
              background-image: url('/bgc2.jpg');
            }
            
            .content-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 10;
            }
            
            .field {
              position: absolute;
              font-weight: bold;
              text-align: right;
              color: #000;
              text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
            }
            
            /* Page 1 Fields */
            .contract-number {
              top: 65.77mm;
              right: 92.54mm;
              width: 44.98mm;
              height: 6.61mm;
              font-size: 13px;
            }
            
            .contract-date {
              top: 64.18mm;
              right: 11.59mm;
              width: 45mm;
              height: 10mm;
              font-size: 13px;
            }
            
            .company-name {
              top: 118.38mm;
              right: 126.15mm;
              width: 39.42mm;
              height: 5.82mm;
              font-size: 9px;
            }
            
            .client-name {
              top: 124.25mm;
              right: 144.93mm;
              width: 20.9mm;
              height: 5.29mm;
              font-size: 9px;
            }
            
            .phone-number {
              top: 124.27mm;
              right: 104.19mm;
              width: 27.78mm;
              height: 4.23mm;
              font-size: 13px;
            }
            
            .contract-price {
              top: 193.61mm;
              right: 137.8mm;
              width: 11.64mm;
              height: 4.76mm;
              font-size: 10px;
            }
            
            .contract-duration {
              top: 207.15mm;
              right: 145.47mm;
              width: 7.67mm;
              height: 3.7mm;
              font-size: 8px;
              text-align: left;
            }
            
            /* Page 2 Fields */
            .billboard-image {
              top: 50mm;
              right: 20mm;
              width: 170mm;
              height: 120mm;
              object-fit: cover;
              border-radius: 8px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
            
            .ad-type {
              top: 180mm;
              right: 20mm;
              width: 170mm;
              height: 10mm;
              font-size: 12px;
              text-align: center;
              font-weight: bold;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              
              .page {
                margin: 0;
                box-shadow: none;
              }
              
              @page {
                size: A4;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <!-- Page 1: Contract Details -->
          <div class="page page-1">
            <div class="content-overlay">
              <div class="field contract-number">${contractData.contractNumber}</div>
              <div class="field contract-date">${contractData.date}</div>
              <div class="field company-name">${contractData.companyName}</div>
              <div class="field client-name">${contractData.customerName}</div>
              <div class="field phone-number">${contractData.phoneNumber}</div>
              <div class="field contract-price">${contractData.price}</div>
              <div class="field contract-duration">${contractData.duration}</div>
            </div>
          </div>
          
          <!-- Page 2: Billboard Image -->
          <div class="page page-2">
            <div class="content-overlay">
              ${contractData.billboardImage ? `<img src="${contractData.billboardImage}" alt="Billboard" class="billboard-image">` : ''}
              <div class="field ad-type">${contractData.adType}</div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Create a new window and write the HTML content
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for images to load, then focus and show print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 1000);
        };
      } else {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      }
      
    } catch (error) {
      console.error('Error opening print window:', error);
      alert('حدث خطأ أثناء فتح نافذة الطباعة: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            طباعة العقد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>طباعة عقد إيجار اللوحات الإعلانية</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>سيتم فتح العقد في نافذة جديدة بالمتصفح مع إمكانية الطباعة المبا��رة.</p>
            <p className="mt-2">العقد يحتوي على:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>تفاصيل العقد والعميل</li>
              <li>صور اللوحات الإعلانية</li>
              <li>خلفية مصممة للطباعة</li>
            </ul>
          </div>
          
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button
              onClick={handlePrintContract}
              disabled={isGenerating}
              className="flex items-center"
            >
              <Printer className="h-4 w-4 ml-2" />
              {isGenerating ? 'جاري التحضير...' : 'فتح للطباعة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
