-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

-- Create profiles table (main role table)
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create student_profiles table
CREATE TABLE public.student_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT UNIQUE NOT NULL,
  grade TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create teacher_profiles table
CREATE TABLE public.teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects TEXT,
  availability TEXT,
  bio TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  hours NUMERIC,
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create zoom_links table
CREATE TABLE public.zoom_links (
  student_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_url TEXT NOT NULL,
  meeting_id TEXT,
  passcode TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_links ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id
$$;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = _role
  )
$$;

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile except role"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- STUDENT_PROFILES POLICIES
CREATE POLICY "Students can view their own student profile"
ON public.student_profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Teachers can view all student profiles"
ON public.student_profiles FOR SELECT
USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can view all student profiles"
ON public.student_profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can insert their own student profile"
ON public.student_profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can update their own student profile"
ON public.student_profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all student profiles"
ON public.student_profiles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- TEACHER_PROFILES POLICIES
CREATE POLICY "Teachers can view their own teacher profile"
ON public.teacher_profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Teachers can update their own teacher profile"
ON public.teacher_profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all teacher profiles"
ON public.teacher_profiles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ATTENDANCE_RECORDS POLICIES
CREATE POLICY "Students can view their own attendance"
ON public.attendance_records FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Teachers can view attendance they created"
ON public.attendance_records FOR SELECT
USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can insert attendance"
ON public.attendance_records FOR INSERT
WITH CHECK (teacher_user_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update their own attendance records"
ON public.attendance_records FOR UPDATE
USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can delete their own attendance records"
ON public.attendance_records FOR DELETE
USING (teacher_user_id = auth.uid());

CREATE POLICY "Admins can manage all attendance records"
ON public.attendance_records FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ASSIGNMENTS POLICIES
CREATE POLICY "Students can view their own assignments"
ON public.assignments FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Students can update status of their own assignments"
ON public.assignments FOR UPDATE
USING (student_user_id = auth.uid());

CREATE POLICY "Teachers can view assignments they created"
ON public.assignments FOR SELECT
USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can insert assignments"
ON public.assignments FOR INSERT
WITH CHECK (teacher_user_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update their own assignments"
ON public.assignments FOR UPDATE
USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can delete their own assignments"
ON public.assignments FOR DELETE
USING (teacher_user_id = auth.uid());

CREATE POLICY "Admins can manage all assignments"
ON public.assignments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ZOOM_LINKS POLICIES
CREATE POLICY "Students can view their own zoom link"
ON public.zoom_links FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Teachers can manage zoom links"
ON public.zoom_links FOR ALL
USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can manage all zoom links"
ON public.zoom_links FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_teacher_profiles_updated_at
BEFORE UPDATE ON public.teacher_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zoom_links_updated_at
BEFORE UPDATE ON public.zoom_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();