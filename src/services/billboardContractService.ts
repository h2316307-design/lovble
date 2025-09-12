import { supabase } from '@/integrations/supabase/client';
import { Billboard, Contract } from '@/types';

export interface BillboardWithContract extends Billboard {
  contract?: {
    id: string;
    customer_name: string;
    ad_type: string;
    start_date: string;
    end_date: string;
    rent_cost: number;
  };
}

// جلب اللوحات مع بيانات العقود المرتبطة بها
export const fetchBillboardsWithContracts = async (): Promise<BillboardWithContract[]> => {
  try {
    // جلب اللوحات مع العقود المرتبطة
    const { data: billboards, error } = await supabase
      .from('billboards')
      .select(`
        *,
        contracts:contract_id (
          id,
          customer_name,
          ad_type,
          start_date,
          end_date,
          rent_cost
        )
      `)
      .order('ID', { ascending: true });

    if (error) {
      console.error('Error fetching billboards with contracts:', error);
      throw error;
    }

    // تحويل البيانات إلى الشكل المطلوب
    const processedBillboards: BillboardWithContract[] = (billboards || []).map((billboard: any) => {
      // تحديد حالة اللوحة بناءً على وجود عقد
      const hasActiveContract = billboard.contract_id && billboard.contracts;
      let status = billboard.Status || billboard.status || 'available';
      
      // إذا كان هناك عقد نشط، تحقق من تاريخ الانتهاء
      if (hasActiveContract && billboard.contracts) {
        const endDate = new Date(billboard.contracts.end_date);
        const today = new Date();
        
        if (endDate < today) {
          status = 'available'; // العقد منتهي
        } else {
          status = 'rented'; // العقد نشط
        }
      }

      return {
        // الحقول الأساسية للوحة
        ID: billboard.ID || billboard.id,
        Billboard_Name: billboard.Billboard_Name || billboard.name || `لوحة رقم ${billboard.ID || billboard.id}`,
        City: billboard.City || billboard.city || '',
        District: billboard.District || billboard.district || '',
        Municipality: billboard.Municipality || billboard.municipality || '',
        Size: billboard.Size || billboard.size || '',
        Status: status,
        Price: billboard.Price || billboard.price || '',
        Level: billboard.Level || billboard.level || '',
        Image_URL: billboard.Image_URL || billboard.image_url || '',
        GPS_Coordinates: billboard.GPS_Coordinates || billboard.coordinates || '',
        GPS_Link: billboard.GPS_Link || (billboard.coordinates ? `https://www.google.com/maps?q=${billboard.coordinates}` : ''),
        Nearest_Landmark: billboard.Nearest_Landmark || billboard.location || '',
        Faces_Count: billboard.Faces_Count || billboard.faces_count || '1',

        // معلومات العقد إذا كانت موجودة
        Contract_Number: billboard.contract_id || '',
        Customer_Name: billboard.contracts?.customer_name || billboard.customer_name || '',
        Rent_Start_Date: billboard.contracts?.start_date || billboard.start_date || '',
        Rent_End_Date: billboard.contracts?.end_date || billboard.end_date || '',
        Ad_Type: billboard.contracts?.ad_type || billboard.ad_type || '',

        // بيانات العقد المفصلة
        contract: billboard.contracts ? {
          id: billboard.contracts.id,
          customer_name: billboard.contracts.customer_name,
          ad_type: billboard.contracts.ad_type,
          start_date: billboard.contracts.start_date,
          end_date: billboard.contracts.end_date,
          rent_cost: billboard.contracts.rent_cost
        } : undefined,

        // الحقول الإضافية
        id: String(billboard.ID || billboard.id),
        name: billboard.Billboard_Name || billboard.name,
        location: billboard.Nearest_Landmark || billboard.location,
        size: billboard.Size || billboard.size,
        price: Number(billboard.Price || billboard.price || 0),
        status: status as 'available' | 'rented' | 'maintenance',
        city: billboard.City || billboard.city,
        district: billboard.District || billboard.district,
        municipality: billboard.Municipality || billboard.municipality,
        coordinates: billboard.GPS_Coordinates || billboard.coordinates,
        image: billboard.Image_URL || billboard.image_url,
        contractNumber: billboard.contract_id || '',
        clientName: billboard.contracts?.customer_name || billboard.customer_name || '',
        expiryDate: billboard.contracts?.end_date || billboard.end_date || '',
        adType: billboard.contracts?.ad_type || billboard.ad_type || '',
        level: billboard.Level || billboard.level || ''
      };
    });

    console.log('Fetched billboards with contracts:', processedBillboards.length);
    return processedBillboards;
  } catch (error) {
    console.error('Error in fetchBillboardsWithContracts:', error);
    throw error;
  }
};

// تحديث بيانات اللوحة مع العقد
export const updateBillboardContract = async (
  billboardId: number,
  contractData: {
    customer_name: string;
    ad_type: string;
    start_date: string;
    end_date: string;
    rent_cost: number;
  }
): Promise<void> => {
  try {
    // إنشاء عقد جديد
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert(contractData)
      .select()
      .single();

    if (contractError) {
      throw contractError;
    }

    // ربط اللوحة بالعقد
    const { error: billboardError } = await supabase
      .from('billboards')
      .update({
        contract_id: contract.id,
        start_date: contractData.start_date,
        end_date: contractData.end_date,
        customer_name: contractData.customer_name,
        Status: 'rented'
      })
      .eq('ID', billboardId);

    if (billboardError) {
      throw billboardError;
    }

    console.log('Billboard contract updated successfully');
  } catch (error) {
    console.error('Error updating billboard contract:', error);
    throw error;
  }
};

// تحرير اللوحة من العقد
export const releaseBillboardContract = async (billboardId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('billboards')
      .update({
        contract_id: null,
        start_date: null,
        end_date: null,
        customer_name: null,
        Status: 'available'
      })
      .eq('ID', billboardId);

    if (error) {
      throw error;
    }

    console.log('Billboard released from contract successfully');
  } catch (error) {
    console.error('Error releasing billboard contract:', error);
    throw error;
  }
};