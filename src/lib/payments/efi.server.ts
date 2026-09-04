import https from "node:https";
import { timingSafeEqualStr } from "@/lib/security.server";
import {
  PaymentsNotConfiguredError,
  type ChargeStatus,
  type ParsedWebhookEvent,
  type PaymentsProvider,
  type PixCharge,
  type PixChargeInput,
} from "./types";

/**
 * Adaptador Pix via Efí (Gerencianet) — https://dev.efipay.com.br/docs/api-pix
 *
 * Requer, via variáveis de ambiente (nunca commitadas):
 *   EFI_CLIENT_ID, EFI_CLIENT_SECRET  — credenciais OAuth2 (Basic Auth, client_credentials)
 *   EFI_CERT_BASE64                   — certificado .p12 da conta Efí, em base64
 *   EFI_CERT_PASSPHRASE               — senha do certificado (se houver)
 *   EFI_PIX_KEY                       — chave Pix cadastrada na conta que recebe os pagamentos
 *   EFI_WEBHOOK_SECRET                — segredo aleatório embutido na URL do webhook cadastrada na Efí
 *   EFI_SANDBOX                       — "true" para usar o ambiente de homologação
 *
 * A Efí não assina o payload do webhook com HMAC; a prática recomendada é
 * cadastrar uma URL de webhook com um segredo imprevisível no path/query e
 * validar esse segredo aqui — é o que `verifyWebhookSignature` faz.
 *
 * IMPORTANTE: os endpoints de criação de cobrança (`PUT /v2/cob/:txid`) e de
 * QR code (`GET /v2/loc/:id/qrcode`) foram implementados a partir da
 * documentação pública da Efí, mas nunca foram exercitados contra uma conta
 * real por não haver credenciais disponíveis neste ambiente. Antes de usar em
 * produção, valide uma cobrança de teste em homologação e confira o payload
 * de resposta contra a documentação atual.
 */

function requiredEnv(): {
  clientId: string;
  clientSecret: string;
  certBase64: string;
  pixKey: string;
} | null {
  const clientId = process.env["EFI_CLIENT_ID"];
  const clientSecret = process.env["EFI_CLIENT_SECRET"];
  const certBase64 = process.env["EFI_CERT_BASE64"];
  const pixKey = process.env["EFI_PIX_KEY"];
  if (!clientId || !clientSecret || !certBase64 || !pixKey) return null;
  return { clientId, clientSecret, certBase64, pixKey };
}

function apiHost(): string {
  return process.env["EFI_SANDBOX"] === "true"
    ? "pix-h.api.efipay.com.br"
    : "pix.api.efipay.com.br";
}

function httpsJson<T>(options: https.RequestOptions, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Efí ${options.method} ${options.path} → ${res.statusCode}: ${raw}`));
            return;
          }
          resolve(parsed as T);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getAccessToken(env: NonNullable<ReturnType<typeof requiredEnv>>): Promise<string> {
  const auth = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const pfx = Buffer.from(env.certBase64, "base64");
  const res = await httpsJson<{ access_token: string }>(
    {
      host: apiHost(),
      path: "/oauth/token",
      method: "POST",
      pfx,
      passphrase: process.env["EFI_CERT_PASSPHRASE"] || undefined,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    },
    { grant_type: "client_credentials" },
  );
  return res.access_token;
}

export const efiPixProvider: PaymentsProvider = {
  name: "efi",

  async createPixCharge(input: PixChargeInput): Promise<PixCharge> {
    const env = requiredEnv();
    if (!env)
      throw new PaymentsNotConfiguredError("efi", [
        "EFI_CLIENT_ID",
        "EFI_CLIENT_SECRET",
        "EFI_CERT_BASE64",
        "EFI_PIX_KEY",
      ]);

    const token = await getAccessToken(env);
    const pfx = Buffer.from(env.certBase64, "base64");
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const cob = await httpsJson<{
      txid: string;
      loc: { id: number };
      calendario: { expiracao: number; criacao: string };
    }>(
      {
        host: apiHost(),
        path: `/v2/cob/${input.paymentId}`,
        method: "PUT",
        pfx,
        passphrase: process.env["EFI_CERT_PASSPHRASE"] || undefined,
        headers: authHeaders,
      },
      {
        calendario: { expiracao: input.expiresInSeconds ?? 86400 },
        devedor: input.payerCpf ? { cpf: input.payerCpf, nome: input.payerName } : undefined,
        valor: { original: (input.amountCents / 100).toFixed(2) },
        chave: env.pixKey,
        solicitacaoPagador: "Mensalidade Agenda Acadêmica",
      },
    );

    const qr = await httpsJson<{ qrcode: string; imagemQrcode: string }>({
      host: apiHost(),
      path: `/v2/loc/${cob.loc.id}/qrcode`,
      method: "GET",
      pfx,
      passphrase: process.env["EFI_CERT_PASSPHRASE"] || undefined,
      headers: authHeaders,
    });

    const expiresAt = new Date(
      new Date(cob.calendario.criacao).getTime() + cob.calendario.expiracao * 1000,
    ).toISOString();

    return {
      providerChargeId: cob.txid,
      qrCodeImageBase64: qr.imagemQrcode,
      copyPaste: qr.qrcode,
      expiresAt,
    };
  },

  async fetchChargeStatus(providerChargeId: string): Promise<ChargeStatus> {
    const env = requiredEnv();
    if (!env)
      throw new PaymentsNotConfiguredError("efi", [
        "EFI_CLIENT_ID",
        "EFI_CLIENT_SECRET",
        "EFI_CERT_BASE64",
        "EFI_PIX_KEY",
      ]);

    const token = await getAccessToken(env);
    const pfx = Buffer.from(env.certBase64, "base64");
    const cob = await httpsJson<{ status: string }>({
      host: apiHost(),
      path: `/v2/cob/${providerChargeId}`,
      method: "GET",
      pfx,
      passphrase: process.env["EFI_CERT_PASSPHRASE"] || undefined,
      headers: { Authorization: `Bearer ${token}` },
    });

    switch (cob.status) {
      case "CONCLUIDA":
        return "paid";
      case "REMOVIDA_PELO_USUARIO_RECEBEDOR":
      case "REMOVIDA_PELO_PSP":
        return "canceled";
      case "ATIVA":
        return "pending";
      default:
        return "pending";
    }
  },

  async verifyWebhookSignature(request: Request): Promise<boolean> {
    const expected = process.env["EFI_WEBHOOK_SECRET"];
    if (!expected) return false;
    // Preferimos o header, mas a Efí só permite configurar uma URL de
    // webhook (sem headers customizados) — por isso o segredo também pode
    // vir na query string. Sem HMAC do lado da Efí, este segredo é a única
    // defesa; trate a URL configurada como confidencial.
    const url = new URL(request.url);
    const provided = request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
    if (!provided) return false;
    return timingSafeEqualStr(provided, expected);
  },

  parseWebhookEvent(payload: unknown): ParsedWebhookEvent | null {
    if (!payload || typeof payload !== "object" || !("pix" in payload)) return null;
    const pixArray = (payload as { pix?: unknown }).pix;
    if (!Array.isArray(pixArray) || pixArray.length === 0) return null;
    const first = pixArray[0] as { txid?: string; endToEndId?: string };
    if (!first.txid || !first.endToEndId) return null;
    return {
      eventId: first.endToEndId,
      eventType: "pix.received",
      providerChargeId: first.txid,
    };
  },
};
