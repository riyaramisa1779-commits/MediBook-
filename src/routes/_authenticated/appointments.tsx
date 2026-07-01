import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateAppointmentStatus } from "@/lib/appointments.functions";
import { useAuth, useRoles, primaryRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/appointments")({
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const role = primaryRole(roles);
  const qc = useQueryClient();
  const updateStatus = useServerFn(updateAppointmentStatus);

  const { data: appts } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Resolve names
  const ids = Array.from(
    new Set((appts ?? []).flatMap((a) => [a.doctor_id, a.patient_id])),
  );
  const { data: profiles } = useQuery({
    queryKey: ["profiles", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").in("id", ids);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((p) => map.set(p.id, p.name || "—"));
      return map;
    },
  });

  async function changeStatus(id: string, status: "confirmed" | "cancelled" | "completed") {
    try {
      await updateStatus({ data: { appointmentId: id, status } });
      toast.success(`Marked ${status}`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Appointments</h1>
        <p className="text-muted-foreground">
          {role === "admin" ? "All appointments in the system." : "Your appointments."}
        </p>
      </div>

      <div className="grid gap-3">
        {(appts ?? []).map((a) => {
          const canManage = role === "doctor" || role === "admin";
          const isPatient = role === "patient";
          return (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {a.appointment_date} · {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                  {a.emergency_flag && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Urgent
                    </Badge>
                  )}
                  <StatusBadge status={a.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Doctor: {profiles?.get(a.doctor_id) ?? "…"} · Patient:{" "}
                  {profiles?.get(a.patient_id) ?? "…"}
                </div>
                {a.notes && <p className="text-sm">{a.notes}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  {canManage && a.status === "pending" && (
                    <Button size="sm" onClick={() => changeStatus(a.id, "confirmed")}>
                      Confirm
                    </Button>
                  )}
                  {canManage && a.status === "confirmed" && (
                    <Button size="sm" onClick={() => changeStatus(a.id, "completed")}>
                      Mark completed
                    </Button>
                  )}
                  {a.status !== "cancelled" && a.status !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changeStatus(a.id, "cancelled")}
                      disabled={isPatient && a.status !== "pending"}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {appts?.length === 0 && (
          <p className="text-sm text-muted-foreground">No appointments yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "confirmed"
      ? "default"
      : status === "completed"
        ? "secondary"
        : status === "cancelled"
          ? "outline"
          : "secondary";
  return <Badge variant={variant as never}>{status}</Badge>;
}
