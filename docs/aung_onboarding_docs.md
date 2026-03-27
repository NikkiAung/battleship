# MagicBlock Ephemeral Rollups — Onboarding Guide

> A hands-on onboarding experience for building real-time Solana programs using MagicBlock's Ephemeral Rollup (ER) infrastructure. Written from first-principles exploration during the MLH Solana hackathon.

**Live Demo:** [TapChain — On-chain Tapping Game](https://app-woad-phi-ibt37r1lgr.vercel.app/)  
**Source Code:** [NikkiAung/Magicblock-ER](https://github.com/NikkiAung/Magicblock-ER)

---

## Table of Contents

- [What is an Ephemeral Rollup?](#what-is-an-ephemeral-rollup)
- [Step 1 — Prerequisites & Installation](#step-1--prerequisites--installation)
- [Step 2 — Core Concepts](#step-2--core-concepts)
  - [Concept 1: `#[ephemeral]` — Marking a Program as ER-aware](#concept-1-ephemeral--marking-a-program-as-er-aware)
  - [Concept 2: DELEGATE — Locking an Account into the ER](#concept-2-delegate--locking-an-account-into-the-er)
  - [Concept 3: Fast Execution & Commit via CPI → Validator](#concept-3-fast-execution--commit-via-cpi--validator)
  - [Concept 4: Commit vs. Undelegate](#concept-4-commit-vs-undelegate)
  - [The Full Lifecycle in Code](#the-full-lifecycle-in-code)
- [Step 3 — Recommended Resources](#step-3--recommended-resources)
- [Step 4 — Deep Dive via TapChain (Personal Project)](#step-4--deep-dive-via-tapchain-personal-project)
  - [Q1 — Why does `tap` behave differently on Solana vs the ER?](#q1--why-does-tap-behave-differently-on-solana-vs-the-er)
  - [Q2 — Why does `undelegate` need PDA seeds, but `commit` doesn't?](#q2--why-does-undelegate-need-pda-seeds-but-commit-doesnt)
  - [Q3 — Who triggers the actual ownership transfer back to Solana?](#q3--who-triggers-the-actual-ownership-transfer-back-to-solana)

---

## What is an Ephemeral Rollup?

An **Ephemeral Rollup (ER)** is a temporary, high-speed execution environment built on a fork of the Solana validator codebase. It borrows accounts from Solana mainnet/devnet, lets you perform fast and cheap transactions on them, then returns the final state back to Solana.

```
Running directly on Solana (Base Layer) is expensive and slow (~400ms–1s per tx).
The ER delegates accounts away from Solana, executes transactions locally (~10ms),
then commits the final state back — using the SVM (Solana Virtual Machine) throughout.
```

**Key insight:** The ER uses MagicBlock's optimized SVM runtime. The same program binary runs on both Solana and the ER — the program is not re-deployed; it's mirrored.

---

## Step 1 — Prerequisites & Installation

### Required Software

| Software   | Version | Installation Guide                                              |
| ---------- | ------- | --------------------------------------------------------------- |
| **Solana** | 2.3.13  | [Install Solana](https://docs.anza.xyz/cli/install)             |
| **Rust**   | 1.85.0  | [Install Rust](https://www.rust-lang.org/tools/install)         |
| **Anchor** | 0.32.1  | [Install Anchor](https://www.anchor-lang.com/docs/installation) |
| **Node**   | 24.10.0 | [Install Node](https://nodejs.org/en/download/current)          |

### Verify Installation

```bash
rustc --version && node --version && solana --version && anchor --version
```

---

## Step 2 — Core Concepts

### Concept 1: `#[ephemeral]` — Marking a Program as ER-aware

The `#[ephemeral]` attribute on your Anchor program tells the MagicBlock SDK that this program is designed to run on the ER. It unlocks ER-specific instructions like `delegate`, `commit`, and `undelegate`.

**Why the same program runs on both sides:**  
Anchor generates an IDL (`target/idl/anchor_counter.json`) and a `.so` binary when you build. The ER validator syncs that executable account from Solana at startup (or on-demand) and caches it locally. The same program ID (e.g. `9RPwaXayVZHna1BYuRS4cLPJZuNGU1uS5V3heXB7v6Qi`) executes on both Solana and the ER.

> Each side has its own separate SBF VM instance — same type, but not shared.

---

### Concept 2: DELEGATE — Locking an Account into the ER

Delegation happens **on Solana**, not on the ER. It does two things:

1. **Locks** the account on Solana — freezes it so nobody can mutate it there
2. **Copies** the account data to the ER so it can be mutated freely there

> Think of it like checking your luggage at an airport. The airline (ER) takes control of your bag (account data), you can't touch it mid-flight, and you get it back when you land (undelegate).

**What delegation transfers:** Control of the account _data_, not the program. The program was already present on both sides via mirroring.

---

### Concept 3: Fast Execution & Commit via CPI → Validator

Once an account is delegated to the ER:

- Transactions are processed by a **single sequencer** — no global consensus needed
- Results are written locally in ~10ms (vs ~400ms–1s on Solana)
- The `commit` instruction issues a **CPI** (Cross-Program Invocation) within the ER's SVM to MagicBlock's Magic program
- The **ER validator** (outside the SVM) physically carries that state snapshot to Solana

**Analogy:** CPI is the instruction; the validator is the delivery truck.

```
CPI is inside the ER's SVM only.
It signals MagicBlock's Magic program.
The ER validator (outside the SVM) physically carries the state to Solana.
```

> CPI only appears at commit or undelegate time — not on every individual transaction.

---

### Concept 4: Commit vs. Undelegate

| Action                  | Where it runs | What it does                                                            |
| ----------------------- | ------------- | ----------------------------------------------------------------------- |
| `commit`                | ER            | Snapshots current ER state to Solana; account **stays** delegated to ER |
| `undelegate`            | Solana        | Returns full account ownership back to your program; ER session ends    |
| `commit_and_undelegate` | ER → Solana   | Commits final state AND ends the ER session in one call                 |

**Rule of thumb:**

- Use `commit` mid-session to checkpoint progress without ending the ER session.
- Use `undelegate` (or `commit_and_undelegate`) when you're done with the fast-lane and want the account fully back on Solana.

---

### The Full Lifecycle in Code

```
1. Deploy program to Solana (anchor deploy)
       ↓
2. Initialize account on Solana (e.g. TapScore { score: 0 })
       ↓
3. Delegate account to ER (runs on Solana)
   → Account is locked on Solana
   → Account data is copied to ER
       ↓
4. Run fast transactions on ER (tap, tap, tap... ~10ms each)
   → No global consensus, single sequencer
       ↓
5. Commit state back to Solana (optional mid-session checkpoint)
       ↓
6. Undelegate — return account to Solana with final state
   → MagicBlock sequencer triggers this automatically after commit_and_undelegate
       ↓
7. Account is back on Solana — fully settled, trustless finality
```

---

## Step 3 — Recommended Resources

### Official Docs & Starter Projects

- [MagicBlock Product Overview](https://docs.magicblock.gg/pages/overview/products)
- [YouTube: Build a real-time Anchor Counter with MagicBlock's ER](https://www.youtube.com/watch?v=qwu2RBKyFiw&list=PLWR_ZQiGMS8mIe1kPZe8OfHIbhvZqaM8V&t=148s) — best first project

### Founder Talks (Whiteboard-level explanations)

- [Episode 2 — Under the Hood of Ephemeral Rollups](https://youtu.be/Zvy-YNMwCJA)
- [Episode 3 — How MagicBlock Brings Real-Time Privacy to Solana](https://youtu.be/JSJiVdNQyYA)

### Mentor Talk

- [Why Build with MagicBlock? Solve Scaling & UX Pain Points with ERs](https://youtu.be/yfgDZJJvydU?list=PLWR_ZQiGMS8mIe1kPZe8OfHIbhvZqaM8V)

---

## Step 4 — Deep Dive via TapChain (Personal Project)

TapChain is a real-time on-chain tapping game built to internalize ER concepts hands-on. Each question below came from actually building it.

### Q1 — Why does `tap` behave differently on Solana vs the ER?

**Short answer:** Account ownership + consensus model.

#### The VM Mirror

The ER is a fork of the Solana validator codebase. Both run the same **SBF (Solana Bytecode Format)** runtime — same instruction set, separate instances.

```
Solana Mainnet                    Ephemeral Rollup
┌─────────────────────┐           ┌─────────────────────┐
│  SBF VM instance    │           │  SBF VM instance    │
│                     │           │                     │
│  [your_program.so]  │  mirrors  │  [your_program.so]  │
│  stored in          │ ────────► │  cached copy        │
│  executable account │           │                     │
│                     │           │  runs against       │
│                     │           │  delegated account  │
└─────────────────────┘           └─────────────────────┘
```

On first ER tap:

1. ER validator: "I need TapScore for player X"
2. Fetches current account data from Solana
3. Caches it locally
4. Executes `tap()` — writes locally, no consensus needed
5. Returns result in ~10ms

> This is why the **first ER transaction is slightly slower** — it includes the fetch. All subsequent taps are pure local writes.

#### The Restaurant Analogy

| Restaurant concept | Solana equivalent                          |
| ------------------ | ------------------------------------------ |
| Recipe / menu item | Instruction (`tap`, `commit`, etc.)        |
| Ingredients        | Account state (`TapScore { score: u64 }`)  |
| Kitchen            | Runtime (Solana validator OR ER validator) |
| Chef               | Validator                                  |
| Serving the dish   | Writing the result back to the account     |

Same menu, same recipe — but ingredients (account state) are locked in one kitchen at a time.

#### Why the ER is faster

The SBF VM executes `tap()` in microseconds on **both** sides. That's not the bottleneck. What makes Solana slow is consensus:

```bash
# Solana mainnet — ~2000 validators worldwide
# Every transaction must be agreed upon by 2/3 before it's final.

Solana transaction lifecycle:
  submit tx → propagate to leader → execute (microseconds)
  → PoH stamp → broadcast to ~2000 validators
  → wait for 2/3 supermajority vote → finality
  total: ~400ms–1s

# ER — single sequencer, no vote needed

ER transaction lifecycle:
  submit tx → sequencer executes → done
  total: ~10ms
```

> **Law analogy:** Solana is a law requiring parliament to vote. The ER is a company internal policy — one decision-maker signs it and it's done. The work of writing it takes the same time either way. The delay is the approval process.

**The ER is faster because it skips global consensus — not because it optimizes the VM.** The tradeoff: one sequencer = one point of trust during the session. That's why you commit back to Solana for permanent, trustless finality.

---

### Q2 — Why does `undelegate` need PDA seeds, but `commit` doesn't?

**`commit`** runs on the ER. The ER sequencer already controls the accounts. No proof needed — it just writes state.

**`undelegate`** runs on Solana. Your program needs to prove to the delegation program that it legitimately owns this PDA. The proof is the seeds, passed via `invoke_signed`.

The delegation program checks: _"Do those seeds derive this PDA address? If yes, this program is the legitimate owner"_ — then transfers ownership back.

In TapChain:

```bash
seeds = ["tapscore", player_pubkey]
PDA address = hash(YourProgramID + "tapscore" + player_pubkey)
```

**One-liner:** `commit` is the ER talking to itself. `undelegate` is your program on Solana proving ownership to a third party (the delegation program).

> MagicBlock writes the fresh state first, then automatically triggers your program on Solana to reclaim the account using the seeds as proof of ownership.

---

### Q3 — Who triggers the actual ownership transfer back to Solana?

**The MagicBlock validator (sequencer) triggers it automatically.**

```
1. You call commit_and_undelegate on ER
        ↓
2. ER sequencer writes your final state (e.g. score: 50) to Solana
        ↓
3. MagicBlock sequencer sends a transaction to Solana
   calling your program's Undelegate instruction
        ↓
4. Your program runs on Solana, shows seeds to delegation program
        ↓
5. Delegation program transfers ownership back to your program
        ↓
6. Done — account is back on Solana with final score
```

You never manually trigger step 3.

This is why the `Undelegate` discriminator is a **fixed protocol-level byte sequence** — `[196, 28, 41, 206, 48, 37, 51, 167]`. MagicBlock's sequencer knows exactly which bytes to call on any program using the ER SDK. It's a standard callback interface, not something you define yourself.

> Your program doesn't initiate the final ownership transfer — you implement the handler, and the validator calls it when it's ready.

---

## Summary Mental Model

```
Solana  = parliament (slow, trustless, permanent)
ER      = fast-lane (one sequencer, ~10ms, temporary)

delegate    → check luggage in at the airport (Solana freezes, ER takes over)
tap/execute → operate in the fast lane (no global vote)
commit      → mid-flight checkpoint (state synced to Solana, ER still active)
undelegate  → land and reclaim luggage (Solana owns it again, ER session ends)
```

---

_Built during MLH Solana × MagicBlock Hackathon. Documented by Aung Nanda Oo._
