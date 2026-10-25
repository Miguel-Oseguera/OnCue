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
3. Wait for **Listening for OnCue**, then say **“OnCue, capture this task. The projector in room 204 is broken.”**
4. Pause for three seconds; the app sends the photo and description to backend AI. Review delivery and the resulting tasks in the app.
5. Tap **Stop listening** here or on the dashboard when finished.

DAT 1.0 Speech and standalone Photo are experimental and must be enabled for the
app in Wearables Developer Center; they are not available for production release.
The native controller owns a sustained session independently of the current React
screen. Pauses wait for SDK resume; terminal sessions require explicit restart.
Signing out or destroying the JS app context stops the session. Listening is never
restored automatically after launch. Locked/background behavior needs real-device
verification; Bluetooth background mode alone does not establish that guarantee.
No phone microphone fallback, video streaming, or artificial audio keepalive is used.

Final capture commands must begin with the capture phrase; the following text becomes the task description. Case, punctuation and “On cue” /
“On queue” recognition variants are accepted. Other speech is discarded. A capture
in progress and a short cooldown prevent duplicate photos. Startup/capture timeouts
surface errors; session, speech and photo errors are shown in the app.

Photos are normalized to JPEG (up to 2560px), saved atomically under the app's
Documents/OnCueCaptures folder and indexed in captures.json with their description,
account owner and delivery state. They survive app restarts and app updates.
Uninstalling removes them. They are not added to Photos. Preview URIs are
reconstructed from file names on launch so container path changes are safe.

Native command matcher check (run in apps/mobile):

```sh
swiftc modules/oncue-wearables/ios/OncueCaptureCommand.swift modules/oncue-wearables/tests/command.test.swift -o /private/tmp/oncue-command-tests
/private/tmp/oncue-command-tests
```

On hardware, verify permission denial/retry, repeated voice captures, button capture,
leaving the capture screen, stop while starting, disconnect/reconnect, persistence
across relaunch, and locked-phone capture. No live glasses capture is verified by
the unit checks or native build alone.


### Voice start and stop

With a configured Meta integration, say **“Hey Meta, start OnCue”** to launch or
foreground OnCue and start hands-free mode. Say **“OnCue, stop listening”** to stop
the sensor session, including during photo capture or the capture cooldown. Once
stopped, custom OnCue speech cannot restart itself; use the Meta launch command or
the Start button. Stop never starts listening again automatically.

The native invocation stream is initialized at app launch and follows the connected
glasses independently of sensor sessions. Every received LaunchApp is acknowledged
once. Cold launch waits up to 15 seconds for the existing signed-in session to be
restored; signed-out launches fail without starting sensors. The authenticated UI
opens the capture screen for each new invocation. An accepted start response means
session startup was requested; the screen reports actual Speech readiness/errors.
The stream uses Meta's invocation channel, not a continuously active OnCue mic.

**Required Meta-side setup (not supplied by the local code):**

- In Wearables Developer Center, add the iOS mobile app bundle identifier
  `com.oncue.sierra.dev` and set its spoken app name to **OnCue**.
- Save the configuration, then create a **new integration version**. The DAT 1.0
  guide says this includes Voice Invocation permission; there is no separate toggle.
- Make the configured development/beta integration available to your testing account
  and finish registration/permission approval in Meta AI. The current local build
  still uses Developer Mode identifiers; do not assume its `MetaAppID: 0` creates
  a routable voice app. Use verified project configuration when required.

Reference: https://wearables.developer.meta.com/docs/develop/dat/voice-invocations/

Hardware test: start by voice while OnCue is open, then while backgrounded/cold;
confirm the capture page opens and reaches Listening. Capture a photo, stop by
voice, and confirm another capture phrase does nothing. Start through Meta again.
Also test stop during transfer, handoff/removal, denied permissions, and signed-out
launch. SDK build and command tests do not verify Meta's app-name routing.


### Photo + spoken description → backend AI

Say **“OnCue, capture this task. The projector in room 204 is broken.”**
A description in the same final utterance is extracted without the command prefix.
If speech recognition splits it into segments, OnCue accepts following description
segments until a three-second pause. A bare capture command waits up to twenty seconds
for a description; a report window lasts at most 60 seconds. Stop remains a complete
utterance and is never appended to a description. Speech outside this window is
ignored. Only one capture/description bundle is active at once.

The saved photo and finalized description are paired before the frontend queues a
request. New described reports are sent automatically while signed in; missing
text stays local with an editable description field. Legacy photos remain local.
Each report retains the account that captured it; a different account cannot
silently send it. Leaving the capture screen does not unmount the app-level sender.
If iOS suspends JS, pending native reports wait until JS runs again; uninterrupted
locked-phone networking is not guaranteed.

The frontend uses the existing authenticated transport to POST **one multipart
request** to `/api/ai`: `text` (description), `source` (`glasses`), and `images`
(the local JPEG as a file). No separate `/api/media` upload is required by the
current backend. The API helper keeps its existing 15s default; AI submission
uses 120s. The backend owns AI execution and task creation; no AI provider is
contacted directly from the app. Dashboard data refreshes after confirmed success.

Delivery is persisted as pending → uploading → sent. Uploading is saved before
POST. There is one app-level sender and no automatic retry of ambiguous requests.
On network failure, timeout, unexpected response, or interruption during upload,
check tasks before using **Resend — may duplicate tasks**. The existing backend
has no idempotency key, so the client cannot guarantee exactly-once task creation
after a lost response. Sent reports are not sent again on launch. Pending reports
resume for their owning account. Unit tests use a stub backend and create no tasks.


### Capture confirmation sound and logs

A short native ding plays once after a photo and a non-empty finalized description
have both been saved locally. It confirms capture, not backend AI completion.
Missing descriptions and failed saves do not produce a success ding. Audio failure
never blocks report submission. The sound follows iOS's current media output;
select the glasses in Control Center to hear it there. The capture screen explains
when output is not Bluetooth. Playback mixes with other audio and does not replace
an existing recording session. Audible routing/volume need a physical glasses test.

In Xcode, attach the debugger to the running **mobile** process, show the debug
console (Shift–Command–Y), and filter for **OnCue**. Native logs mark command
recognition, description finalization (character count only), photo save, and the
ding's audio route. Frontend logs mark delivery start and backend confirmation.
They do not print the description, image bytes, authentication cookies, or tokens.
The capture page's delivery status remains the simplest way to check progress.


Live diagnostics are also visible inside the capture screen and written to
Caches/OnCueDiagnostics.log (last 60 events). This avoids relying on device console
stdout forwarding. Events include permission results, session/Speech states,
partial/final transcript arrival (character counts only), capture and delivery.
Partial speech cancels the completion timer; only a final transcript followed by
three seconds without further speech ends the description. The 60-second safety
limit keeps unfinished descriptions local for review instead of sending fragments.
