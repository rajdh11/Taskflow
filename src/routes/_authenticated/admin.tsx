import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FolderKanban, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Role = "admin" | "member";

function AdminPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && role && role !== "admin") navigate({ to: "/dashboard" });
  }, [role, loading, navigate]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, Role>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roleMap.get(p.id) ?? "member") as Role,
      }));
    },
  });

  const { data: projectMemberships } = useQuery({
    queryKey: ["admin-project-memberships"],
    enabled: role === "admin",
    queryFn: async () => {
      const [
        { data: projects },
        { data: members },
        { data: profiles },
      ] = await Promise.all([
        supabase.from("projects").select("id, name, owner_id").order("created_at", { ascending: false }),
        supabase.from("project_members").select("project_id, user_id"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      (profiles ?? []).forEach((p) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));

      return (projects ?? []).map((proj) => {
        const projMembers = (members ?? [])
          .filter((m) => m.project_id === proj.id)
          .map((m) => ({ id: m.user_id, ...profileMap.get(m.user_id) }));
        const owner = profileMap.get(proj.owner_id);
        return {
          ...proj,
          owner: owner ? { id: proj.owner_id, ...owner } : null,
          members: projMembers,
        };
      });
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Role }) => {
      const { error: del } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del) throw del;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "admin") return null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-muted-foreground">Manage user roles and project memberships.</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">User roles</h2>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRole.mutate({
                          userId: u.id,
                          newRole: u.role === "admin" ? "member" : "admin",
                        })
                      }
                    >
                      {u.role === "admin" ? "Demote to member" : "Promote to admin"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Project memberships</h2>
        </div>
        {projectMemberships && projectMemberships.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {projectMemberships.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {p.members.length} member{p.members.length === 1 ? "" : "s"}
                  </span>
                </div>
                {p.owner && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    Owner: <span className="font-medium text-foreground">{p.owner.full_name || p.owner.email}</span>
                  </div>
                )}
                {p.members.length > 0 ? (
                  <ul className="space-y-1.5">
                    {p.members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium">{m.full_name || "—"}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            No projects yet.
          </div>
        )}
      </section>
    </div>
  );
}
