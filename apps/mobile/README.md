# OnCue authentication

The app uses the self-managed Better Auth server in `apps/backend`.

Start the backend first, then run `pnpm --filter mobile start` from the workspace
root. In development, the API URL is inferred from Expo's host on port 3002 for
native devices, or `http://localhost:3002` on web. Keep your phone and computer
on the same network. An Expo tunnel does not tunnel the backend; set
`EXPO_PUBLIC_API_URL` to a separately reachable API in that case.

For a production export, set `EXPO_PUBLIC_API_URL` to your HTTPS backend URL.
See `.env.example`. Never include database credentials or the auth secret in this
app. If using Expo web on a different origin, add that origin to the backend's
`AUTH_TRUSTED_ORIGINS` setting.

Sign up with a name, email, and password, or sign in to an existing account.
Signed-in users can access the tabs, verify their backend session, and sign out.
Expo Router protects those routes. The backend independently validates sessions.

Native cookies and the cached session use `expo-secure-store`. Web uses browser
cookies. `src/lib/api.ts` forwards native cookies to protected Hono routes and
uses the backend's emitted API types. After installing native modules, rebuild
your development client before running it on a device.

Run `pnpm --filter backend build` before `pnpm --filter mobile check-types` on a
fresh checkout. Run `pnpm --filter mobile lint` for ESLint checks. The root
`pnpm check-types` command builds the required API declarations automatically.

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
