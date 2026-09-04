import { timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em tempo constante, para não vazar informação por
 * timing (early-return de `===` revela quantos caracteres iniciais batem).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Ainda gasta o tempo de uma comparação, só não contra o buffer certo —
    // evita que o caminho "tamanho diferente" seja visivelmente mais rápido.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
