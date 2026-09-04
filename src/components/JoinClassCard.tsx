import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { joinClassByInviteCode } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinClassCard() {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();
  const joinClass = useServerFn(joinClassByInviteCode);

  const mutation = useMutation({
    mutationFn: () => joinClass({ data: { inviteCode: code } }),
    onSuccess: ({ className }) => {
      toast.success(`Você entrou na turma ${className}.`);
      queryClient.invalidateQueries({ queryKey: ["membership"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível entrar na turma."),
  });

  return (
    <form
      className="flex w-full max-w-xs flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) mutation.mutate();
      }}
    >
      <Input
        placeholder="Código de convite"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="text-center uppercase tracking-widest sm:text-left"
        maxLength={16}
        required
      />
      <Button type="submit" disabled={mutation.isPending || !code.trim()}>
        {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
