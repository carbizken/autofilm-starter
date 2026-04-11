import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, User } from "lucide-react";

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setJobTitle(profile.job_title || "");
    }
    if (profile?.organization_id) {
      supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .single()
        .then(({ data }) => {
          if (data) setOrgName(data.name);
        });
    }
  }, [profile]);

  const save = async () => {
    if (!user || !profile) return;
    setSaving(true);

    await supabase
      .from("profiles")
      .update({ full_name: fullName, job_title: jobTitle })
      .eq("user_id", user.id);

    if (profile.organization_id) {
      await supabase
        .from("organizations")
        .update({ name: orgName })
        .eq("id", profile.organization_id);
    }

    toast.success("Settings saved");
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Job title</Label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Sales Manager"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Dealership
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dealership name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="active:scale-[0.97]">
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
