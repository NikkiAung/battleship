# Battleship

On-chain two-player Battleship on Solana, powered by [MagicBlock Ephemeral Rollups](https://docs.magicblock.gg/) for real-time gameplay with sub-50ms latency.

## Tech Stack

- **Program**: Rust, Anchor, Ephemeral Rollups SDK
- **Frontend**: React, TypeScript, Vite
- **Infra**: Solana Devnet, MagicBlock ER, TEE

## How It Works

1. Players create/join a game and place ships on a 10x10 grid
2. Game state is delegated to an Ephemeral Rollup for fast, gas-free turns
3. Hit/miss is determined on-chain -- no client trust required
4. Final state is committed back to Solana L1

## Setup

```bash
# Install dependencies
yarn install
cd app && npm install

# Build & deploy the program
anchor build
anchor deploy

# Run tests
anchor test

# Start the frontend
cd app && npm run dev
```

## Project Structure

```
programs/battleship/src/   Anchor program (instructions, state, errors, events)
tests/                     Program test suite
app/src/                   React frontend (components, hooks, services)
docs/                      Design docs and onboarding notes
```
