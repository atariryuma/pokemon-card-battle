/**
 * SETUP-ORCHESTRATOR.JS - 初期セットアップ統括クラス
 *
 * 目的:
 * - セットアップフェーズ全体の流れを統括
 * - SetupManagerの責任を分割して管理
 * - 非同期処理の安全な制御
 *
 * 設計原則:
 * - 単一責任: セットアップフローの統括のみ
 * - 依存性注入: 必要なコンポーネントを注入
 * - 明確なフェーズ管理
 */

import { cloneGameState, addLogEntry } from '../state.js';
import { GAME_PHASES } from '../phase-manager.js';
import { SetupError, SetupErrorType } from '../errors/setup-error.js';
import { PokemonPlacementHandler } from './pokemon-placement-handler.js';
import { setupStateValidator } from './setup-state-validator.js';
import { ANIMATION_TIMING, SHAKE_CONFIG, MULLIGAN_CONFIG } from '../constants/timing.js';
import { SequentialAnimator } from '../utils/sequential-animator.js';
import { animate } from '../animation-manager.js';
import { createLogger } from '../logger.js';

const logger = createLogger('SetupOrchestrator');

/**
 * セットアップフェーズの定義
 */
export const SetupPhase = {
    SHUFFLE: 'shuffle',
    INITIAL_DEAL: 'initial-deal',
    PRIZE_DEAL: 'prize-deal',
    MULLIGAN: 'mulligan',
    INITIAL_SELECTION: 'initial-selection',
    CONFIRM: 'confirm',
    GAME_START: 'game-start'
};

/**
 * 初期セットアップ統括クラス
 */
export class InitialSetupOrchestrator {
    /**
     * @param {GameContext} gameContext - ゲームコンテキスト
     * @param {PokemonPlacementHandler} placementHandler - ポケモン配置ハンドラー
     */
    constructor(gameContext, placementHandler = null) {
        this.gameContext = gameContext;
        this.placementHandler = placementHandler || new PokemonPlacementHandler(gameContext);
        this.validator = setupStateValidator;

        this.currentPhase = null;
        this.mulliganCount = 0;
        this.debugEnabled = false;

        // フェーズハンドラーのマッピング
        this.phaseHandlers = new Map([
            [SetupPhase.SHUFFLE, this._handleShufflePhase.bind(this)],
            [SetupPhase.INITIAL_DEAL, this._handleInitialDealPhase.bind(this)],
            [SetupPhase.PRIZE_DEAL, this._handlePrizeDealPhase.bind(this)],
            [SetupPhase.MULLIGAN, this._handleMulliganPhase.bind(this)],
            [SetupPhase.INITIAL_SELECTION, this._handleInitialSelectionPhase.bind(this)],
            [SetupPhase.CONFIRM, this._handleConfirmPhase.bind(this)],
            [SetupPhase.GAME_START, this._handleGameStartPhase.bind(this)]
        ]);
    }

