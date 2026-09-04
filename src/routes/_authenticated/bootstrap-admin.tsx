import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/bootstrap-admin")({
  component: BootstrapAdmin,
});

function BootstrapAdmin() {
  const [secret, setSecret] = useState("");
  const [done, setDone] = useState(false);

  const bootstrap = useMutation({
    mutationFn: async (value: string) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ secret: value }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          res.status === 501
            ? "ADMIN_BOOTSTRAP_SECRET não configurado no servidor."
            : text || "Falha ao promover a admin",
        );
      }
    },
    onSuccess: () => {
      setDone(true);
      toast.success("Pronto! Você agora é administrador.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mb-2 size-8 text-primary" />
          <CardTitle>Tornar-se administrador</CardTitle>
          <CardDescription>
            Uso único: informe o segredo configurado em <code>ADMIN_BOOTSTRAP_SECRET</code> no
            servidor para conceder o papel de administrador à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-center text-sm text-muted-foreground">
              Papel de administrador concedido. Acesse <strong>Admin</strong> no menu (pode ser
              necessário recarregar a página).
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                bootstrap.mutate(secret);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="bootstrap-secret">Segredo</Label>
                <Input
                  id="bootstrap-secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <Button type="submit" className="w-full" disabled={bootstrap.isPending}>
                {bootstrap.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Confirmar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
