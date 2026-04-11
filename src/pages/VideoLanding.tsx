import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Film } from "lucide-react";

interface ShareData {
  share_token: string;
  video: {
    title: string;
    storage_path: string;
    profiles: { full_name: string | null; job_title: string | null } | null;
    organizations: { name: string; logo_url: string | null; primary_color: string | null } | null;
  };
}

export default function VideoLanding() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;

    supabase
      .from("video_shares")
      .select(`
        id,
        share_token,
        video_id,
        videos!inner(
          title,
          storage_path,
          user_id,
          organization_id
        )
      `)
      .eq("share_token", token)
      .single()
      .then(async ({ data: shareRow, error }: { data: any; error: any }) => {
        if (error || !shareRow) {
          setNotFound(true);
          return;
        }

        const video = (shareRow as any).videos;

        let profileData = null;
        let orgData = null;

        if (video.user_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("full_name, job_title")
            .eq("user_id", video.user_id)
            .single();
          profileData = p;
        }

        if (video.organization_id) {
          const { data: o } = await supabase
            .from("organizations")
            .select("name, logo_url, primary_color")
            .eq("id", video.organization_id)
            .single();
          orgData = o;
        }

        setData({
          share_token: shareRow.share_token,
          video: {
            title: video.title,
            storage_path: video.storage_path,
            profiles: profileData,
            organizations: orgData,
          },
        });

        supabase.from("video_views").insert({
          video_share_id: shareRow.id,
          user_agent: navigator.userAgent,
        });
      });
  }, [token]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Film className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-lg font-medium">Video not found</p>
          <p className="text-sm text-muted-foreground">This link may have expired</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const videoUrl = supabase.storage
    .from("videos")
    .getPublicUrl(data.video.storage_path).data.publicUrl;

  const org = data.video.organizations;
  const rep = data.video.profiles;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          {org?.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-10 w-10 rounded-lg object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              {org?.name?.[0] || "A"}
            </div>
          )}
          <div>
            <p className="font-semibold">{org?.name || "AutoFilm"}</p>
            {rep && (
              <p className="text-sm text-muted-foreground">
                {rep.full_name}{rep.job_title ? ` · ${rep.job_title}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-lg bg-foreground/5">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full aspect-video"
          />
        </div>

        <h1 className="text-xl font-bold">{data.video.title}</h1>

        <div className="flex flex-wrap gap-3">
          <a
            href="tel:"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all"
          >
            Call Us
          </a>
          <a
            href="mailto:"
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted active:scale-[0.97] transition-all"
          >
            Reply by Email
          </a>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-8">
          Powered by AutoFilm
        </p>
      </div>
    </div>
  );
}
