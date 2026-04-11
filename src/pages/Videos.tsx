import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { CircleDot, Play, Clock, Film } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type VideoRow = Tables<"videos">;

export default function Videos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setVideos(data ?? []);
        setLoading(false);
      });
  }, []);

  const getPublicUrl = (path: string) =>
    supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;

  const formatDuration = (s: number | null) => {
    if (!s) return "0:00";
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video Library</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {videos.length} video{videos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => navigate("/record")} className="gap-2 active:scale-[0.97] glow-primary">
          <CircleDot className="h-4 w-4" />
          Record New
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 animate-fade-up-delay-1">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
              <Film className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div>
              <p className="font-medium">No videos yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Record your first video to start connecting with customers
              </p>
            </div>
            <Button onClick={() => navigate("/record")} className="active:scale-[0.97] glow-primary">
              Record Your First Video
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, i) => (
            <div
              key={video.id}
              className={`glass-card-hover rounded-2xl overflow-hidden cursor-pointer group animate-fade-up-delay-${Math.min(i + 1, 4)}`}
              onClick={() => navigate(`/videos/${video.id}`)}
            >
              <div className="relative aspect-video bg-background/30">
                {video.thumbnail_path ? (
                  <img
                    src={getPublicUrl(video.thumbnail_path)}
                    alt={video.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-8 w-8 text-muted-foreground/20" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-background/20 backdrop-blur-[2px]">
                  <div className="rounded-full bg-primary/90 p-3 glow-primary">
                    <Play className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>
                {video.duration_seconds && (
                  <span className="absolute bottom-2 right-2 rounded-lg bg-background/80 backdrop-blur-sm px-2 py-0.5 text-xs font-medium tabular-nums">
                    {formatDuration(video.duration_seconds)}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium truncate">{video.title}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
