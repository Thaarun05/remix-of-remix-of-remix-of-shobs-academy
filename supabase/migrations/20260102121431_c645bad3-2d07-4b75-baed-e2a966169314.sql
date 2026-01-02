-- Add missing columns to teacher_salary table
ALTER TABLE public.teacher_salary 
ADD COLUMN IF NOT EXISTS teacher_name text,
ADD COLUMN IF NOT EXISTS note text;

-- Add missing columns to student_fees table
ALTER TABLE public.student_fees 
ADD COLUMN IF NOT EXISTS student_name text,
ADD COLUMN IF NOT EXISTS teacher_name text,
ADD COLUMN IF NOT EXISTS total_amount numeric;