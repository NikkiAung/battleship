# TODO
Phase 1: Anchor Program Setup

    Define PlayerBoard account struct with all fields
    Define GameSession account struct (game_id, player_one, player_two, current_turn, game_state)
    Define GameError enum for custom errors
    Create InitializeGame instruction context
    Implement initialize_game function (creates GameSession PDA)
    Create InitializePlayerBoard instruction context
    Implement initialize_player_board function (creates PlayerBoard PDA for each player)
    Create AutoPlaceShips instruction context
    Implement auto_place_ships function (generates random ship positions, encrypts, stores in TEE)
    Create ProcessAttack instruction context
    Implement process_attack function (updates cell_states, increments hits_received)
    Create CheckWinner instruction context
    Implement check_winner function (determines if hits_received >= 10)
    Create DelegateToER instruction context
    Implement delegate_to_er function (initiates ER session)
    Create UndelegateFromER instruction context
    Implement undelegate_from_er function (pulls final state from ER)
    Create FinalizeGame instruction context
    Implement finalize_game function (marks winner, commits to L1)
    Add event definitions (GameInitialized, AttackProcessed, GameFinalized)
    Write unit tests for each instruction
    Build and test: cargo build-sbf

Phase 2: Frontend Setup

    Create React project structure (or use existing template)
    Install dependencies: @solana/web3.js, @solana/wallet-adapter-*, @magicblock/magic-router
    Create SolanaProvider context for wallet connection
    Create useSolanaWallet hook for wallet operations
    Create WalletConnectButton component
    Create GameBoard component (10x10 grid rendering)
    Create ShipPlacement component (auto-place UI)
    Create AttackPhase component (click-to-fire UI)
    Create GameLobby component (start game UI)
    Create GameFinalization component (winner screen)
    Create main Game page orchestrating all phases

Phase 3: Game Logic Integration

    Create useGameSession hook to manage game state
    Implement initializeGame function (calls Anchor program)
    Implement autoPlaceShips function (calls Anchor program)
    Implement submitAttack function (calls Anchor program via Magic Router)
    Implement checkWinner function (polls game state)
    Implement delegateToER function (initiates ER session)
    Implement undelegateFromER function (finalizes game)
    Create useMagicRouter hook for transaction routing
    Implement routing logic: gameplay → ER, finalization → L1
    Add error handling for failed transactions
    Add loading states during transaction submission

Phase 4: TEE Integration

    Research MagicBlock TEE validator API (tee.magicblock.app)
    Create function to encrypt ship grid before sending to TEE
    Create function to request encrypted grid storage from TEE
    Create function to request decryption from TEE after game ends
    Implement error handling for TEE communication
    Test TEE integration with mock data

Phase 5: ER Delegation Flow

    Create DelegationManager to handle ER session lifecycle
    Implement delegation instruction (start ER session)
    Implement undelegation instruction (end ER session, pull final state)
    Add state validation before/after delegation
    Test delegation with mock ER endpoint
    Implement fallback to L1 if ER fails

Phase 6: Testing & Deployment

    Write integration tests for full game flow
    Test wallet connection with Phantom/Solflare
    Test ship placement (auto-generate, verify no overlaps)
    Test attack phase (hit/miss logic, turn alternation)
    Test winner detection (hits_received >= 10)
    Test ER delegation/undelegation flow
    Test TEE encryption/decryption
    Deploy Anchor program to devnet
    Update frontend with deployed program ID
    End-to-end test: full game from start to finish
    Test error scenarios (invalid moves, network failures, etc.)

Phase 7: UI/UX Polish

    Add loading spinners for transactions
    Add success/error toast notifications
    Add smooth animations for grid interactions
    Add game status display (current turn, hits received, etc.)
    Add responsive design for mobile
    Add accessibility features (keyboard navigation, ARIA labels)
    Test on multiple browsers

Phase 8: Documentation

    Write README with setup instructions
    Document Anchor program instructions
    Document frontend API/hooks
    Add inline code comments
    Create architecture diagram
    Document TEE integration steps
    Document ER delegation flow
