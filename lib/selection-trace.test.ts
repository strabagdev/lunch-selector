import assert from "node:assert/strict";
import test from "node:test";
import { getPublicSelectionTrace } from "./selection-trace";

test("public trace uses trusted request metadata and the browser session id", () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.42",
    "user-agent": "  Lunch   Browser/1.0  ",
  });
  const formData = new FormData();
  formData.set("sessionId", "7F9C2AD2-65F1-4BCB-A5B8-91D62C8B9AD1");
  formData.set("source", "ADMIN");
  formData.set("ipAddress", "198.51.100.10");
  formData.set("userAgent", "Forged Browser");

  const trace = getPublicSelectionTrace(headers, formData, {
    trustRailwayProxy: true,
  });

  assert.deepEqual(trace, {
    source: "PUBLIC_WEB",
    ipAddress: "203.0.113.42",
    userAgent: "Lunch Browser/1.0",
    sessionId: "7f9c2ad2-65f1-4bcb-a5b8-91d62c8b9ad1",
  });
});

test("missing request metadata remains nullable", () => {
  const trace = getPublicSelectionTrace(new Headers(), new FormData(), {
    trustRailwayProxy: true,
  });

  assert.deepEqual(trace, {
    source: "PUBLIC_WEB",
    ipAddress: null,
    userAgent: null,
    sessionId: null,
  });
});

test("IP is ignored outside a trusted Railway proxy", () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.42",
  });
  const formData = new FormData();
  formData.set("sessionId", "not-a-uuid");

  const trace = getPublicSelectionTrace(headers, formData, {
    trustRailwayProxy: false,
  });

  assert.equal(trace.ipAddress, null);
  assert.equal(trace.sessionId, null);
});
