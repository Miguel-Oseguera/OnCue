import test from "node:test";
import assert from "node:assert/strict";
import { connectionLabel, glassesCallbackRoute } from "./connection-state.ts";
const base = {
  supported: true,
  registration: "registered",
  busy: false,
  error: null,
  devices: [],
};
const device = {
  id: "glasses-1",
  name: "Meta glasses",
  batteryLevel: null,
  compatibility: "Compatible",
  linkState: "disconnected",
};

test("registration approval alone never claims that glasses are connected", () => {
  assert.equal(connectionLabel(base), "Approved · waiting for glasses");
  assert.equal(
    connectionLabel({ ...base, devices: [device] }),
    "Approved · waiting for glasses",
  );
  assert.equal(
    connectionLabel({
      ...base,
      registration: "available",
      devices: [{ ...device, linkState: "connected" }],
    }),
    "Not connected",
  );
});
test("connected and connecting labels require actual observed device link states", () => {
  assert.equal(
    connectionLabel({
      ...base,
      devices: [{ ...device, linkState: "connecting" }],
    }),
    "Connecting glasses…",
  );
  assert.equal(
    connectionLabel({
      ...base,
      devices: [{ ...device, linkState: "connected" }],
    }),
    "Glasses connected",
  );
  assert.equal(
    connectionLabel({ ...base, registration: "registering" }),
    "Waiting for approval",
  );
  assert.equal(
    connectionLabel({ ...base, error: "Bluetooth unavailable" }),
    "Connection needs attention",
  );
  assert.equal(connectionLabel({ ...base, supported: false }), "Not available");
});
test("Meta callbacks return to the dashboard while auth and task links remain unchanged", () => {
  assert.equal(
    glassesCallbackRoute("mobile://?metaWearablesAction=registration"),
    "/",
  );
  for (const path of [
    "mobile://auth/callback?code=example",
    "/tasks/123",
    "https://example.com/?metaWearablesAction=example",
    "mobile://sign-in",
    "http://[invalid",
  ]) {
    assert.equal(glassesCallbackRoute(path), path);
  }
});
