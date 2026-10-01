// Dev helper: sign the shareback sign-in message with a throwaway key kept in ./data (gitignored).
// usage: node scripts/dev-sign.mjs address
//        node scripts/dev-sign.mjs sign <host> <nonce> <issuedAt>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

mkdirSync("data", { recursive: true });
const file = "data/.dev-test-wallet";
if (!existsSync(file)) writeFileSync(file, generatePrivateKey());
const account = privateKeyToAccount(readFileSync(file, "utf8").trim());
const [command, host, nonce, issuedAt] = process.argv.slice(2);
if (command === "sign") {
  // Keep in sync with src/lib/signin-message.ts
  const message = [
    `${host} wants you to sign in to shareback with your wallet:`,
    account.address,
    "",
    "Signing in lets you submit receipts and see your own records. It costs no gas and moves no funds.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
  console.log(await account.signMessage({ message }));
} else console.log(account.address);
