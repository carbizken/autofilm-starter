import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Users, Search } from "lucide-react";

type ContactRow = Tables<"contacts">;

export default function Contacts() {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });

  const loadContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    setContacts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) {
      toast.error("No organization found");
      return;
    }
    const { error } = await supabase.from("contacts").insert({
      ...form,
      organization_id: profile.organization_id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contact added");
      setForm({ first_name: "", last_name: "", email: "", phone: "" });
      setDialogOpen(false);
      loadContacts();
    }
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      (c.last_name?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">
            {contacts.length} customer{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 active:scale-[0.97]">
              <Plus className="h-4 w-4" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={addContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First name *</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full active:scale-[0.97]">
                Save Contact
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-medium">No contacts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first customer to start sending videos
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.first_name} {c.last_name}
                    </TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
