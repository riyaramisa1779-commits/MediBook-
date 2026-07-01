import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Privileged: create a doctor account. Only callable by an existing admin.
export const createDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).max(120),
        phone: z.string().max(40).optional(),
        specialization: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin
    const { data: adminRows, error: adminErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (adminErr) throw new Error(adminErr.message);
    if (!adminRows || adminRows.length === 0) {
      throw new Error("Forbidden: admin role required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, phone: data.phone },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");

    const newUserId = created.user.id;

    // Update profile with doctor-specific fields
    await supabaseAdmin
      .from("profiles")
      .update({
        name: data.name,
        phone: data.phone ?? null,
        specialization: data.specialization ?? null,
      })
      .eq("id", newUserId);

    // Remove default "patient" role, add "doctor"
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "doctor" });
    if (roleErr) throw new Error(roleErr.message);

    return { userId: newUserId };
  });

// Bootstrap: promote the caller to admin ONLY when no admin exists yet.
// This solves the chicken-and-egg problem of creating the first admin.
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin-only: list doctors including phone (which is not readable via the Data API).
export const listDoctors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: adminRows, error: adminErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (adminErr) throw new Error(adminErr.message);
    if (!adminRows || adminRows.length === 0) {
      throw new Error("Forbidden: admin role required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "doctor");
    if (roleErr) throw new Error(roleErr.message);
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (!ids.length) return [];

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,name,phone,specialization,is_active")
      .in("id", ids);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
