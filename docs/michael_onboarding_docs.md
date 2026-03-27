# Magicblock Ephemeral Rollups Onboarding Experience:
**Table of Contents:**
* [Introduction](#introduction)
* [Understanding Ephemeral Rollups](#understanding-ephemeral-rollups)
* [Getting Started](#getting-started)
* [Ideas for improvements](#ideas-for-improvement)

## Introduction
I am documenting the onboarding experience of using Magicblock Ephemeral Rollups(ERs) and explaining any friction points I experience and suggesting personal changes/improvements. I have minimal experience developing web3 apps but for the sake of this doc we will assume that I am a solana developer who wants to implement ER.

## Understanding Ephemeral Rollups
Before we start writing any code we need to understand ERs first.
> Reference Material: https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/why

**Ephemeral Rollups(ERs):**

Current Blockchain Issues.
- Blockchain transaction costs and speeds can be too expensive and slow for real-time applications.
- Blockchains are public by default, all data onchain can be read.
  
How ERs improve this?
- Zero fees 
- Sub 10ms latency 
- Automated execution of transations
- Composable and upgradable
- On-demand rollups for millions of transactions
- Familiar tooling

### Going deeper
> Reference Material: https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/ephemeral-rollup

Magicblock’s Ephemeral Rollups leverages Solana Virtual Machine(SVM) account based structure and execution to optimize state management.
Structures state into clusters allowing users to lock one or multiple accounts and shift execution to a auxiliary layer.

1. Delegating an account:
- State accounts must be delegated to a specific ER validator first by changing the account owner to the delegation program(entrypoint for ERs) and specifying parameters like: ER validator, account lifetime, and synchronization frequency.

2. Execute Transactions In Realtime
- Delegated state accounts are updated in realtime with transactions on the ER directly or via magic router(Magicblock's accelerated routing engine). The initial transaction on ER clones the delegated account from base layer to the ER. Delegated account states can be continuously updated in realtime until undelegated.

3. Commit State
- User commits ER to base layer and account state is finalized.

4. Undelegate Account
- Delegated account states are committed through ER validator to base layer and the account owner is reversed from the delegation program.

## Getting started
> Reference Material: https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart

First we need to install all the necessary tools: Solana, Rust, Anchor, Node

> For this doc I am going to use a fresh install of Linux Mint on a VM to simulate installing these tools for the first time.

### Installation Process: 
Solana: sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.9/install)"

Rust (Rustup): curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

Anchor: curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash

Node: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash


## Creating Counter With Ephemeral Rollup



## Ideas For Improvement
- Automatically show most up to date compatible version for each software(sol, rust, anchor, node) on website.
- Install guide to install anchor via AVM instead.
-
