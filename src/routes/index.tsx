import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Stethoscope, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </span>
            MediBook
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="max-w-2xl">
          <h1 className="text-5xl font-semibold tracking-tight text-foreground">
            Book care that fits your schedule.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Real-time slot availability, conflict-safe booking, and role-based access for patients,
            doctors, and admins — built for reliability.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create patient account
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<CalendarClock className="h-5 w-5" />}
            title="Real-time slots"
            body="Availability computed from each doctor's weekly schedule, breaks, and leaves."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No double booking"
            body="Composite unique constraints in the database guarantee scheduling integrity."
          />
          <FeatureCard
            icon={<Stethoscope className="h-5 w-5" />}
            title="Role-based"
            body="Separate dashboards for patients, doctors, and administrators."
          />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-medium text-card-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
