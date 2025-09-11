import type { Billboard } from '@/types';
import { CUSTOMERS, CustomerType, getPriceFor } from '@/data/pricing';
import { addMonths, format as fmt } from 'date-fns';

function formatCurrency(n: number) {
  return `${(n || 0).toLocaleString('ar-LY')} د.ل`;
}

function mapUrl(b: any): string {
  const coords = b.coordinates || b.GPS_Coordinates || '';
  if (typeof coords === 'string' && coords.includes(',')) {
    const [lat, lng] = coords.split(',').map((c: string) => c.trim());
    if (lat && lng) return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
  }
  return b.GPS_Link || 'https://www.google.com/maps';
}

export type OfferMeta = {
  months: number;
  customer: CustomerType;
  adType?: string;
  contractNumber?: string;
  date?: Date;
  companyName?: string;
  companyAddress?: string;
  companyRep?: string;
  clientName?: string;
  clientRep?: string;
  clientPhone?: string;
  iban?: string;
};

export function buildAlFaresOfferHtml(items: Billboard[], meta: OfferMeta) {
  const months = meta.months;
  const customer = meta.customer || CUSTOMERS[0];
  const companyName = meta.companyName || 'شركة الفارس الذهبي للدعاية والإعلان';
  const companyAddress = meta.companyAddress || 'طرابلس – طريق المطار، حي الزهور';
  const companyRep = meta.companyRep || 'جمال امحمد زحيلق (المدير العام)';
  const iban = meta.iban || 'LY15014051021405100053401';
  const date = meta.date || new Date();
  const contractNumber = meta.contractNumber || `${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const adType = meta.adType || '—';

  const rows = items.map((b, i) => {
    const size = (b as any).Size || (b as any).size || '';
    const level = (b as any).Level || (b as any).level;
    const unit = getPriceFor(size, level, customer, months) ?? 0;
    const end = fmt(addMonths(new Date(), months), 'yyyy-MM-dd');
    const url = mapUrl(b as any);
    const city = (b as any).City || (b as any).city || '';
    const muni = (b as any).Municipality || (b as any).municipality || '';
    const landmark = (b as any).Nearest_Landmark || (b as any).location || '';
    const faces = (b as any).Faces_Count || 'وجهين';
    const code = (b as any).Billboard_Name || (b as any).id || (b as any).ID || '';
    return `<tr>
      <td>${code}</td>
      <td>${(b as any).Image_URL ? `<img src="${(b as any).Image_URL}" style="height:40px;border-radius:6px"/>` : ''}</td>
      <td>${city}</td>
      <td>${muni}</td>
      <td>${landmark}</td>
      <td>${size}</td>
      <td>${faces}</td>
      <td>${formatCurrency(unit)}</td>
      <td>${end}</td>
      <td><a href="${url}">اضغط هنا</a></td>
    </tr>`;
  }).join('');

  const grand = items.reduce((s, b) => {
    const size = (b as any).Size || (b as any).size || '';
    const level = (b as any).Level || (b as any).level;
    const unit = getPriceFor(size, level, customer, months) ?? 0;
    return s + (unit || 0);
  }, 0);

  const period = months === 12 ? 'سنة كاملة' : months === 6 ? '180 يومًا' : `${months} شهر`;
  const endDateText = fmt(addMonths(new Date(), months), 'yyyy/MM/dd');

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <title>عقد استئجار مساحات إعلانية</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111}
    .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #d4af37;padding-bottom:8px;margin-bottom:12px}
    .brand{display:flex;align-items:center;gap:12px}
    .brand img{width:64px;height:64px;border-radius:12px}
    .brand h1{margin:0;font-size:22px;font-weight:800}
    .gold{color:#b8860b}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #eee;padding:8px;text-align:right}
    th{background:#faf6e8;font-weight:800}
    .box{border:1px solid #eee;border-radius:10px;padding:12px;margin:8px 0}
    .footer{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
  </style></head><body>
    <div class="header">
      <div class="brand">
        <img src="https://cdn.builder.io/api/v1/image/assets%2Ffc68c2d70dd74affa9a5bbf7eee66f4a%2F8d67e8499cfc4a8caf22e6c6835ab764?format=webp&width=256"/>
        <div>
          <h1>عقد استئجار مساحات إعلانية</h1>
          <div class="gold">${companyName}</div>
          <div class="gold">${companyAddress}</div>
        </div>
      </div>
      <div>
        <div>التاريخ: ${date.toLocaleDateString('ar-LY')}</div>
        <div>رقم العقد: ${contractNumber}</div>
        <div>نوع الإعلان: ${adType}</div>
      </div>
    </div>

    <div class="box">
      <p>نظراً لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية.</p>
      <p>قيمة العقد ${formatCurrency(grand)} بدون طباعة؛ تُدفع نصف القيمة عند توقيع العقد والنصف الآخر بعد التركيب، وإذا تأخر السداد عن 30 يوماً يحق للطرف الأول إعادة تأجير المساحات.</p>
      <p>مدة العقد ${period} تبدأ من ${fmt(new Date(), 'yyyy/MM/dd')} وتنتهي في ${endDateText} ويجوز تجديده برضى الطرفين.</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>رقم اللوحة</th>
          <th>صورة اللوحة</th>
          <th>المدينة</th>
          <th>البلدية</th>
          <th>أقرب نقطة دالة</th>
          <th>المقاس</th>
          <th>عدد الأوجه</th>
          <th>السعر</th>
          <th>تاريخ الانتهاء</th>
          <th>إحداثي اللوحة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">
      <div>IBAN: <strong>${iban}</strong></div>
      <div>الطرف الأول: ${companyRep}</div>
    </div>
  </body></html>`;
}

