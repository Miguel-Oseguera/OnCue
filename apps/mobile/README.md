# OnCue authentication

The app uses the self-managed Better Auth server in `apps/backend`.

Start the backend first, then run `pnpm --filter mobile start` from the workspace
root. In development, the API URL is inferred from Expo's host on port 3000 for
native devices, or `http://localhost:3000` on web. Keep your phone and computer
on the same network. An Expo tunnel does not tunnel the backend; set
`EXPO_PUBLIC_API_URL` to a separately reachable API in that case.

For a production export, set `EXPO_PUBLIC_API_URL` to your HTTPS backend URL.
See `.env.example`. Never include database credentials or the auth secret in this
app. If using Expo web on a different origin, add that origin to the backend's
`AUTH_TRUSTED_ORIGINS` setting.

Sign up with a name, email, and password, or sign in to an existing account.
Signed-in users can access the dashboard, tasks, and teams.
Expo Router protects those routes. The backend independently validates sessions.

Native cookies and the cached session use `expo-secure-store`. Web uses browser
cookies. `src/lib/api.ts` forwards native cookies to protected routes. The
mobile service validates API responses before displaying them. After installing native modules, rebuild
your development client before running it on a device.

Run `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` to check
the mobile app. Mobile typechecking does not require generated backend files.

## Connected workspace

The signed-in screens use `GET /api/dashboard`. Creating tasks uses
`POST /api/tasks`; status and assignment changes use `PATCH /api/tasks/:taskId`.
AI reports come from each task's `aiActivity` array and share the dashboard
snapshot. The app never calls `/api/ai` or an AI provider. Pull to refresh the
dashboard or tasks; Teams also has a refresh button.

The adapter accepts optional `unlinkedAiReports` on the dashboard and optional
`relatedEvidence` on tasks or reports. When absent, the UI states that unlinked
reports or evidence are unavailable; it does not substitute mock records.
PATCH responses that omit reports retain the reports already loaded in memory.

Run the dependency-free service checks from `apps/mobile` with:
`node --experimental-strip-types --test src/features/oncue/service.test.mjs src/features/oncue/api-service.test.mjs`.

The mock service remains available for isolated tests through provider injection;
the app uses the live adapter by default and never falls back to fixtures.

## Expo starter reference

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Meta glasses connection (iPhone development build)

The dashboard's **Connect glasses** card registers OnCue through Meta AI. Pair
and update the glasses in Meta AI, then enable Developer Mode there. This build
uses DAT 1.0.0 in Developer Mode (`MetaAppID: 0`); production distribution needs
your registered Meta project configuration.

After rebuilding and installing the native app on a physical iPhone, tap
**Connect glasses**, approve the connection in Meta AI, and return to OnCue.
Allow Bluetooth when iOS asks. Registration approval and the actual glasses
Bluetooth link are separate states. The dashboard shows device link and battery
updates and refreshes status when you return from Meta AI.

Registration itself starts no sensor session. Open **Hands-free capture** from
the dashboard and explicitly start listening to enable glasses Speech and Photo.
Simulator, web, and older app builds explain that an updated iPhone build is needed.

The local Expo module owns SDK initialization and handles Meta callbacks through
an AppDelegate subscriber (including Expo's scene URL forwarding). The existing
`mobile` URL scheme and signing settings are unchanged. Non-Meta links, including
Better Auth callbacks, are not forwarded to DAT.

Native changes require `pod install` in `apps/mobile/ios` and rebuilding the
existing Xcode workspace. Expo's `app.json` holds the required `MWDAT` and Bluetooth
Info.plist settings so they survive native regeneration. A Metro refresh alone
cannot update the native bridge. Device approval must be tested on real hardware.

The `with-meta-dat` Expo config plugin embeds and signs `MWDATCore.framework`,
`MWDATCamera.framework`, and `MWDATSpeech.framework`
from the existing Swift package build product. Linking the SDK through a static
Expo pod alone is insufficient: the app otherwise exits before startup with a
missing-framework error. Keep the plugin when regenerating the iOS project.


### Hands-free task photos (development/beta)

1. Connect your glasses, then open **Hands-free capture** on the dashboard.
2. Tap **Start hands-free mode** and approve camera and microphone access in Meta AI.
3. Wait for **Listening for OnCue**, then say **“OnCue, capture this task.”**
4. Review the photo in the capture tray. Repeat the phrase for another photo.
5. Tap **Stop listening** here or on the dashboard when finished.

DAT 1.0 Speech and standalone Photo are experimental and must be enabled for the
app in Wearables Developer Center; they are not available for production release.
The native controller owns a sustained session independently of the current React
screen. Pauses wait for SDK resume; terminal sessions require explicit restart.
Signing out or destroying the JS app context stops the session. Listening is never
restored automatically after launch. Locked/background behavior needs real-device
verification; Bluetooth background mode alone does not establish that guarantee.
No phone microphone fallback, video streaming, or artificial audio keepalive is used.

Only complete, final capture commands are acted on. Case, punctuation and “On cue” /
“On queue” recognition variants are accepted. Other speech is discarded. A capture
in progress and a short cooldown prevent duplicate photos. Startup/capture timeouts
surface errors; session, speech and photo errors are shown in the app.

Photos are normalized to JPEG (up to 2560px), saved atomically under the app's
Documents/OnCueCaptures folder and indexed in captures.json. They survive app
restarts and app updates. Uninstalling the app removes them. They are not added to
Photos, uploaded, sent to AI, or automatically converted into tasks. Preview URIs
are reconstructed from file names on launch so container path changes are safe.

Native command matcher check (run in apps/mobile):

```sh
swiftc modules/oncue-wearables/ios/OncueCaptureCommand.swift modules/oncue-wearables/tests/command.test.swift -o /private/tmp/oncue-command-tests
/private/tmp/oncue-command-tests
```

On hardware, verify permission denial/retry, repeated voice captures, button capture,
leaving the capture screen, stop while starting, disconnect/reconnect, persistence
across relaunch, and locked-phone capture. No live glasses capture is verified by
the unit checks or native build alone.
