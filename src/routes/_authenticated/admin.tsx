import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, useRoles } from "@/hooks/useAuth";

import { useServerFn } from "@tanstack/react-start";
import { createDoctor, listDoctors } from "@/lib/admin.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const createDoc = useServerFn(createDoctor);
  const listDocs = useServerFn(listDoctors);
  const { user, loading: authLoading } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useRoles(user?.id);
  const navigate = useNavigate();
  const isAdmin = roles?.includes("admin");

  useEffect(() => {
    if (!authLoading && !rolesLoading && user && !isAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authLoading, rolesLoading, isAdmin, user, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [spec, setSpec] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: doctors } = useQuery({
    queryKey: ["all-doctors"],
    enabled: !!isAdmin,
    queryFn: async () => {
      return await listDocs();
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Create doctor accounts and manage the system.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Create doctor</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await createDoc({
                  data: { email, password, name, phone: phone || undefined, specialization: spec || undefined },
                });
                toast.success("Doctor created");
                setEmail(""); setPassword(""); setName(""); setPhone(""); setSpec("");
                qc.invalidateQueries({ queryKey: ["all-doctors"] });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Specialization"><Input value={spec} onChange={(e) => setSpec(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Temporary password">
              <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create doctor"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Doctors</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(doctors ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <div className="font-medium">{d.name || "—"}</div>
                <div className="text-muted-foreground">
                  {d.specialization || "General"} {d.phone ? `· ${d.phone}` : ""}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {d.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
          {doctors?.length === 0 && <p className="text-sm text-muted-foreground">No doctors yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