export function buildMinimalOfferHtml(items: Billboard[], meta: OfferMeta & { logoUrl?: string }) {
  const months = meta.months;
  const customer = meta.customer || CUSTOMERS[0];
  const logo = meta.logoUrl || 'https://cdn.builder.io/api/v1/image/assets%2Ffc68c2d70dd74affa9a5bbf7eee66f4a%2F684306a82024469997a03db98b279f4e?format=webp&width=256';

  const rows = items.map((b) => {
    const size = (b as any).Size || (b as any).size || '';
    const level = (b as any).Level || (b as any).level;
    const unit = getPriceFor(size, level, customer, months) ?? 0;
    const end = fmt(addMonths(new Date(), months), 'yyyy-MM-dd');
    const url = mapUrl(b as any);
    const city = (b as any).City || (b as any).city || '';
    const district = (b as any).District || (b as any).district || '';
    const landmark = (b as any).Nearest_Landmark || (b as any).location || '';
    const faces = (b as any).Faces_Count || 'وجهين';
    const code = (b as any).Billboard_Name || (b as any).id || (b as any).ID || '';
    const img = (b as any).Image_URL ? `<img src="${(b as any).Image_URL}" style="height:32px;border-radius:6px;display:block;margin:auto"/>` : '';
    return `<tr>
      <td><a href="${url}">اضغط هنا</a></td>
      <td>${end}</td>
      <td>${formatCurrency(unit)}</td>
      <td>${faces}</td>
      <td>${size}</td>
      <td>${landmark}</td>
      <td>${district}</td>
      <td>${city}</td>
      <td>${img}</td>
      <td class="gold-col">${code}</td>
    </tr>`;
  }).join('');

  const grand = items.reduce((s, b) => {
    const size = (b as any).Size || (b as any).size || '';
    const level = (b as any).Level || (b as any).level;
    const unit = getPriceFor(size, level, customer, months) ?? 0;
    return s + (unit || 0);
  }, 0);

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <title>عرض سعر</title>
  <style>
    @page { size: A4; margin: 12mm; }
    html,body{height:100%}
    body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111;margin:0}
    .page{width:190mm; min-height:273mm; margin:0 auto}
    .top{display:flex;flex-direction:column;align-items:center;margin:8mm 0 4mm}
    .top img{height:22mm}
    .note{margin-top:3mm;color:#b8860b;font-weight:800}
    table{width:100%;border-collapse:separate;border-spacing:0;margin-top:4mm; table-layout:fixed; direction:ltr}
    thead, tbody, tr{direction:ltr}
    th,td{border:1px solid #e4e4e4;padding:4mm 3mm;text-align:right;vertical-align:middle;word-wrap:break-word}
    th{background:#111;color:#fff;font-weight:800}
    thead th:last-child{background:#d4af37;color:#000}
    tbody td:last-child{background:#d4af37;color:#000;font-weight:700}
    thead th:first-child{border-top-right-radius:6px}
    thead th:last-child{border-top-left-radius:6px}
    tbody tr:nth-child(even){background:#fafafa}
    tfoot td{font-weight:800}
    /* أعمدة بثبات أفضل وترتيب مطابق للصورة */
    th:nth-child(1), td:nth-child(1){width:22mm}
    th:nth-child(2), td:nth-child(2){width:26mm}
    th:nth-child(3), td:nth-child(3){width:20mm}
    th:nth-child(4), td:nth-child(4){width:18mm}
    th:nth-child(5), td:nth-child(5){width:18mm}
    th:nth-child(6), td:nth-child(6){width:40mm}
    th:nth-child(7), td:nth-child(7){width:28mm}
    th:nth-child(8), td:nth-child(8){width:26mm}
    th:nth-child(9), td:nth-child(9){width:28mm}
    th:nth-child(10), td:nth-child(10){width:26mm}
    @media print { .page{box-shadow:none} }
  </style></head><body>
    <div class="page">
      <div class="top">
        <img src="${logo}" alt="logo" />
        <div class="note">العرض صالح لمدة 24 ساعة فقط</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>اضغط هنا</th>
            <th>تاريخ الانتهاء</th>
            <th>السعر</th>
            <th>عدد الأوجه</th>
            <th>المقاس</th>
            <th>أقرب نقطة دالة</th>
            <th>المنطقة</th>
            <th>البلدية</th>
            <th>صورة اللوحة</th>
            <th>رقم اللوحة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="7" style="text-align:left">الإجمالي</td>
            <td colspan="3">${formatCurrency(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <script>window.onload=()=>{try{window.print();}catch(e){setTimeout(()=>window.print(),300);}}</script>
  </body></html>`;
}
