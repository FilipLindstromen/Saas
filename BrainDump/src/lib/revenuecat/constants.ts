/**
 * RevenueCat dashboard setup (Web Billing / Filip Lindstrom):
 *
 * 1. Entitlement: create entitlement with identifier matching
 *    `NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID` (default: filip_lindstrom_pro).
 *    Display name in dashboard can be "Filip Lindstrom Pro".
 * 2. Products: Stripe/Web Billing products with identifiers e.g. monthly, yearly, lifetime
 *    (or your store ids — must match package → product mapping in RevenueCat).
 * 3. Offering: default offering with three packages whose package identifiers are
 *    typically $rc_monthly, $rc_annual, $rc_lifetime or custom ids monthly / yearly / lifetime.
 * 4. Paywall: attach a RevenueCat Paywall to that offering in the dashboard.
 *
 * Public API key: use the Web Billing **public** key from RevenueCat (test_… for sandbox).
 */

export const DEFAULT_ENTITLEMENT_ID = "filip_lindstrom_pro";

export function getRevenueCatPublicApiKey(): string {
  return (process.env.NEXT_PUBLIC_REVENUECAT_API_KEY ?? "").trim();
}

export function getRevenueCatEntitlementId(): string {
  const id = (process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "").trim();
  return id || DEFAULT_ENTITLEMENT_ID;
}
