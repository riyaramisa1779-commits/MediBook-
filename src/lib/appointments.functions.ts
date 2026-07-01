import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Book an appointment. RLS + a UNIQUE(doctor_id, appointment_date, start_time)
// composite constraint guarantees no double-booking; a race that violates it
// returns Postgres error 23505, which we translate to a friendly message.
export const bookAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        doctorId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        emergency: z.boolean().default(false),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        doctor_id: data.doctorId,
        patient_id: userId,
        appointment_date: data.date,
        start_time: data.startTime + ":00",
        end_time: data.endTime + ":00",
        emergency_flag: data.emergency,
        notes: data.notes ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique violation → slot was just taken
      if ((error as { code?: string }).code === "23505") {
        throw new Error("That slot was just booked by someone else. Please pick another.");
      }
      throw new Error(error.message);
    }
    return { appointment: appt };
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: appt, error } = await supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.appointmentId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { appointment: appt };
  });
