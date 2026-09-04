import https from "node:https";
import type { PaymentProvider, PixCharge, WebhookPayload } from "./types";
import { PaymentProviderError } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new PaymentProviderError(`Missing ${name}`, "missing_credentials");
  return value;
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

async function getAccessToken(pfx: Buffer, passphrase: string | undefined): Promise<string> {
  const clientId = requireEnv("EFI_CLIENT_ID");
  const clientSecret = requireEnv("EFI_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await httpsJson<{ access_token: string }>(
    {
      host: apiHost(),
      path: "/oauth/token",
      method: "POST",
      pfx,
      passphrase,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    },
    { grant_type: "client_credentials" },
  );
  return res.access_token;
}

const EFI_STATUS_MAP: Record<string, WebhookPayload["status"]> = {
  CONCLUIDA: "paid",
  REMOVIDA_PELO_USUARIO_RECEBEDOR: "canceled",
  REMOVIDA_PELO_PSP: "canceled",
  ATIVA: "pending",
};

const PIX_EXPIRATION_SECONDS = 24 * 60 * 60;

interface EfiCobResponse {
  txid: string;
  loc: { id: number };
}

interface EfiLocQrCodeResponse {
  qrcode: string;
  imagemQrcode: string;
}

async function createCob(
  pfx: Buffer,
  passphrase: string | undefined,
  token: string,
  amountCents: number,
  description: string,
): Promise<EfiCobResponse> {
  const chave = requireEnv("EFI_PIX_KEY");
  return httpsJson<EfiCobResponse>(
    {
      host: apiHost(),
      path: "/v2/cob",
      method: "POST",
      pfx,
      passphrase,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    },
    {
      calendario: { expiracao: PIX_EXPIRATION_SECONDS },
      valor: { original: (amountCents / 100).toFixed(2) },
      chave,
      solicitacaoPagador: description.slice(0, 140),
    },
  );
}

async function getLocQrCode(
  pfx: Buffer,
  passphrase: string | undefined,
  token: string,
  locId: number,
): Promise<EfiLocQrCodeResponse> {
  return httpsJson<EfiLocQrCodeResponse>({
    host: apiHost(),
    path: `/v2/loc/${locId}/qrcode`,
    method: "GET",
    pfx,
    passphrase,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Efí / Gerencianet provider for Brazilian Pix.
 *
 * Both `createPixCharge` and `fetchChargeStatus` make real, authenticated
 * calls (OAuth2 + mTLS) to Efí's API — the webhook re-checks against
 * `fetchChargeStatus` before trusting any "paid" status.
 */
export const efiProvider: PaymentProvider = {
  name: "efi",

  async createPixCharge({ amountCents, description }) {
    const certBase64 = requireEnv("EFI_CERTIFICATE_BASE64");
    const pfx = Buffer.from(certBase64, "base64");
    const passphrase = process.env["EFI_CERT_PASSPHRASE"] || undefined;

    const token = await getAccessToken(pfx, passphrase);
    const cob = await createCob(pfx, passphrase, token, amountCents, description);
    const { qrcode, imagemQrcode } = await getLocQrCode(pfx, passphrase, token, cob.loc.id);

    return {
      txid: cob.txid,
      qrCode: imagemQrcode,
      copiaCola: qrcode,
      expiresAt: new Date(Date.now() + PIX_EXPIRATION_SECONDS * 1000).toISOString(),
    };
  },

  parseWebhook(body, secret, headers) {
    const provided = headers.get("x-webhook-secret") ?? "";
    if (!secret || provided !== secret) {
      throw new PaymentProviderError("Invalid webhook signature", "invalid_signature");
    }

    const raw = typeof body === "string" ? JSON.parse(body) : body;
    if (!raw || typeof raw !== "object") return null;

    const record = raw as Record<string, unknown>;
    const eventId = String(record["id"] ?? Date.now());
    const providerChargeId = String(record["txid"] ?? "");
    const statusMap: Record<string, WebhookPayload["status"]> = {
      RECEBIDO: "paid",
      ATRASADO: "expired",
      CANCELADO: "canceled",
      DEVOLVIDO: "refunded",
      EM_ABERTO: "pending",
    };

    const status = statusMap[String(record["status"] ?? "EM_ABERTO")] ?? "pending";
    const amountCents = Math.round(Number(record["valor"] ?? 0) * 100);
    const paidAt: string | undefined = status === "paid" ? new Date().toISOString() : undefined;

    return {
      eventId,
      status,
      providerChargeId,
      amountCents,
      paidAt,
      raw: record,
    };
  },

  async fetchChargeStatus(providerChargeId) {
    const certBase64 = requireEnv("EFI_CERTIFICATE_BASE64");
    const pfx = Buffer.from(certBase64, "base64");
    const passphrase = process.env["EFI_CERT_PASSPHRASE"] || undefined;

    const token = await getAccessToken(pfx, passphrase);
    const cob = await httpsJson<{ status: string }>({
      host: apiHost(),
      path: `/v2/cob/${providerChargeId}`,
      method: "GET",
      pfx,
      passphrase,
      headers: { Authorization: `Bearer ${token}` },
    });

    return EFI_STATUS_MAP[cob.status] ?? "pending";
  },
};
