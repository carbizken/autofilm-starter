import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CircleDot, Square, Upload, RotateCcw, Camera } from "lucide-react";

type RecordingState = "idle" | "previewing" | "recording" | "recorded" | "uploading";

export default function Record() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<RecordingState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setState("previewing");
    } catch {
      toast.error("Could not access camera. Please allow camera permissions.");
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setDuration(0);

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        videoRef.current.muted = false;
        videoRef.current.controls = true;
      }
      setState("recorded");
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setState("recording");

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const retake = useCallback(() => {
    setRecordedBlob(null);
    setDuration(0);
    if (videoRef.current) {
      videoRef.current.src = "";
      videoRef.current.controls = false;
    }
    startCamera();
  }, [startCamera]);

  const upload = useCallback(async () => {
    if (!recordedBlob || !user) return;
    setState("uploading");

    const fileName = `${user.id}/${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, recordedBlob, { contentType: "video/webm" });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setState("recorded");
      return;
    }

    let thumbnailPath: string | undefined;
    try {
      const canvas = document.createElement("canvas");
      const tempVideo = document.createElement("video");
      tempVideo.src = URL.createObjectURL(recordedBlob);
      await new Promise((r) => { tempVideo.onloadeddata = r; tempVideo.load(); });
      canvas.width = tempVideo.videoWidth;
      canvas.height = tempVideo.videoHeight;
      canvas.getContext("2d")?.drawImage(tempVideo, 0, 0);
      const thumbBlob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", 0.7)
      );
      if (thumbBlob) {
        const thumbName = `${user.id}/${Date.now()}_thumb.jpg`;
        await supabase.storage.from("videos").upload(thumbName, thumbBlob, {
          contentType: "image/jpeg",
        });
        thumbnailPath = thumbName;
      }
    } catch {
      // thumbnail generation is best-effort
    }

    const { error: dbError } = await supabase.from("videos").insert({
      user_id: user.id,
      organization_id: profile?.organization_id ?? undefined,
      title: title || "Untitled Video",
      storage_path: fileName,
      thumbnail_path: thumbnailPath,
      duration_seconds: duration,
      file_size_bytes: recordedBlob.size,
    });

    if (dbError) {
      toast.error("Failed to save video record");
      setState("recorded");
      return;
    }

    toast.success("Video uploaded!");
    navigate("/videos");
  }, [recordedBlob, user, profile, title, duration, navigate]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight">Record a Video</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Record a personalized message for your customer
        </p>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden animate-fade-up-delay-1">
        <div className="relative aspect-video bg-background/50">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
          />

          {state === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 backdrop-blur-sm">
                <Camera className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <Button onClick={startCamera} size="lg" className="gap-2 active:scale-[0.97] glow-primary">
                <Camera className="h-4 w-4" />
                Start Camera
              </Button>
            </div>
          )}

          {state === "recording" && (
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-destructive/90 px-3 py-1.5 text-destructive-foreground text-sm font-medium backdrop-blur-sm glow-destructive">
              <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
              {formatTime(duration)}
            </div>
          )}
        </div>

        <div className="p-4 space-y-4 border-t border-border/30">
          {state === "previewing" && (
            <div className="flex justify-center">
              <Button
                onClick={startRecording}
                size="lg"
                className="gap-2 bg-destructive hover:bg-destructive/90 active:scale-[0.97] glow-destructive"
              >
                <CircleDot className="h-4 w-4" />
                Start Recording
              </Button>
            </div>
          )}

          {state === "recording" && (
            <div className="flex justify-center">
              <Button
                onClick={stopRecording}
                size="lg"
                variant="outline"
                className="gap-2 active:scale-[0.97] border-border/50"
              >
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
            </div>
          )}

          {state === "recorded" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="videoTitle" className="text-sm text-muted-foreground">Video title</Label>
                <Input
                  id="videoTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 2024 Honda Civic walkthrough"
                  className="bg-secondary/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={retake}
                  className="gap-2 active:scale-[0.97] border-border/50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </Button>
                <Button
                  onClick={upload}
                  className="flex-1 gap-2 active:scale-[0.97] glow-primary"
                >
                  <Upload className="h-4 w-4" />
                  Save & Upload
                </Button>
              </div>
            </>
          )}

          {state === "uploading" && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Uploading…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
