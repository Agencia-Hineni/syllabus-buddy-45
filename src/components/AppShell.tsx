import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  BookOpen,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  CreditCard,
  BellRing,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery, membershipQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const baseNav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/disciplinas", label: "Disciplinas", icon: BookOpen },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/assinatura", label: "Assinatura", icon: CreditCard },
  { to: "/preferencias", label: "Preferências", icon: BellRing },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: membership } = useQuery(membershipQuery());
  const { data: isAdmin } = useQuery(isAdminQuery());

  const canManage = membership?.role === "lider" || membership?.role === "vice_lider" || isAdmin;

  const items = [
    ...baseNav,
    ...(canManage ? [{ to: "/gestao", label: "Gestão", icon: Settings2 } as const] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck } as const] : []),
  ];

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/painel" className="font-display text-lg font-semibold text-sidebar-foreground">
            Agenda<span className="text-primary">.</span>
          </Link>
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <p className="px-5 pb-4 text-xs text-muted-foreground">
          {membership?.classes?.courses?.name ?? "Sem turma"}
          {membership?.classes?.semester ? ` · ${membership.classes.semester}` : ""}
        </p>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold">Agenda</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
