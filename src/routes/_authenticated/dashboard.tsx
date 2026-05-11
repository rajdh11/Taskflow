import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, role } = useAuth();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["dashboard-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id, assignee_id, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projectCount } = useQuery({
    queryKey: ["project-count"],
    queryFn: async () => {
      const { count } = await supabase.from("projects").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const todo = tasks?.filter((t) => t.status === "todo").length ?? 0;
  const inProgress = tasks?.filter((t) => t.status === "in_progress").length ?? 0;
  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const overdue =
    tasks?.filter((t) => t.due_date && t.due_date < today && t.status !== "done").length ?? 0;

  const myTasks = tasks?.filter((t) => t.assignee_id === user?.id) ?? [];

  const stats = [
    { label: "To do", value: todo, icon: ListTodo, color: "text-muted-foreground" },
    { label: "In progress", value: inProgress, icon: Clock, color: "text-primary" },
    { label: "Done", value: done, icon: CheckCircle2, color: "text-[oklch(var(--success))]" },
    { label: "Overdue", value: overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. You have{" "}
          <span className="font-medium text-foreground">{projectCount ?? 0}</span> project
          {projectCount === 1 ? "" : "s"} accessible.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]"
            style={{ background: "var(--gradient-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My tasks</h2>
          <span className="text-xs text-muted-foreground capitalize">Role: {role}</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : myTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned to you yet.</p>
        ) : (
          <ul className="divide-y">
            {myTasks.slice(0, 8).map((t) => {
              const isOverdue = t.due_date && t.due_date < today && t.status !== "done";
              return (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: t.project_id }}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {(t.projects as any)?.name ?? "Project"}
                      {t.due_date && (
                        <span className={isOverdue ? "ml-2 text-destructive" : "ml-2"}>
                          • due {t.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={t.status as string} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    todo: { label: "To do", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "In progress", cls: "bg-accent text-accent-foreground" },
    done: { label: "Done", cls: "bg-primary/10 text-primary" },
  };
  const { label, cls } = map[status] ?? map.todo;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
