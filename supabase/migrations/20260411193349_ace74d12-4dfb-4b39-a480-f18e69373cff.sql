
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1a1a2e',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);

-- Create videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Video',
  description TEXT,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_shares table
CREATE TABLE public.video_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  delivery_method TEXT NOT NULL DEFAULT 'link',
  message TEXT,
  cta_buttons JSONB DEFAULT '[]'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_views table
CREATE TABLE public.video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_share_id UUID REFERENCES public.video_shares(id) ON DELETE CASCADE NOT NULL,
  viewer_ip TEXT,
  user_agent TEXT,
  watch_duration_seconds INTEGER DEFAULT 0,
  cta_clicked TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to get user's org
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Organizations policies
CREATE POLICY "Users can view their org" ON public.organizations
  FOR SELECT USING (id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can update their org" ON public.organizations
  FOR UPDATE USING (id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view profiles in their org" ON public.profiles
  FOR SELECT USING (organization_id = public.get_user_org_id(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles in their org" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Videos policies
CREATE POLICY "Users can view videos in their org" ON public.videos
  FOR SELECT USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can create videos" ON public.videos
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own videos" ON public.videos
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own videos" ON public.videos
  FOR DELETE USING (user_id = auth.uid());

-- Contacts policies
CREATE POLICY "Users can view contacts in their org" ON public.contacts
  FOR SELECT USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can create contacts in their org" ON public.contacts
  FOR INSERT WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update contacts in their org" ON public.contacts
  FOR UPDATE USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete contacts in their org" ON public.contacts
  FOR DELETE USING (organization_id = public.get_user_org_id(auth.uid()));

-- Video shares policies
CREATE POLICY "Users can view shares for their videos" ON public.video_shares
  FOR SELECT USING (video_id IN (SELECT id FROM public.videos WHERE organization_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Users can create shares" ON public.video_shares
  FOR INSERT WITH CHECK (video_id IN (SELECT id FROM public.videos WHERE user_id = auth.uid()));

-- Video views - scoped insert, org members can read
CREATE POLICY "Anyone can record a view for existing shares" ON public.video_views
  FOR INSERT WITH CHECK (
    video_share_id IN (SELECT id FROM public.video_shares)
  );
CREATE POLICY "Org members can view analytics" ON public.video_views
  FOR SELECT USING (video_share_id IN (
    SELECT vs.id FROM public.video_shares vs
    JOIN public.videos v ON vs.video_id = v.id
    WHERE v.organization_id = public.get_user_org_id(auth.uid())
  ));

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Timestamp triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and org on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Dealership')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (NEW.id, new_org_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos');
CREATE POLICY "Anyone can view videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Users can delete their own videos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
