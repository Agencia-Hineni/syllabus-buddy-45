import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";
import { joinClassByInviteCode } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function JoinClassCard() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");

  const join = useMutation({
    mutationFn: (value: string) => joinClassByInviteCode(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership"] });
      toast.success("Você entrou na turma!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="items-center text-center">
        <GraduationCap className="mb-2 size-8 text-primary" />
        <CardTitle>Entrar em uma turma</CardTitle>
        <CardDescription>
          Peça o código de convite ao líder ou vice-líder da sua turma para ver as disciplinas e
          atividades.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            join.mutate(code);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-code">Código de convite</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EX: FARMA2026"
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={join.isPending}>
            {join.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Entrar na turma
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
