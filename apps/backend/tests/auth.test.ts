import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app.js";
import { account, user } from "../src/auth-schema.js";
import { db, pool } from "../src/db.js";

after(async () => pool.end());

test("email/password sessions protect the API and are revoked on sign-out", async (t) => {
  const email = `auth-test-${randomUUID()}@example.test`;
  const password = `test-${randomUUID()}`;
  const name = "Auth integration test";
  const headers = {
    "Content-Type": "application/json",
    "expo-origin": "mobile://",
  };

  t.after(async () => {
    await db.delete(user).where(eq(user.email, email));
  });

  const anonymous = await app.request("/api/me");
  assert.equal(anonymous.status, 401);

  const untrusted = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { ...headers, origin: "https://untrusted.example" },
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(untrusted.status, 403);

  const signUp = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(signUp.status, 200, await signUp.clone().text());
  const cookie = signUp.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("session_token"));

  const [savedUser] = await db.select().from(user).where(eq(user.email, email));
  assert.ok(savedUser);
  const [savedAccount] = await db
    .select()
    .from(account)
    .where(eq(account.userId, savedUser.id));
  assert.ok(savedAccount?.password);
  assert.notEqual(savedAccount.password, password);

  const profile = await app.request("/api/me", { headers: { cookie } });
  assert.equal(profile.status, 200);
  assert.deepEqual(await profile.json(), {
    user: { id: savedUser.id, name, email },
  });

  const restored = await app.request("/api/auth/get-session", {
    headers: { cookie },
  });
  assert.equal(restored.status, 200);
  assert.ok((await restored.text()).includes(savedUser.id));

  const wrongPassword = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: "incorrect-password" }),
  });
  assert.equal(wrongPassword.status, 401);

  const signOut = await app.request("/api/auth/sign-out", {
    method: "POST",
    headers: { ...headers, cookie },
    body: "{}",
  });
  assert.equal(signOut.status, 200);
  assert.equal(
    (await app.request("/api/me", { headers: { cookie } })).status,
    401,
  );

  const signIn = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signIn.status, 200);
  const newCookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.equal(
    (await app.request("/api/me", { headers: { cookie: newCookie } })).status,
    200,
  );

  const preflight = await app.request("/api/me", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:8081",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:8081",
  );
  assert.equal(
    preflight.headers.get("Access-Control-Allow-Credentials"),
    "true",
  );
});
