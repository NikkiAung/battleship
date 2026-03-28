import {
  BOARD_SIZE,
  ENCRYPTED_GRID_SIZE,
  GRID_SIZE,
  SHIP_SIZES,
} from "../idl/battleship";

// a flat 100-cell grid where 1 = ship, 0 = water
export type ShipGrid = Uint8Array;

// generate random ship placements on a 10x10 grid
export function generateShipPlacements(): ShipGrid {
  const grid = new Uint8Array(BOARD_SIZE);

  for (const size of SHIP_SIZES) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() > 0.5;
      const maxRow = horizontal ? GRID_SIZE : GRID_SIZE - size;
      const maxCol = horizontal ? GRID_SIZE - size : GRID_SIZE;
      const row = Math.floor(Math.random() * maxRow);
      const col = Math.floor(Math.random() * maxCol);

      const cells: number[] = [];
      for (let i = 0; i < size; i++) {
        const idx = horizontal
          ? row * GRID_SIZE + col + i
          : (row + i) * GRID_SIZE + col;
        cells.push(idx);
      }

      // no overlap check
      if (!cells.some((c) => grid[c] !== 0)) {
        cells.forEach((c) => {
          grid[c] = 1;
        });
        placed = true;
      }
    }
  }

  return grid;
}

// encrypt ship grid — pads to ENCRYPTED_GRID_SIZE (112 bytes)
// uses a random nonce + XOR for simple symmetric encryption
export async function encryptGridAsync(
  grid: ShipGrid,
  secret: Uint8Array
): Promise<{ encrypted: Uint8Array; commitment: Uint8Array }> {
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);

  const ciphertext = new Uint8Array(BOARD_SIZE);
  for (let i = 0; i < BOARD_SIZE; i++) {
    ciphertext[i] = grid[i] ^ secret[i % secret.length];
  }

  const encrypted = new Uint8Array(ENCRYPTED_GRID_SIZE);
  encrypted.set(nonce, 0);
  encrypted.set(ciphertext, 12);

  const commitment = await computeCommitmentAsync(grid);
  return { encrypted, commitment };
}

// compute sha256 commitment of the raw grid
async function computeCommitmentAsync(grid: ShipGrid): Promise<Uint8Array> {
  // copy to a plain ArrayBuffer to satisfy crypto.subtle types
  const data = new Uint8Array(grid);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

// generate a random 32-byte secret
export function generateSecret(): Uint8Array {
  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);
  return secret;
}

// get ship cell indices from a grid
export function getShipCells(grid: ShipGrid): number[] {
  const cells: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 1) cells.push(i);
  }
  return cells;
}
