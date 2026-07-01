import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schedule")({
  component: SchedulePage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function SchedulePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: schedules } = useQuery({
    queryKey: ["schedules", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_schedules")
        .select("*")
        .eq("doctor_id", user!.id)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
  });

  const { data: leaves } = useQuery({
    queryKey: ["leaves", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_leaves")
        .select("*")
        .eq("doctor_id", user!.id)
        .order("leave_date");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your schedule</h1>
        <p className="text-muted-foreground">Set your weekly working hours and leaves.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Weekly hours</CardTitle></CardHeader>
        <CardContent>
          <ScheduleForm
            onSaved={() => qc.invalidateQueries({ queryKey: ["schedules"] })}
          />
          <div className="mt-6 space-y-2">
            {(schedules ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <div className="font-medium">{DAYS[s.day_of_week]}</div>
                  <div className="text-muted-foreground">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.slot_duration} min slots
                    {s.break_start && ` · break ${s.break_start.slice(0, 5)}–${s.break_end?.slice(0, 5)}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase.from("doctor_schedules").delete().eq("id", s.id);
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Removed");
                      qc.invalidateQueries({ queryKey: ["schedules"] });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {schedules?.length === 0 && (
              <p className="text-sm text-muted-foreground">No days configured yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leaves</CardTitle></CardHeader>
        <CardContent>
          <LeaveForm onSaved={() => qc.invalidateQueries({ queryKey: ["leaves"] })} />
          <div className="mt-6 space-y-2">
            {(leaves ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <div className="font-medium">{l.leave_date}</div>
                  {l.reason && <div className="text-muted-foreground">{l.reason}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase.from("doctor_leaves").delete().eq("id", l.id);
                    if (error) toast.error(error.message);
                    else qc.invalidateQueries({ queryKey: ["leaves"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {leaves?.length === 0 && (
              <p className="text-sm text-muted-foreground">No leaves scheduled.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScheduleForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [duration, setDuration] = useState(30);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("doctor_schedules").upsert(
        {
          doctor_id: user!.id,
          day_of_week: day,
          start_time: start,
          end_time: end,
          slot_duration: duration,
          break_start: breakStart || null,
          break_end: breakEnd || null,
        },
        { onConflict: "doctor_id,day_of_week" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <div className="md:col-span-2">
        <Label>Day</Label>
        <select
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        >
          {DAYS.map((d, i) => (
            <option key={i} value={i}>{d}</option>
          ))}
        </select>
      </div>
      <Field label="Start"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
      <Field label="End"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
      <Field label="Slot (min)"><Input type="number" min={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required /></Field>
      <Field label="Break start"><Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} /></Field>
      <Field label="Break end"><Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} /></Field>
      <div className="md:col-span-6">
        <Button type="submit" disabled={mut.isPending}>Save day</Button>
      </div>
    </form>
  );
}

function LeaveForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase
          .from("doctor_leaves")
          .insert({ doctor_id: user!.id, leave_date: date, reason: reason || null });
        if (error) toast.error(error.message);
        else {
          setDate("");
          setReason("");
          toast.success("Leave added");
          onSaved();
        }
      }}
    >
      <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <div className="md:col-span-2">
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <div className="md:col-span-3">
        <Button type="submit">Add leave</Button>
      </div>
    </form>
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
