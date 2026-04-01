/**
 * RevenueCat / paywall gating is controlled globally in the admin dashboard (`/admin`)
 * and stored in Postgres (`SiteSettings`). The web app reads it via `GET /api/site-config`.
 *
 * - `useSiteConfig()` — `revenueCatEnabled` flag from the server.
 * - `useRevenueCat()` — Web SDK state, paywall, entitlement (Filip Lindstrom Pro).
 */

export { useSiteConfig } from "@/components/SiteConfigProvider";
export { useRevenueCat, useRevenueCatOptional } from "@/components/RevenueCatProvider";
