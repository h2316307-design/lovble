import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listRequests, updateRequestStatus } from '@/services/bookingService';
import type { BookingRequest } from '@/types';

export function BookingRequestsTable() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);

  useEffect(() => {
    setRequests(listRequests());
  }, []);

  const handleStatus = (id: string, status: BookingRequest['status']) => {
    updateRequestStatus(id, status);
    setRequests(listRequests());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>طلبات الحجز</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">رقم الطلب</TableHead>
              <TableHead className="text-right">عدد اللوحات</TableHead>
              <TableHead className="text-right">الإجمالي</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id.slice(-6).toUpperCase()}</TableCell>
                <TableCell>{r.billboards.length}</TableCell>
                <TableCell>{r.totalPrice.toLocaleString('ar-LY')} د.ل</TableCell>
                <TableCell>
                  {r.status === 'pending' && <Badge variant="secondary">قيد المراجعة</Badge>}
                  {r.status === 'approved' && <Badge>مقبول</Badge>}
                  {r.status === 'rejected' && <Badge variant="destructive">مرفوض</Badge>}
                </TableCell>
                <TableCell>{new Date(r.createdAt).toLocaleString('ar-LY')}</TableCell>
                <TableCell className="space-x-2 space-x-reverse">
                  <Button size="sm" variant="outline" onClick={()=>handleStatus(r.id,'approved')}>قبول</Button>
                  <Button size="sm" variant="outline" onClick={()=>handleStatus(r.id,'rejected')}>رفض</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {requests.length === 0 && (
          <div className="text-center text-muted-foreground py-8">لا توجد طلبات حاليًا</div>
        )}
      </CardContent>
    </Card>
  );
}
