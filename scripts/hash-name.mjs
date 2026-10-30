#!/usr/bin/env node
/**
 * Generate ACCESS_NAME_HASH for a dummy local name.
 * Do not pass a real child's name. Output is the hex hash only.
 *
 *   npm run hash-name -- --salt <ACCESS_SALT> --name <dummy-name>
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
const name = (readArg("--name") || "").trim().normalize("NFC");

if (!salt || !name) {
  console.error(
    "Usage: npm run hash-name -- --salt <ACCESS_SALT> --name <dummy-name>",
  );
  process.exit(1);
}

const digest = createHash("sha256").update(`${salt}\0${name}`).digest("hex");
console.log(digest);
