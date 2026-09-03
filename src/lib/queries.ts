import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
export type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
export type ClassMember = Database["public"]["Tables"]["class_members"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AssignmentType = Database["public"]["Enums"]["assignment_type"];
export type ClassRole = Database["public"]["Enums"]["class_role"];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export type Membership = ClassMember & {
  classes: (ClassRow & { courses: { name: string; institutions: { name: string } | null } | null }) | null;
};

export const membershipQuery = () => ({
  queryKey: ["membership"],
  queryFn: async (): Promise<Membership | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;
    const res = await supabase
      .from("class_members")
      .select("*, classes(*, courses(name, institutions(name)))")
      .eq("user_id", uid)
      .eq("status", "ativo")
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data as Membership | null;
  },
});

export const isAdminQuery = () => ({
  queryKey: ["is-admin"],
  queryFn: async (): Promise<boolean> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return false;
    const res = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin");
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []).length > 0;
  },
});

export const subjectsQuery = (classId: string | undefined) => ({
  queryKey: ["subjects", classId],
  enabled: Boolean(classId),
  queryFn: async (): Promise<Subject[]> =>
    unwrap(await supabase.from("subjects").select("*").eq("class_id", classId!).order("name")),
});

export type AssignmentWithSubject = Assignment & {
  subjects: Pick<Subject, "id" | "name" | "color"> | null;
};

export const assignmentsQuery = (classId: string | undefined) => ({
  queryKey: ["assignments", classId],
  enabled: Boolean(classId),
  queryFn: async (): Promise<AssignmentWithSubject[]> =>
    unwrap(
      await supabase
        .from("assignments")
        .select("*, subjects(id, name, color)")
        .eq("class_id", classId!)
        .order("due_at"),
    ) as AssignmentWithSubject[],
});

export const completionsQuery = () => ({
  queryKey: ["completions"],
  queryFn: async (): Promise<string[]> => {
    const rows = unwrap(await supabase.from("assignment_completions").select("assignment_id"));
    return (rows ?? []).map((r) => r.assignment_id);
  },
});

export type MemberWithProfile = ClassMember & {
  profile: Pick<Profile, "id" | "full_name" | "email"> | null;
  subscription: Subscription | null;
};

export const membersQuery = (classId: string | undefined) => ({
  queryKey: ["members", classId],
  enabled: Boolean(classId),
  queryFn: async (): Promise<MemberWithProfile[]> => {
    const members = unwrap(
      await supabase.from("class_members").select("*").eq("class_id", classId!).order("joined_at"),
    );
    const ids = members.map((m) => m.user_id);
    if (ids.length === 0) return [];
    const profiles = unwrap(
      await supabase.from("profiles").select("id, full_name, email").in("id", ids),
    );
    const subs = unwrap(
      await supabase.from("subscriptions").select("*").eq("class_id", classId!).in("user_id", ids),
    );
    return members.map((m) => ({
      ...m,
      profile: profiles.find((p) => p.id === m.user_id) ?? null,
      subscription: subs.find((s) => s.user_id === m.user_id) ?? null,
    }));
  },
});

export const subscriptionQuery = () => ({
  queryKey: ["subscription"],
  queryFn: async (): Promise<Subscription | null> => {
    const res = await supabase.from("subscriptions").select("*").limit(1).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  },
});

export const paymentsQuery = () => ({
  queryKey: ["payments"],
  queryFn: async (): Promise<Payment[]> =>
    unwrap(await supabase.from("payments").select("*").order("created_at", { ascending: false })),
});

export async function logAudit(input: {
  classId: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
}) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_log").insert({
    actor_id: data.user.id,
    class_id: input.classId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    summary: input.summary,
  });
}
