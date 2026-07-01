import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableSlots } from "@/lib/slots.functions";
import { bookAppointment } from "@/lib/appointments.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/book")({
  component: BookPage,
});

function BookPage() {
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [emergency, setEmergency] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      // Get all doctor user_ids then their profiles
      const { data: roleRows, error: e1 } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "doctor");
      if (e1) throw e1;
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id,name,specialization")
        .in("id", ids);
      if (e2) throw e2;
      return profs ?? [];
    },
  });

  const slotsFn = useServerFn(getAvailableSlots);
  const { data: slotData, isFetching: slotsLoading } = useQuery({
    queryKey: ["slots", doctorId, date],
    enabled: !!doctorId && !!date,
    queryFn: () => slotsFn({ data: { doctorId, date } }),
  });

  const bookFn = useServerFn(bookAppointment);

  async function book(startTime: string, endTime: string) {
    try {
      await bookFn({
        data: { doctorId, date, startTime, endTime, emergency, notes: notes || undefined },
      });
      toast.success("Appointment booked");
      navigate({ to: "/appointments" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Book an appointment</h1>
        <p className="text-muted-foreground">Pick a doctor and date to see live availability.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Search</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Doctor</Label>
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">Select doctor…</option>
                {(doctors ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || "Doctor"}
                    {d.specialization ? ` — ${d.specialization}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                className="mt-1.5"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <Switch id="em" checked={emergency} onCheckedChange={setEmergency} />
                <Label htmlFor="em" className="flex items-center gap-2 cursor-pointer">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Mark as emergency
                </Label>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Label>Notes for the doctor (optional)</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
        </CardContent>
      </Card>

      {doctorId && date && (
        <Card>
          <CardHeader><CardTitle>Available slots</CardTitle></CardHeader>
          <CardContent>
            {slotsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!slotsLoading && slotData?.reason === "no_schedule" && (
              <p className="text-sm text-muted-foreground">
                This doctor has no schedule for that day.
              </p>
            )}
            {!slotsLoading && slotData?.reason === "on_leave" && (
              <p className="text-sm text-muted-foreground">The doctor is on leave that day.</p>
            )}
            {!slotsLoading && slotData?.reason === "ok" && slotData.slots.length === 0 && (
              <p className="text-sm text-muted-foreground">No slots configured.</p>
            )}
            {!slotsLoading && slotData?.reason === "ok" && slotData.slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {slotData.slots.map((s) => (
                  <Button
                    key={s.start}
                    variant={s.taken ? "ghost" : "outline"}
                    disabled={s.taken}
                    onClick={() => book(s.start, s.end)}
                    className={s.taken ? "line-through opacity-50" : ""}
                  >
                    {s.start}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
