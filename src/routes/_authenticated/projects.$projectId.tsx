import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetail,
});

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  due_date: z.string().optional(),
});

type Status = "todo" | "in_progress" | "done";
const COLUMNS: { key: Status; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id, profiles(id, full_name, email)")
        .eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles:assignee_id(full_name, email)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-profiles"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTask = useMutation({
    mutationFn: async (vals: z.infer<typeof taskSchema>) => {
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        title: vals.title,
        description: vals.description || null,
        assignee_id: vals.assignee_id || null,
        priority: vals.priority,
        due_date: vals.due_date || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      setTaskOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      setMemberOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const memberIds = new Set(members?.map((m) => m.user_id) ?? []);
  const availableUsers = allUsers?.filter((u) => !memberIds.has(u.id)) ?? [];
  const assignableUsers = members?.map((m: any) => m.profiles).filter(Boolean) ?? [];

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{project?.name ?? "Project"}</h1>
          {project?.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
        </div>
        {role === "admin" && (
          <div className="flex gap-2">
            <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" /> Add member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All users are already members.</p>
                ) : (
                  <ul className="divide-y">
                    {availableUsers.map((u) => (
                      <li key={u.id} className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">{u.full_name || u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        <Button size="sm" onClick={() => addMember.mutate(u.id)}>Add</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const assignee = fd.get("assignee_id") as string;
                    const parsed = taskSchema.safeParse({
                      title: fd.get("title"),
                      description: fd.get("description") || undefined,
                      assignee_id: assignee && assignee !== "none" ? assignee : null,
                      priority: fd.get("priority"),
                      due_date: (fd.get("due_date") as string) || undefined,
                    });
                    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
                    createTask.mutate(parsed.data);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Assignee</Label>
                      <Select name="assignee_id" defaultValue="none">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {assignableUsers.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select name="priority" defaultValue="medium">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due date</Label>
                    <Input id="due_date" name="due_date" type="date" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createTask.isPending}>
                      {createTask.isPending ? "Creating…" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Members</h2>
        <div className="flex flex-wrap gap-2">
          {members && members.length > 0 ? (
            members.map((m: any) => (
              <span
                key={m.user_id}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs"
              >
                {m.profiles?.full_name || m.profiles?.email}
                {role === "admin" && (
                  <button
                    onClick={() => removeMember.mutate(m.user_id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </div>
      </div>

      {/* Kanban */}
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks?.filter((t) => t.status === col.key) ?? [];
          return (
            <div key={col.key} className="rounded-xl border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{col.label}</h3>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No tasks
                  </p>
                ) : (
                  colTasks.map((t: any) => {
                    const canEdit = role === "admin" || t.assignee_id === user?.id;
                    const today = new Date().toISOString().slice(0, 10);
                    const overdue = t.due_date && t.due_date < today && t.status !== "done";
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">{t.title}</div>
                          <PriorityPill p={t.priority} />
                        </div>
                        {t.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {t.profiles?.full_name || t.profiles?.email || "Unassigned"}
                          </span>
                          {t.due_date && (
                            <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                              {t.due_date}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <div className="mt-3 flex items-center gap-2">
                            <Select
                              value={t.status}
                              onValueChange={(v) =>
                                updateStatus.mutate({ id: t.id, status: v as Status })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To do</SelectItem>
                                <SelectItem value="in_progress">In progress</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                              </SelectContent>
                            </Select>
                            {role === "admin" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteTask.mutate(t.id)}
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityPill({ p }: { p: string }) {
  const map: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-accent text-accent-foreground",
    high: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${map[p] ?? map.medium}`}>
      {p}
    </span>
  );
}
