# Game logic
initial game logic:
player vs cpu
10x10 grid
Ships
  Aircraft Carrier: 1x5
  Battleship: 1x4
  Cruiser: 1x3
  Submarine: 1x3
  Destroyer: 1x2
auto placement of ships for player and cpu 


delegate when game begins
ER session runs for entire game
(use this for ship positions: MagicBlock's TEE validator (tee.magicblock.app) 
undelegate when winner is determined 
reveal board after
finalize transaction

PlayerBoard PDA
├── grid_commitment: [u8; 32] 
├── cell_states:    [u8; 100] 
├── hits_received:  u8        
└── pub ship_grid_encrypted: [u8; 112] 

products used: magicblock router, magicblock TEE, ER SDK

AI Summary
Game Flow
Phase 1: Initialization

    Both player and CPU receive auto-generated ship placements via the Anchor program
    Each player's ship grid is encrypted and stored in MagicBlock's TEE validator (tee.magicblock.app)
    Player's encrypted grid commitment is hashed and stored on-chain as grid_commitment: [u8; 32] in the PlayerBoard PDA
    Delegation to ER is initiated, beginning the ER session

Phase 2: Gameplay (ER Session)

    The entire game session runs within Ephemeral Rollups – all moves, turn logic, and hit/miss calculations execute with sub-50ms latency and zero gas fees
    Players take turns firing at opponent's grid
    Hit/miss results are computed in ER and immediately reflected in cell_states: [u8; 100]
    hits_received: u8 tracks damage taken
    No state is committed to L1 during gameplay

Phase 3: Settlement

    When a winner is determined (one player's ships fully destroyed), the ER session ends
    Undelegation is triggered, pulling the final game state from ER
    Encrypted ship grids are revealed from the TEE, decrypted, and verified on-chain
    Final PlayerBoard state is committed to L1, including:
        grid_commitment: [u8; 32] (hash of final board state)
        cell_states: [u8; 100] (shot tracking)
        hits_received: u8 (damage received)
        ship_grid: [u8; 100] (now decrypted and revealed)
    Winner is recorded on-chain with finalization transaction

Key Technologies

    Magicblock ER SDK – Manages delegation/undelegation and ER session lifecycle
    Magicblock Router – Intelligently routes transactions between L1 and ER
    Magicblock TEE Validator – Securely stores and reveals encrypted ship positions
    Anchor Program – Manages PlayerBoard PDAs and on-chain state commitments

Security Model

    Ship positions remain encrypted and hidden in TEE throughout gameplay, preventing cheating
    ER ensures tamper-proof move execution with cryptographic proofs
    Final state is verifiable on-chain after undelegation
    All game logic is deterministic and reproducible for dispute resolution if needed

