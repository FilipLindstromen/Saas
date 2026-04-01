import { ErrorCode, PurchasesError } from "@revenuecat/purchases-js";

export function isUserCancelledPurchasesError(e: unknown): boolean {
  return e instanceof PurchasesError && e.errorCode === ErrorCode.UserCancelledError;
}

/** User-facing message; returns null if user cancelled (caller should stay silent). */
export function purchasesErrorMessage(e: unknown): string | null {
  if (isUserCancelledPurchasesError(e)) return null;
  if (e instanceof PurchasesError) return e.message || "Purchase error";
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
