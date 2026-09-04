import { timingSafeEqual } from "node:crypto";

// Constant-time comparison — avoids leaking secret length/content via
// early-return timing when checking cron/webhook shared secrets.
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
