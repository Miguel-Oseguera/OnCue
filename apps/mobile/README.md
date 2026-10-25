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
