// tee validator integration
// uses magicblock tee validator for ER integrity verification
// the tee ensures the ephemeral rollup validator runs in a genuine enclave

import type { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// magicblock tee validator endpoint
export const TEE_RPC_URL = "https://tee.magicblock.app";

// cached auth state
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days

// get an auth token from the tee validator
// implements the challenge/sign/login flow from the SDK's getAuthToken
export async function authenticateWithTee(
  publicKey: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  // step 1: get challenge
  const challengeRes = await fetch(
    `${TEE_RPC_URL}/auth/challenge?pubkey=${publicKey.toString()}`
  );
  const challengeJson = await challengeRes.json();
  if (challengeJson.error) {
    throw new Error(`tee challenge failed: ${challengeJson.error}`);
  }
  const challenge = challengeJson.challenge as string;

  // step 2: sign the challenge with wallet
  const messageBytes = new TextEncoder().encode(challenge);
  const signature = await signMessage(messageBytes);
  const signatureString = bs58.encode(signature);

  // step 3: login with signed challenge
  const authRes = await fetch(`${TEE_RPC_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pubkey: publicKey.toString(),
      challenge,
      signature: signatureString,
    }),
  });
  const authJson = await authRes.json();
  if (authRes.status !== 200) {
    throw new Error(`tee auth failed: ${authJson.error}`);
  }

  cachedToken = authJson.token;
  tokenExpiresAt = authJson.expiresAt ?? Date.now() + SESSION_DURATION;
  console.log("tee auth token acquired, expires:", new Date(tokenExpiresAt));
  return cachedToken!;
}

// clear cached auth state
export function clearTeeAuth(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
