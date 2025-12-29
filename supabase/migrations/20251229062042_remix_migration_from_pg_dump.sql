CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'student',
    'teacher',
    'admin'
);


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_user_id uuid NOT NULL,
    teacher_user_id uuid NOT NULL,
    title text NOT NULL,
    subject text,
    description text,
    due_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    has_attachments boolean DEFAULT false,
    attachments jsonb DEFAULT '[]'::jsonb,
    submission_attachments jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text])))
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_user_id uuid NOT NULL,
    teacher_user_id uuid NOT NULL,
    date date NOT NULL,
    status text NOT NULL,
    hours numeric,
    topic text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_records_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text])))
);


--
-- Name: demo_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    student_name text NOT NULL,
    parent_name text NOT NULL,
    parent_email text NOT NULL,
    age text NOT NULL,
    grade text NOT NULL,
    subject text NOT NULL,
    timing text NOT NULL,
    days text NOT NULL,
    phone text NOT NULL,
    status text DEFAULT 'sent'::text
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    event_type text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    student_user_id uuid NOT NULL,
    teacher_user_id uuid,
    assignment_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT events_event_type_check CHECK ((event_type = ANY (ARRAY['class'::text, 'assignment'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    full_name text,
    phone text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: student_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_profiles (
    user_id uuid NOT NULL,
    student_name text NOT NULL,
    grade text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: teacher_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_profiles (
    user_id uuid NOT NULL,
    subjects text,
    availability text,
    bio text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: zoom_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zoom_links (
    student_user_id uuid NOT NULL,
    meeting_url text NOT NULL,
    meeting_id text,
    passcode text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: demo_requests demo_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_requests
    ADD CONSTRAINT demo_requests_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: student_profiles student_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: student_profiles student_profiles_student_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_student_name_key UNIQUE (student_name);


--
-- Name: teacher_profiles teacher_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: zoom_links zoom_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zoom_links
    ADD CONSTRAINT zoom_links_pkey PRIMARY KEY (student_user_id);


--
-- Name: assignments update_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teacher_profiles update_teacher_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teacher_profiles_updated_at BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: zoom_links update_zoom_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_zoom_links_updated_at BEFORE UPDATE ON public.zoom_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assignments assignments_student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_teacher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_teacher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_teacher_user_id_fkey FOREIGN KEY (teacher_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: events events_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: student_profiles student_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: teacher_profiles teacher_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_profiles
    ADD CONSTRAINT teacher_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: zoom_links zoom_links_student_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zoom_links
    ADD CONSTRAINT zoom_links_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assignments Admins can manage all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all assignments" ON public.assignments USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: attendance_records Admins can manage all attendance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all attendance records" ON public.attendance_records USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: events Admins can manage all events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all events" ON public.events USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: student_profiles Admins can manage all student profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all student profiles" ON public.student_profiles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teacher_profiles Admins can manage all teacher profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all teacher profiles" ON public.teacher_profiles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: zoom_links Admins can manage all zoom links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all zoom links" ON public.zoom_links USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: demo_requests Admins can manage demo requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage demo requests" ON public.demo_requests USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: demo_requests Admins can view all demo requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all demo requests" ON public.demo_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: student_profiles Admins can view all student profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all student profiles" ON public.student_profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: demo_requests Anyone can submit demo requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit demo requests" ON public.demo_requests FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: student_profiles Students can insert their own student profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can insert their own student profile" ON public.student_profiles FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: assignments Students can update status of their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update status of their own assignments" ON public.assignments FOR UPDATE USING ((student_user_id = auth.uid()));


--
-- Name: student_profiles Students can update their own student profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can update their own student profile" ON public.student_profiles FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: assignments Students can view their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own assignments" ON public.assignments FOR SELECT USING ((student_user_id = auth.uid()));


--
-- Name: attendance_records Students can view their own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own attendance" ON public.attendance_records FOR SELECT USING ((student_user_id = auth.uid()));


--
-- Name: events Students can view their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own events" ON public.events FOR SELECT USING ((student_user_id = auth.uid()));


--
-- Name: student_profiles Students can view their own student profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own student profile" ON public.student_profiles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: zoom_links Students can view their own zoom link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can view their own zoom link" ON public.zoom_links FOR SELECT USING ((student_user_id = auth.uid()));


--
-- Name: events Teachers can delete their events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can delete their events" ON public.events FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: assignments Teachers can delete their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can delete their own assignments" ON public.assignments FOR DELETE USING ((teacher_user_id = auth.uid()));


--
-- Name: attendance_records Teachers can delete their own attendance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can delete their own attendance records" ON public.attendance_records FOR DELETE USING ((teacher_user_id = auth.uid()));


--
-- Name: assignments Teachers can insert assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can insert assignments" ON public.assignments FOR INSERT WITH CHECK (((teacher_user_id = auth.uid()) AND public.has_role(auth.uid(), 'teacher'::public.app_role)));


--
-- Name: attendance_records Teachers can insert attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can insert attendance" ON public.attendance_records FOR INSERT WITH CHECK (((teacher_user_id = auth.uid()) AND public.has_role(auth.uid(), 'teacher'::public.app_role)));


--
-- Name: events Teachers can insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can insert events" ON public.events FOR INSERT WITH CHECK (((created_by = auth.uid()) AND public.has_role(auth.uid(), 'teacher'::public.app_role)));


--
-- Name: zoom_links Teachers can manage zoom links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can manage zoom links" ON public.zoom_links USING (public.has_role(auth.uid(), 'teacher'::public.app_role));


--
-- Name: events Teachers can update their events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can update their events" ON public.events FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: assignments Teachers can update their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can update their own assignments" ON public.assignments FOR UPDATE USING ((teacher_user_id = auth.uid()));


--
-- Name: attendance_records Teachers can update their own attendance records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can update their own attendance records" ON public.attendance_records FOR UPDATE USING ((teacher_user_id = auth.uid()));


--
-- Name: teacher_profiles Teachers can update their own teacher profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can update their own teacher profile" ON public.teacher_profiles FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: student_profiles Teachers can view all student profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view all student profiles" ON public.student_profiles FOR SELECT USING (public.has_role(auth.uid(), 'teacher'::public.app_role));


--
-- Name: assignments Teachers can view assignments they created; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view assignments they created" ON public.assignments FOR SELECT USING ((teacher_user_id = auth.uid()));


--
-- Name: attendance_records Teachers can view attendance they created; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view attendance they created" ON public.attendance_records FOR SELECT USING ((teacher_user_id = auth.uid()));


--
-- Name: events Teachers can view their events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view their events" ON public.events FOR SELECT USING (((teacher_user_id = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: teacher_profiles Teachers can view their own teacher profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers can view their own teacher profile" ON public.teacher_profiles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update their own profile except role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile except role" ON public.profiles FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: demo_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: student_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: zoom_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zoom_links ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;