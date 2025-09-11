-- Fix RLS policies to allow UPDATE operations on Contract table
-- This fixes the issue where contract editing fails with "لم يتم حفظ أي تغييرات (RLS أو رقم العقد غير صحيح)"

-- Add UPDATE policy for Contract table
CREATE POLICY "Enable update access for all users" ON public."Contract" FOR UPDATE USING (true);

-- Add INSERT policy for Contract table (in case needed for new contracts)
CREATE POLICY "Enable insert access for all users" ON public."Contract" FOR INSERT WITH CHECK (true);

-- Add DELETE policy for Contract table (in case needed for contract deletion)
CREATE POLICY "Enable delete access for all users" ON public."Contract" FOR DELETE USING (true);

-- Also add UPDATE policies for billboards table (needed when updating billboard contract associations)
CREATE POLICY "Enable update access for all users" ON public.billboards FOR UPDATE USING (true);

-- Add INSERT policy for billboards table
CREATE POLICY "Enable insert access for all users" ON public.billboards FOR INSERT WITH CHECK (true);

-- Add DELETE policy for billboards table
CREATE POLICY "Enable delete access for all users" ON public.billboards FOR DELETE USING (true);

-- Add policies for contracts table (lowercase) as well, in case it's being used
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') THEN
        -- Enable RLS on contracts table if it exists
        ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
        
        -- Add policies for contracts table
        CREATE POLICY "Enable read access for all users" ON public.contracts FOR SELECT USING (true);
        CREATE POLICY "Enable update access for all users" ON public.contracts FOR UPDATE USING (true);
        CREATE POLICY "Enable insert access for all users" ON public.contracts FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable delete access for all users" ON public.contracts FOR DELETE USING (true);
    END IF;
END $$;

-- Add policies for customers table (needed for customer management in contract editing)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
        -- Enable RLS on customers table if it exists
        ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
        
        -- Add policies for customers table
        CREATE POLICY "Enable read access for all users" ON public.customers FOR SELECT USING (true);
        CREATE POLICY "Enable update access for all users" ON public.customers FOR UPDATE USING (true);
        CREATE POLICY "Enable insert access for all users" ON public.customers FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable delete access for all users" ON public.customers FOR DELETE USING (true);
    END IF;
END $$;