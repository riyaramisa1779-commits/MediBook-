import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public read-only server function: returns available slot start times for a
// doctor on a given date, computed from schedule + leaves - booked appts.
export const getAvailableSlots = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        doctorId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supa = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const dow = new Date(data.date + "T00:00:00Z").getUTCDay();

    const [schedRes, leaveRes, apptRes] = await Promise.all([
      supa
        .from("doctor_schedules")
        .select("start_time,end_time,slot_duration,break_start,break_end")
        .eq("doctor_id", data.doctorId)
        .eq("day_of_week", dow)
        .maybeSingle(),
      supa
        .from("doctor_leaves")
        .select("id")
        .eq("doctor_id", data.doctorId)
        .eq("leave_date", data.date)
        .maybeSingle(),
      supa
        .from("appointments")
        .select("start_time,status")
        .eq("doctor_id", data.doctorId)
        .eq("appointment_date", data.date),
    ]);

    if (schedRes.error) throw schedRes.error;
    if (!schedRes.data) return { slots: [], reason: "no_schedule" as const };
    if (leaveRes.data) return { slots: [], reason: "on_leave" as const };

    const sched = schedRes.data;
    const booked = new Set(
      (apptRes.data ?? [])
        .filter((a) => a.status !== "cancelled")
        .map((a) => (a.start_time as string).slice(0, 5)),
    );

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const toHM = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

    const start = toMin(sched.start_time);
    const end = toMin(sched.end_time);
    const brS = sched.break_start ? toMin(sched.break_start) : null;
    const brE = sched.break_end ? toMin(sched.break_end) : null;
    const dur = sched.slot_duration;

    const slots: { start: string; end: string; taken: boolean }[] = [];
    for (let t = start; t + dur <= end; t += dur) {
      const inBreak = brS !== null && brE !== null && t < brE && t + dur > brS;
      if (inBreak) continue;
      const hm = toHM(t);
      slots.push({
        start: hm,
        end: toHM(t + dur),
        taken: booked.has(hm),
      });
    }

    return { slots, reason: "ok" as const };
  });
