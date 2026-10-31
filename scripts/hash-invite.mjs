#!/usr/bin/env node
/**
 * Generate ACCESS_INVITE_HASH for a local-only invitation token.
 * Never place the raw invitation token in source control.
 *
 *   npm run hash-invite -- --salt <ACCESS_SALT> --invite <opaque-token>
 */
import { createHash } from "node:crypto";

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) {
    return "";
  }
  return process.argv[index + 1];
}

const salt = readArg("--salt") || process.env.ACCESS_SALT || "";
const invite = (readArg("--invite") || "").trim().normalize("NFC");

if (!salt || !invite) {
  console.error(
    "Usage: npm run hash-invite -- --salt <ACCESS_SALT> --invite <opaque-token>",
  );
  process.exit(1);
}

const digest = createHash("sha256").update(`${salt}\0${invite}`).digest("hex");
console.log(digest);