    /**
     * セットアップ全体を実行
     * @param {Object} state - 初期ゲーム状態
     * @returns {Promise<Object>} セットアップ完了後の状態
     */
    async executeFullSetup(state) {
        try {
            let currentState = cloneGameState(state);

            // セットアップフェーズを順次実行
            const phases = [
                SetupPhase.SHUFFLE,
                SetupPhase.INITIAL_DEAL,
                SetupPhase.PRIZE_DEAL,
                SetupPhase.MULLIGAN,
                SetupPhase.INITIAL_SELECTION
            ];

            for (const phase of phases) {
                if (this.debugEnabled) {
                    logger.debug(`🔄 Executing setup phase: ${phase}`);
                }

                currentState = await this._executePhase(phase, currentState);
            }

            return currentState;

        } catch (error) {
            if (error instanceof SetupError) {
                throw error;
            }
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                `Error in executeFullSetup: ${error.message}`,
                { originalError: error }
            );
        }
    }

    /**
     * 単一フェーズを実行
     * @private
     */
    async _executePhase(phase, state) {
        this.currentPhase = phase;

        const handler = this.phaseHandlers.get(phase);
        if (!handler) {
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                `Unknown setup phase: ${phase}`,
                { context: { phase } }
            );
        }

        try {
            const result = await handler(state);
            return result;
        } catch (error) {
            logger.error(`Setup phase ${phase} error:`, error);
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                `Failed to execute setup phase: ${phase}`,
                { originalError: error, phase }
            );
        } finally {
            this.currentPhase = null;
        }
    }

    /**
     * シャッフルフェーズ
     * @private
     */
    async _handleShufflePhase(state) {
        await this._animateDeckShuffle();
        return state;
    }

    /**
     * 初期手札配布フェーズ
     * @private
     */
    async _handleInitialDealPhase(state) {
        let newState = cloneGameState(state);

        // プレイヤーとCPUの初期手札をドロー（7枚ずつ）
        for (let i = 0; i < 7; i++) {
            // プレイヤーのドロー
            if (newState.players.player.deck.length > 0) {
                const playerCard = newState.players.player.deck.shift();
                newState.players.player.hand.push(playerCard);
            }

            // CPUのドロー
            if (newState.players.cpu.deck.length > 0) {
                const cpuCard = newState.players.cpu.deck.shift();
                newState.players.cpu.hand.push(cpuCard);
            }
        }

        newState = addLogEntry(newState, {
            type: 'initial_draw',
            message: '両プレイヤーが初期手札を引きました。'
        });

        // CPU初期セットアップをスケジュール
        this._scheduleCPUInitialSetup().catch(error => {
            logger.error('Error in CPU initial setup:', error);
        });

        return newState;
    }

    /**
     * サイドカード配布フェーズ
     * @private
     */
    async _handlePrizeDealPhase(state) {
        let newState = cloneGameState(state);

        // プレイヤーのサイドカード配布
        const playerPrizeCards = [];
        for (let i = 0; i < 6; i++) {
            if (newState.players.player.deck.length > 0) {
                const card = newState.players.player.deck.shift();
                playerPrizeCards.push(card);
            }
        }
        newState.players.player.prize = playerPrizeCards;
        newState.players.player.prizeRemaining = playerPrizeCards.length;

        // CPUのサイドカード配布
        const cpuPrizeCards = [];
        for (let i = 0; i < 6; i++) {
            if (newState.players.cpu.deck.length > 0) {
                const card = newState.players.cpu.deck.shift();
                cpuPrizeCards.push(card);
            }
        }
        newState.players.cpu.prize = cpuPrizeCards;
        newState.players.cpu.prizeRemaining = cpuPrizeCards.length;

        newState = addLogEntry(newState, {
            type: 'prize_cards_dealt',
            message: '両プレイヤーがサイドカード6枚を受け取りました。'
        });

        return newState;
    }

    /**
     * マリガンフェーズ
     * @private
     */
    async _handleMulliganPhase(state) {
        let newState = cloneGameState(state);

        const playerMulligan = this.validator.validateMulliganNeeded(newState, 'player');
        const cpuMulligan = this.validator.validateMulliganNeeded(newState, 'cpu');

        if (playerMulligan.needed || cpuMulligan.needed) {
            this.mulliganCount++;

            if (this.mulliganCount <= MULLIGAN_CONFIG.MAX_COUNT) {
                let mulliganMessage = '';
                if (playerMulligan.needed && cpuMulligan.needed) {
                    mulliganMessage = `双方ともたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
                } else if (playerMulligan.needed) {
                    mulliganMessage = `あなたの手札にたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
                } else {
                    mulliganMessage = `相手の手札にたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
                }

                newState = addLogEntry(newState, {
                    type: 'mulligan',
                    message: mulliganMessage
                });

                newState.prompt.message = mulliganMessage + ' 新しい手札を配り直しています...';

                // マリガン処理
                if (playerMulligan.needed) {
                    newState = await this._performMulligan(newState, 'player');
                }
                if (cpuMulligan.needed) {
                    newState = await this._performMulligan(newState, 'cpu');
                }

                // 再帰的にマリガンチェック
                return await this._handleMulliganPhase(newState);
            } else {
                logger.warn('Maximum mulligans exceeded, proceeding with current hands');
                newState = addLogEntry(newState, {
                    type: 'mulligan_limit',
                    message: `マリガン上限に達しました。現在の手札でゲームを開始します。`
                });
            }
        }

        return newState;
    }

    /**
     * 初期ポケモン選択フェーズ
     * @private
     */
    async _handleInitialSelectionPhase(state) {
        let newState = cloneGameState(state);
        newState.phase = GAME_PHASES.INITIAL_POKEMON_SELECTION;
        newState.prompt.message = 'まず手札のたねポケモンをクリックして選択し、次にバトル場またはベンチをクリックして配置してください。';

        newState = addLogEntry(newState, {
            type: 'setup_complete',
            message: 'ゲームセットアップが完了しました'
        });

        return newState;
    }

    /**
     * 確定フェーズ
     * @private
     */
    async _handleConfirmPhase(state) {
        let newState = cloneGameState(state);

        // プレイヤーのセットアップ完了チェック
        const validation = this.validator.validateSetupComplete(newState);

        if (!validation.details.playerReady) {
            throw new SetupError(
                SetupErrorType.NO_BASIC_POKEMON,
                'Player setup not complete - no Basic Pokemon in active position',
                { userMessage: 'バトル場にたねポケモンを配置してください。' }
            );
        }

        // プレイヤー確定フラグを設定
        newState.setupSelection = {
            ...newState.setupSelection,
            confirmed: true
        };

        // サイドカード配布（未配布の場合）
        const playerPrizeCount = newState.players.player.prize?.length || 0;
        if (playerPrizeCount !== 6) {
            newState = await this._handlePrizeDealPhase(newState);
        }

        // 両者準備完了チェック
        const bothReady = validation.details.playerReady &&
            validation.details.cpuReady &&
            newState.cpuSetupReady === true;

        if (bothReady) {
            newState.phase = GAME_PHASES.GAME_START_READY;
            newState.prompt.message = '両者の準備が完了しました！サイドカードを配布しています...';

            newState = addLogEntry(newState, {
                type: 'both_setup_confirmed',
                message: '両者のセットアップが完了しました。ゲーム開始準備中...'
            });
        } else {
            newState.phase = GAME_PHASES.PRIZE_CARD_SETUP;
            newState.prompt.message = 'プレイヤー確定完了。サイドカードを配布しています...';

            newState = addLogEntry(newState, {
                type: 'player_setup_confirmed',
                message: 'プレイヤーのセットアップが確定しました。CPUの準備完了を待っています...'
            });
        }

        return newState;
    }

    /**
     * ゲーム開始フェーズ
     * @private
     */
    async _handleGameStartPhase(state) {
        let newState = cloneGameState(state);

        // 全てのセットアップ用裏向きフラグを削除
        this._revealAllCards(newState);

        // フェーズをプレイヤーターンに移行
        newState.phase = GAME_PHASES.PLAYER_TURN;
        newState.turn = 1;
        newState.turnPlayer = 'player';

        newState = addLogEntry(newState, {
            type: 'game_start',
            message: 'バトル開始！全てのポケモンが公開されました！'
        });

        return newState;
    }

    /**
     * すべてのカードを公開
     * @private
     */
    _revealAllCards(state) {
        // プレイヤーのカードを公開
        if (state.players.player.active) {
            delete state.players.player.active.setupFaceDown;
        }
        state.players.player.bench.forEach(pokemon => {
            if (pokemon) delete pokemon.setupFaceDown;
        });

        // CPUのカードを公開
        if (state.players.cpu.active) {
            delete state.players.cpu.active.setupFaceDown;
        }
        state.players.cpu.bench.forEach(pokemon => {
            if (pokemon) delete pokemon.setupFaceDown;
        });
    }

    /**
     * マリガンを実行
     * @private
     */
    async _performMulligan(state, playerId) {
        let newState = cloneGameState(state);
        const playerState = newState.players[playerId];

        // 手札をデッキに戻してシャッフル
        playerState.deck.push(...playerState.hand);
        playerState.hand = [];

        // デッキをシャッフル
        this._shuffleArray(playerState.deck);

        // 新しい7枚をドロー
        for (let i = 0; i < 7; i++) {
            if (playerState.deck.length > 0) {
                const card = playerState.deck.shift();
                playerState.hand.push(card);
            }
        }

        // マリガンアニメーション
        await this._animateMulligan(playerId);

        return newState;
    }

    /**
     * CPU初期セットアップをスケジュール
     * @private
     */
    async _scheduleCPUInitialSetup() {
        // 1.5秒待機してからCPU設定実行
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (this.gameContext.hasGameInstance()) {
            await this._executeCPUInitialSetup();
            await this._scheduleCPUFullAutoSetup();
        } else {
            throw new SetupError(
                SetupErrorType.GAME_INSTANCE_NOT_FOUND,
                'gameInstance not available for CPU initial setup'
            );
        }
    }

    /**
     * CPU初期セットアップを実行
     * @private
     */
    async _executeCPUInitialSetup() {
        try {
            const state = this.gameContext.getState();
            const newState = await this.placementHandler.placeNonBlockingCpuSetup(state);
            this.gameContext.updateState(newState);
        } catch (error) {
            logger.error('Error in CPU initial setup:', error);
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                'CPU initial setup failed',
                { originalError: error }
            );
        }
    }

    /**
     * CPU完全自動セットアップ
     * @private
     */
    async _scheduleCPUFullAutoSetup() {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (!this.gameContext.hasGameInstance()) {
                throw new SetupError(
                    SetupErrorType.GAME_INSTANCE_NOT_FOUND,
                    'gameInstance not available for CPU full auto setup'
                );
            }

            // ステートキュー経由で状態更新
            await this.gameContext.enqueueStateUpdate(async (currentState) => {
                if (!currentState.players.cpu.active) {
                    const cpuState = await this.placementHandler.placeCpuPokemon(currentState, true);
                    return cloneGameState(cpuState);
                }
                return currentState;
            }, 'CPU Pokemon placement');

            // CPUサイドカードアニメーション
            await this._scheduleCPUPrizeAnimation();

            // CPU準備完了フラグ設定
            await this.gameContext.enqueueStateUpdate(async (currentState) => {
                const cpuPrizeCount = currentState.players.cpu.prize?.length || 0;
                let newState = currentState;

                if (cpuPrizeCount !== 6) {
                    newState = await this._handlePrizeDealPhase(newState);
                }

                newState.cpuSetupReady = true;

                newState = addLogEntry(newState, {
                    type: 'setup_complete',
                    message: 'CPUの準備が完了しました。プレイヤーの確定を待っています。'
                });

                return newState;
            }, 'CPU ready flag setup');

            // 両者準備完了チェック
            this._checkBothPlayersReady();

        } catch (error) {
            logger.error('Error in CPU full auto setup:', error);
        }
    }

    /**
     * CPUサイドカードアニメーション
     * @private
     */
    async _scheduleCPUPrizeAnimation() {
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (this.gameContext.hasGameInstance()) {
            const gameInstance = this.gameContext.getGameInstance();
            if (typeof gameInstance._animateCPUPrizeCardSetup === 'function') {
                await gameInstance._animateCPUPrizeCardSetup();
            }
        }
    }

    /**
     * 両者準備完了チェック
     * @private
     */
    _checkBothPlayersReady() {
        try {
            if (!this.gameContext.hasGameInstance()) {
                return;
            }

            const gameInstance = this.gameContext.getGameInstance();
            if (typeof gameInstance._checkBothPrizeAnimationsComplete === 'function') {
                gameInstance._checkBothPrizeAnimationsComplete();
            }
        } catch (error) {
            logger.error('Error in _checkBothPlayersReady:', error);
        }
    }

    /**
     * デッキシャッフルアニメーション
     * @private
     */
    async _animateDeckShuffle() {
        const playerDeck = document.querySelector('.player-self .deck-container');
        const cpuDeck = document.querySelector('.opponent-board .deck-container');

        if (playerDeck && cpuDeck) {
            await Promise.all([
                this._shuffleDeckAnimation(playerDeck),
                this._shuffleDeckAnimation(cpuDeck)
            ]);
        }
    }

    /**
     * 単一デッキのシャッフルアニメーション
     * @private
     */
    async _shuffleDeckAnimation(deckElement) {
        return new Promise(resolve => {
            let shakeCount = 0;
            const shakeInterval = setInterval(() => {
                const offsetX = Math.random() * SHAKE_CONFIG.AMPLITUDE - SHAKE_CONFIG.AMPLITUDE / 2;
                const offsetY = Math.random() * SHAKE_CONFIG.AMPLITUDE - SHAKE_CONFIG.AMPLITUDE / 2;
                deckElement.style.transform = `translateX(${offsetX}px) translateY(${offsetY}px)`;
                shakeCount++;

                if (shakeCount >= SHAKE_CONFIG.COUNT) {
                    clearInterval(shakeInterval);
                    deckElement.style.transform = '';
                    resolve();
                }
            }, SHAKE_CONFIG.INTERVAL);
        });
    }

    /**
     * マリガンアニメーション
     * @private
     */
    async _animateMulligan(playerId) {
        const handElement = playerId === 'player'
            ? document.getElementById('player-hand')
            : document.getElementById('cpu-hand');

        if (handElement) {
            const cards = Array.from(handElement.querySelectorAll('.relative'));
            if (cards.length > 0) {
                // ✅ flow.js削除: animate.handDealで代替
                await animate.handDeal(cards, playerId);
            }
        }
    }

    /**
     * 配列シャッフルユーティリティ
     * @private
     */
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * リセット
     */
    reset() {
        this.mulliganCount = 0;
        this.currentPhase = null;
    }

    /**
     * デバッグモード設定（廃止: loggerシステムを使用）
     * @deprecated logger経由でログレベルを制御してください
     */
    setDebugMode(enabled) {
        this.debugEnabled = enabled;
        if (this.placementHandler) {
            this.placementHandler.setDebugMode(enabled);
        }
        logger.warn('setDebugMode is deprecated. Use logger configuration instead.');
    }
}
