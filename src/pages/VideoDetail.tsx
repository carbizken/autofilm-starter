import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Link2, ArrowLeft, Trash2, Share2 } from "lucide-react";

type VideoRow = Tables<"videos">;

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Video not found");
          navigate("/videos");
          return;
        }
        setVideo(data);
        setLoading(false);
      });
  }, [id, navigate]);

  const getPublicUrl = (path: string) =>
    supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;

  const createShareLink = async () => {
    if (!video) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("video_shares")
      .insert({ video_id: video.id, delivery_method: "link" })
      .select("share_token")
      .single();

    if (error) {
      toast.error("Failed to create share link");
    } else if (data) {
      const link = `${window.location.origin}/v/${data.share_token}`;
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard!");
    }
    setCreating(false);
  };

  const deleteVideo = async () => {
    if (!video) return;
    const confirmed = window.confirm("Delete this video permanently?");
    if (!confirmed) return;

    await supabase.storage.from("videos").remove([video.storage_path]);
    if (video.thumbnail_path) {
      await supabase.storage.from("videos").remove([video.thumbnail_path]);
    }
    await supabase.from("videos").delete().eq("id", video.id);
    toast.success("Video deleted");
    navigate("/videos");
  };

  if (loading || !video) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        onClick={() => navigate("/videos")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-up"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to library
      </button>

      <div className="glass-card rounded-2xl overflow-hidden animate-fade-up-delay-1">
        <div className="aspect-video bg-background/30">
          <video
            src={getPublicUrl(video.storage_path)}
            controls
            className="h-full w-full"
            playsInline
          />
        </div>
        <div className="p-5 space-y-2 border-t border-border/30">
          <h1 className="text-xl font-bold">{video.title}</h1>
          {video.description && (
            <p className="text-muted-foreground text-sm">{video.description}</p>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-up-delay-2">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Share This Video</h2>
        </div>
        {shareLink ? (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Shareable link</Label>
            <div className="flex gap-2">
              <Input value={shareLink} readOnly className="font-mono text-xs bg-secondary/50 border-border/50" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  toast.success("Copied!");
                }}
                className="active:scale-[0.95] border-border/50"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={createShareLink}
            disabled={creating}
            className="gap-2 active:scale-[0.97] glow-primary"
          >
            <Link2 className="h-4 w-4" />
            {creating ? "Creating…" : "Generate Share Link"}
          </Button>
        )}
      </div>

      <div className="flex justify-end animate-fade-up-delay-3">
        <Button
          variant="outline"
          onClick={deleteVideo}
          className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]"
        >
          <Trash2 className="h-4 w-4" />
          Delete Video
        </Button>
      </div>
    </div>
  );
}
