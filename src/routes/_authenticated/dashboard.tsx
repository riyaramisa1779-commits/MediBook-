import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, useRoles, primaryRole } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Users, Clock } from "lucide-react";
import { claimFirstAdmin } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const role = primaryRole(roles);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: apptCount } = useQuery({
    queryKey: ["appt-count", user?.id, role],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const claim = useServerFn(claimFirstAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hi{profile?.name ? `, ${profile.name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{role}</span>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Appointments visible to you" value={apptCount ?? "—"} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Your role" value={role} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Account" value={profile?.is_active ? "Active" : "Inactive"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {role === "patient" && (
          <QuickCard title="Book an appointment" body="Find an available doctor and pick a time slot.">
            <Button asChild><Link to="/book">Book now</Link></Button>
          </QuickCard>
        )}
        {role === "doctor" && (
          <QuickCard title="Manage your schedule" body="Set your weekly hours, breaks, and leaves.">
            <Button asChild><Link to="/schedule">Open schedule</Link></Button>
          </QuickCard>
        )}
        <QuickCard title="Appointments" body="View past and upcoming bookings.">
          <Button asChild variant="outline"><Link to="/appointments">View appointments</Link></Button>
        </QuickCard>

        {role === "patient" && (
          <QuickCard
            title="First-time setup"
            body="No admin exists yet? Claim admin access to bootstrap the system."
          >
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await claim();
                  toast.success("You are now admin. Refresh to see admin tools.");
                  window.location.reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Claim first admin
            </Button>
          </QuickCard>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{body}</p>
        {children}
      </CardContent>
    </Card>
  );
}
