/**
 * RevenueCat / paywall gating is controlled globally in the admin dashboard (`/admin`)
 * and stored in Postgres (`SiteSettings`). The web app reads it via `GET /api/site-config`.
 *
 * In React, use `useSiteConfig()` from `@/components/SiteConfigProvider` (`revenueCatEnabled`).
 */

export { useSiteConfig } from "@/components/SiteConfigProvider";
