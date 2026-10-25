# OnCue voice-launch link host

This folder is a static Vercel deployment. No backend, database credentials, API
keys, or user data belong here. It only hosts the public Apple app association.

## Existing Vercel website

Copy public/.well-known/apple-app-site-association into the existing project's
public/.well-known folder. Merge the Content-Type header for that path into the
existing Vercel configuration; preserve existing routes and settings. Serve an
/oncue/launch page as the web fallback.

## Standalone deployment

Select this folder as the Vercel project root, framework Other, output directory
public, no build command. The supplied vercel.json handles the association header
and /oncue/* fallback. Use the stable public production .vercel.app domain, not a
protected preview deployment.

Required public endpoint:
https://YOUR-PROJECT.vercel.app/.well-known/apple-app-site-association

It must return HTTP 200, application/json, no authentication, no redirects, and
exactly the supplied JSON (the association filename has no .json extension).

Planned app launch URL:
https://YOUR-PROJECT.vercel.app/oncue/launch

Send the actual production URL back before configuring Meta or the mobile app.
The mobile app must be rebuilt with the matching applinks associated domain and
must handle the HTTPS Meta callback. The current local provision does not include
Associated Domains. Hosting this file alone does not enable voice launch.

The app ID in the file is the currently signed team's ID plus bundle ID:
5WZ2SK9A54.com.oncue.sierra.dev
If the signing team changes, update the file to the actual new team prefix; do not
change it speculatively. The existing mobile:// scheme stays for current auth and
Developer Mode registration; it is not a verified universal link.

References:
https://developer.apple.com/documentation/xcode/supporting-associated-domains
https://wearables.developer.meta.com/docs/develop/dat/voice-invocations/
