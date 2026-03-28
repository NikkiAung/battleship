// tee validator integration — er integrity verification + auth
// uses magicblock tee at the er endpoint for authenticated operations

import type { PublicKey } from "@solana/web3.js";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";

// er endpoint (same as magic router)
const ER_ENDPOINT = "https://devnet.magicblock.app";

// cached auth state
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// authenticate with the er/tee validator via challenge/sign/login
// returns a jwt token for authenticated er operations
export async function authenticateWithTee(
  publicKey: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { token, expiresAt } = await getAuthToken(
    ER_ENDPOINT,
    publicKey,
    signMessage
  );

  cachedToken = token;
  tokenExpiresAt = expiresAt;
  console.log("tee auth acquired, expires:", new Date(expiresAt));
  return token;
}

// clear cached auth state
export function clearTeeAuth(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
