import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Video, Eye, Send, CircleDot, Flame, Lightbulb, TrendingUp } from "lucide-react";

const coachTips = [
  "Start every video with the customer's first name — it triples watch-through rate.",
  "Keep walkaround videos under 90 seconds. After that, attention drops by 60%.",
  "Mention one specific detail about their inquiry — shows you read their lead.",
  "End with a clear next step: 'I'll call you at 3pm' beats 'Let me know!'",
  "Record in landscape for walkarounds, portrait for personal intros.",
];

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ videos: 0, shares: 0, views: 0 });
  const [tipIndex] = useState(() => Math.floor(Math.random() * coachTips.length));

  useEffect(() => {
    async function loadStats() {
      const [videosRes, sharesRes, viewsRes] = await Promise.all([
        supabase.from("videos").select("id", { count: "exact", head: true }),
        supabase.from("video_shares").select("id", { count: "exact", head: true }),
        supabase.from("video_views").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        videos: videosRes.count ?? 0,
        shares: sharesRes.count ?? 0,
        views: viewsRes.count ?? 0,
      });
    }
    loadStats();
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const statCards = [
    { label: "Videos", value: stats.videos, icon: Video, glowClass: "glow-primary", iconColor: "text-primary" },
    { label: "Shared", value: stats.shares, icon: Send, glowClass: "glow-accent", iconColor: "text-accent" },
    { label: "Views", value: stats.views, icon: Eye, glowClass: "", iconColor: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, <span className="text-gradient">{firstName}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here's what's happening with your videos
          </p>
        </div>
        <Button
          onClick={() => navigate("/record")}
          className="gap-2 active:scale-[0.97] glow-primary"
        >
          <CircleDot className="h-4 w-4" />
          Record Video
        </Button>
      </div>

      <div className="bento-grid">
        {statCards.map((s, i) => (
          <div
            key={s.label}
            className={`glass-card-hover rounded-2xl p-5 flex flex-col justify-between ${s.glowClass} animate-fade-up-delay-${i + 1}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <s.icon className={`h-4 w-4 ${s.iconColor}`} />
            </div>
            <p className="text-3xl font-bold tabular-nums mt-3">{s.value}</p>
          </div>
        ))}

        <div className="glass-card-hover rounded-2xl p-5 sm:col-span-2 flex items-center gap-5 animate-fade-up-delay-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 glow-destructive">
            <Flame className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Daily Streak</p>
            <p className="text-2xl font-bold tabular-nums">
              {stats.videos > 0 ? "1" : "0"} day
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record a video every day to build your streak
            </p>
          </div>
        </div>

        <div className="glass-card-hover rounded-2xl p-5 flex flex-col gap-3 animate-fade-up-delay-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Video Coach
            </span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {coachTips[tipIndex]}
          </p>
        </div>

        <div
          className="glass-card-hover rounded-2xl p-5 sm:col-span-3 flex items-center justify-between cursor-pointer group animate-fade-up-delay-4"
          onClick={() => navigate("/record")}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Start connecting with customers</p>
              <p className="text-sm text-muted-foreground">
                Record and share a personalized video in under 2 minutes
              </p>
            </div>
          </div>
          <CircleDot className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}
