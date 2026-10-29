# LinguaFlash on Vercel

Production: https://linguaflash-alpha.vercel.app/

Vercel project: `filiplindstromens-projects/linguaflash`.

LinguaFlash is a standalone app at `/`, with `/api/glosor` on the same origin. The existing `saas` Vercel project serves BrainDump and is independent of this app.

To publish changes, run these commands from the SaaS repository root:

```powershell
node scripts/package-linguaflash.mjs
npx --yes vercel@latest --cwd .deploy/linguaflash --prod --scope filiplindstromens-projects
```

If asked to sign in, run `npx --yes vercel@latest login` and approve the browser authorization. The `.deploy/linguaflash/.vercel` directory remembers the project link locally. On another computer, link the package to the existing `linguaflash` project before deploying.

The package includes only LinguaFlash, its public assets, the shared browser API-key utility, and the Glosor import function. No environment variables are required for basic practice or Glosor import. Pexels is optional and configured inside the app.

Automatic Git deployments are disabled for this standalone project: the repository-root `vercel.json` builds the entire SaaS hub, which is a different deployment. Deploy with the commands above.

Verified after deployment: homepage returns HTTP 200 with the LinguaFlash title, and the Glosor API returns the expected validation response for unsupported URLs. Local production build and all 17 tests passed.
