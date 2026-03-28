// phase 4: tee validator integration
// uses magicblock tee validator at tee.magicblock.app for:
//   1. auth token acquisition (challenge/sign/login)
//   2. encrypted ship grid storage and reveal
//
// NOTE: we implement the auth flow directly instead of importing from the
// SDK barrel, because the barrel re-exports @phala/dcap-qvl which requires
// Node.js native modules and crashes in the browser.

import type { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// magicblock tee validator endpoint
export const TEE_RPC_URL = "https://tee.magicblock.app";

// cached auth state
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days

// get an auth token from the tee validator
// implements the same challenge/sign/login flow as the SDK's getAuthToken
export async function authenticateWithTee(
  publicKey: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  // return cached token if still valid (with 60s buffer)
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

// store encrypted ship grid in the tee validator
export async function storeEncryptedGrid(
  token: string,
  gameId: string,
  playerPubkey: string,
  encryptedGrid: number[],
  commitment: number[]
): Promise<void> {
  const response = await fetch(`${TEE_RPC_URL}/store`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      gameId,
      player: playerPubkey,
      encryptedGrid,
      commitment,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`tee store failed (${response.status}): ${body}`);
  }
  console.log("encrypted grid stored in tee for game:", gameId);
}

// request the tee to reveal a player's ship grid after game ends
export async function revealGrid(
  token: string,
  gameId: string,
  playerPubkey: string
): Promise<{ grid: number[]; commitment: number[] } | null> {
  const response = await fetch(`${TEE_RPC_URL}/reveal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ gameId, player: playerPubkey }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`tee reveal failed (${response.status}): ${body}`);
    return null;
  }

  const data = await response.json();
  return { grid: data.grid, commitment: data.commitment };
}

// clear cached auth state
export function clearTeeAuth(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
