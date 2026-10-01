import "server-only";
import { mkdirSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runtime } from "./db";

/**
 * Private receipt storage. Files sit outside `public/` and are only ever
 * returned by a route that has checked who is asking. Swap this module for
 * an object store (private bucket + short-lived signed reads) in production.
 */
const KEY = /^r_[0-9a-f]{18}\.(jpg|png|pdf)$/;

function pathFor(key: string): string {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
  const dir = join(runtime().dataDir, "receipts");
  mkdirSync(dir, { recursive: true });
  return join(dir, key);
}

export async function saveReceiptFile(key: string, bytes: Uint8Array): Promise<void> {
  await writeFile(pathFor(key), bytes, { flag: "wx" });
}

export async function readReceiptFile(key: string): Promise<Buffer> {
  return readFile(pathFor(key));
}

export async function removeReceiptFile(key: string): Promise<void> {
  await rm(pathFor(key), { force: true });
}
