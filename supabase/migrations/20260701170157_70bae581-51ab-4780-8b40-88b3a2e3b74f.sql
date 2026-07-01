
-- 1. doctor_schedules: require doctor role on UPDATE/DELETE
DROP POLICY IF EXISTS "doctor updates own schedule" ON public.doctor_schedules;
DROP POLICY IF EXISTS "doctor deletes own schedule" ON public.doctor_schedules;

CREATE POLICY "doctor updates own schedule" ON public.doctor_schedules
  FOR UPDATE TO authenticated
  USING (doctor_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'::app_role))
  WITH CHECK (doctor_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'::app_role));

CREATE POLICY "doctor deletes own schedule" ON public.doctor_schedules
  FOR DELETE TO authenticated
  USING (doctor_id = auth.uid() AND public.has_role(auth.uid(), 'doctor'::app_role));

-- 2. appointments: prevent patients from escalating sensitive fields
CREATE OR REPLACE FUNCTION public.enforce_appointment_update_perms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the assigned doctor may change anything
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'doctor'::app_role) AND NEW.doctor_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Patient path: forbid changes to sensitive fields
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Not allowed to change payment_status';
  END IF;
  IF NEW.emergency_flag IS DISTINCT FROM OLD.emergency_flag THEN
    RAISE EXCEPTION 'Not allowed to change emergency_flag';
  END IF;
  IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    RAISE EXCEPTION 'Not allowed to change scheduling fields';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'cancelled'::appointment_status THEN
    RAISE EXCEPTION 'Patients may only cancel their appointment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_enforce_update_perms ON public.appointments;
CREATE TRIGGER appointments_enforce_update_perms
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_update_perms();

-- 3. profiles: revoke phone column read from all authenticated users
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, name, specialization, bio, profile_photo, is_active, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Owner can retrieve their own phone via helper
CREATE OR REPLACE FUNCTION public.get_own_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.profiles WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_own_phone() TO authenticated;
