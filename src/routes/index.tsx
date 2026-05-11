import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users, LayoutDashboard, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-hero)" }} />
            TaskFlow
          </Link>
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Ship work as a team,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              without the chaos
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Create projects, assign tasks, and track progress with role-based access for admins and
            members.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="shadow-[var(--shadow-glow)]">
                Get started
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: LayoutDashboard, title: "Project workspace", desc: "Organize tasks by project with clear ownership." },
              { icon: Users, title: "Team management", desc: "Assign members and track who's doing what." },
              { icon: ShieldCheck, title: "Role-based access", desc: "Admins manage; members focus on their tasks." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border bg-card p-8 shadow-[var(--shadow-soft)]">
            <h2 className="text-2xl font-semibold">Built-in workflows</h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                "Authentication with email & password",
                "Admin/Member roles enforced server-side",
                "Track task status: todo, in progress, done",
                "Overdue task tracking on the dashboard",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TaskFlow
      </footer>
    </div>
  );
}
