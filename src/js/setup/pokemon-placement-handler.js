/**
 * POKEMON-PLACEMENT-HANDLER.JS - ポケモン配置処理クラス
 *
 * 目的:
 * - ポケモン配置ロジックをSetupManagerから分離
 * - プレイヤー・CPU共通のロジックを統一
 * - アニメーション連携の改善
 *
 * 設計原則:
 * - 単一責任: ポケモン配置処理のみを担当
 * - 依存性注入: GameContext経由でゲーム状態を取得
 * - テスト容易性: 純粋関数として実装
 */


import { cloneGameState, addLogEntry } from '../state.js';
import * as Logic from '../logic.js';
import { SetupError, SetupErrorType } from '../errors/setup-error.js';
import { setupStateValidator } from './setup-state-validator.js';
import { animate } from '../animation-manager.js';
import { SequentialAnimator } from '../utils/sequential-animator.js';
import { createLogger } from '../logger.js';

const logger = createLogger('PokemonPlacementHandler');

/**
 * ポケモン配置ハンドラークラス
 */
export class PokemonPlacementHandler {
    /**
     * @param {GameContext} gameContext - ゲームコンテキスト
     * @param {SetupStateValidator} validator - 状態検証クラス
     */
    constructor(gameContext, validator = null) {
        this.gameContext = gameContext;
        this.validator = validator || setupStateValidator;
    }

    /**
     * プレイヤーがポケモンを配置
     * @param {Object} state - ゲーム状態
     * @param {string} playerId - プレイヤーID
     * @param {string} cardId - カードID
     * @param {string} targetZone - 配置先 ('active' | 'bench')
     * @param {number} targetIndex - ベンチインデックス（ベンチの場合）
     * @returns {Object} 更新されたゲーム状態
     */
    async placePlayerPokemon(state, playerId, cardId, targetZone, targetIndex = 0) {
        try {
            // 状態検証
            const validation = this.validator.validateCardPlacement(
                state,
                playerId,
                cardId,
                targetZone,
                targetIndex
            );

            if (!validation.isValid) {
                const error = validation.errors[0];
                throw new SetupError(
                    error.type,
                    error.message,
                    {
                        userMessage: error.message,
                        context: error.context
                    }
                );
            }

            // 状態更新
            let newState = cloneGameState(state);
            const playerState = newState.players[playerId];

            // カードを手札から検索
            const cardIndex = playerState.hand.findIndex(
                card => card.runtimeId === cardId || card.id === cardId
            );

            if (cardIndex === -1) {
                throw new SetupError(
                    SetupErrorType.CARD_NOT_FOUND,
                    `Card ${cardId} not found in ${playerId} hand`,
                    { playerId, cardId }
                );
            }

            const card = playerState.hand[cardIndex];

            // 手札から削除
            playerState.hand.splice(cardIndex, 1);

            // セットアップフラグ付きで配置
            const cardWithSetupFlag = { ...card, setupFaceDown: true };

            // 配置実行
            if (targetZone === 'active') {
                playerState.active = cardWithSetupFlag;
                newState = addLogEntry(newState, {
                    type: 'pokemon_placement',
                    message: `${card.name_ja}をバトル場に配置しました（裏向き）`
                });
            } else if (targetZone === 'bench') {
                playerState.bench[targetIndex] = cardWithSetupFlag;
                newState = addLogEntry(newState, {
                    type: 'pokemon_placement',
                    message: `${card.name_ja}をベンチに配置しました（裏向き）`
                });
            }

            return newState;

        } catch (error) {
            if (error instanceof SetupError) {
                throw error;
            }
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                `Unexpected error in placePlayerPokemon: ${error.message}`,
                {
                    originalError: error,
                    context: { playerId, cardId, targetZone, targetIndex }
                }
            );
        }
    }

    /**
     * CPUがポケモンを配置（初期セットアップ）
     * @param {Object} state - ゲーム状態
     * @param {boolean} isInitialSetup - 初期セットアップか
     * @returns {Object} 更新されたゲーム状態
     */
    async placeCpuPokemon(state, isInitialSetup = true) {
        try {
            logger.debug(`🤖 placeCpuPokemon: Starting (isInitialSetup: ${isInitialSetup})`);

            let newState = cloneGameState(state);
            const cpuState = newState.players.cpu;

            // 基本ポケモンをフィルタリング
            const basicPokemon = cpuState.hand.filter(card =>
                card.card_type === 'Pokémon' && card.stage === 'BASIC'
            );

            if (basicPokemon.length === 0) {
                throw new SetupError(
                    SetupErrorType.NO_BASIC_POKEMON,
                    'CPU has no Basic Pokemon for setup',
                    { playerId: 'cpu' }
                );
            }

            if (isInitialSetup) {
                // 初期セットアップ: アクティブ + ベンチ
                newState = await this._placeInitialCpuPokemon(newState, basicPokemon);
            } else {
                // ゲーム中: ベンチのみ（1体）
                newState = await this._placeSingleCpuPokemon(newState, basicPokemon);
            }

            return newState;

        } catch (error) {
            if (error instanceof SetupError) {
                throw error;
            }
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                `Unexpected error in placeCpuPokemon: ${error.message}`,
                { originalError: error, context: { isInitialSetup } }
            );
        }
    }

    /**
     * CPU初期ポケモン配置（アクティブ+ベンチ）
     * @private
     */
    async _placeInitialCpuPokemon(state, basicPokemon) {
        let newState = cloneGameState(state);

        // すでにアクティブポケモンがいる場合はスキップ
        if (newState.players.cpu.active) {
            return newState;
        }

        // SequentialAnimator を使用して順次配置
        const animator = new SequentialAnimator({
            defaultDelay: 800,
            stopOnError: false,
            onTaskError: (task, error) => {
                logger.error(`CPU placement task ${task.id} failed:`, error);
                throw new SetupError(
                    SetupErrorType.UNEXPECTED_ERROR,
                    `CPU placement task ${task.id} failed`,
                    { originalError: error, taskId: task.id }
                );
            }
        });

        // アクティブポケモン配置
        const activeCandidate = basicPokemon[0];
        animator.add('place-active', async () => {
            newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);

            if (newState.players.cpu.active) {
                newState.players.cpu.active.setupFaceDown = true;

                // アニメーション実行
                // ✅ flow.js削除: animate.cardMoveを使用
                await animate.cardMove('cpu', activeCandidate.id, 'hand->active', {
                    isSetupPhase: true,
                    card: activeCandidate
                });
            }
        }, { delay: 0 });

        // ベンチポケモン配置（残りの基本ポケモン、最大5体）
        const remainingBasic = basicPokemon.slice(1);
        let benchCount = 0;

        for (const pokemon of remainingBasic) {
            if (benchCount >= 5) break;

            const benchIndex = benchCount;
            animator.add(`place-bench-${benchIndex}`, async () => {
                // 最新の状態を取得（状態更新が必要）
                const currentState = this.gameContext.getState();
                let updatedState = Logic.placeCardOnBench(currentState, 'cpu', pokemon.id, benchIndex);

                if (updatedState.players.cpu.bench[benchIndex]) {
                    updatedState.players.cpu.bench[benchIndex].setupFaceDown = true;

                    // 状態を更新
                    this.gameContext.updateState(updatedState);
                    newState = updatedState;

                    // アニメーション実行
                    // ✅ flow.js削除: animate.cardMoveを使用
                    await animate.cardMove('cpu', pokemon.id, 'hand->bench', {
                        isSetupPhase: true,
                        benchIndex: benchIndex,
                        card: pokemon
                    });
                }
            }, { delay: 600 });

            benchCount++;
        }

        // アニメーション実行
        await animator.run();

        newState = addLogEntry(newState, {
            type: 'cpu_setup',
            message: `CPUが初期ポケモンを配置しました（バトル場: ${newState.players.cpu.active?.name_ja || '不明'}, ベンチ: ${benchCount}体）`
        });

        return newState;
    }

    /**
     * CPU単体ポケモン配置（ゲーム中）
     * @private
     */
    async _placeSingleCpuPokemon(state, basicPokemon) {
        let newState = cloneGameState(state);
        const cpuState = newState.players.cpu;

        // 空いているベンチを探す
        const emptyBenchIndex = cpuState.bench.findIndex(slot => slot === null);

        if (emptyBenchIndex === -1) {
            throw new SetupError(
                SetupErrorType.BENCH_FULL,
                'CPU bench is full',
                { playerId: 'cpu' }
            );
        }

        const selectedPokemon = basicPokemon[0];

        // 配置実行
        newState = Logic.placeCardOnBench(newState, 'cpu', selectedPokemon.id, emptyBenchIndex);

        // アニメーション実行
        // ✅ flow.js削除: animate.cardMoveを使用
        await animate.cardMove('cpu', selectedPokemon.id, 'hand->bench', {
            isSetupPhase: false,
            benchIndex: emptyBenchIndex,
            card: selectedPokemon
        });

        newState = addLogEntry(newState, {
            type: 'pokemon_played',
            player: 'cpu',
            message: 'CPUがたねポケモンをベンチに出しました'
        });

        return newState;
    }

    /**
     * 非ブロッキングCPUセットアップ（setInterval代替）
     * SequentialAnimatorを使用して安全に実装
     * @param {Object} state - ゲーム状態
     * @returns {Promise<Object>} 更新されたゲーム状態
     */
    async placeNonBlockingCpuSetup(state) {
        try {
            const cpuState = state.players.cpu;

            // すでにアクティブポケモンがいる場合はスキップ
            if (cpuState.active) {
                return state;
            }

            const basicPokemon = cpuState.hand.filter(card =>
                card.card_type === 'Pokémon' && card.stage === 'BASIC'
            );

            if (basicPokemon.length === 0) {
                throw new SetupError(
                    SetupErrorType.NO_BASIC_POKEMON,
                    'CPU has no Basic Pokemon for setup',
                    { playerId: 'cpu' }
                );
            }

            // SequentialAnimator で1枚ずつ順次配置
            const animator = new SequentialAnimator({
                defaultDelay: 1200,
                stopOnError: false
            });

            let currentState = state;

            for (let i = 0; i < basicPokemon.length; i++) {
                const pokemon = basicPokemon[i];

                animator.add(`cpu-card-${i}`, async () => {
                    // 最新の状態を取得
                    currentState = this.gameContext.getState();

                    if (i === 0) {
                        // アクティブに配置
                        const beforeRect = this._captureCardRect('cpu', pokemon.id);
                        currentState = Logic.placeCardInActive(currentState, 'cpu', pokemon.id);

                        if (currentState.players.cpu.active) {
                            currentState.players.cpu.active.setupFaceDown = true;

                            // 状態更新
                            this.gameContext.updateState(currentState);

                            // DOM更新を待つ
                            await new Promise(resolve => requestAnimationFrame(resolve));

                            // アニメーション
                            // ✅ flow.js削除: animate.cardMoveを使用
                            await animate.cardMove('cpu', pokemon.id, 'hand->active', {
                                isSetupPhase: true,
                                card: pokemon
                            });
                        }
                    } else {
                        // ベンチに配置
                        const benchIndex = i - 1;
                        if (benchIndex < 5) {
                            const beforeRect = this._captureCardRect('cpu', pokemon.id);
                            currentState = Logic.placeCardOnBench(currentState, 'cpu', pokemon.id, benchIndex);

                            if (currentState.players.cpu.bench[benchIndex]) {
                                currentState.players.cpu.bench[benchIndex].setupFaceDown = true;

                                // 状態更新
                                this.gameContext.updateState(currentState);

                                // DOM更新を待つ
                                await new Promise(resolve => requestAnimationFrame(resolve));

                                // アニメーション
                                // ✅ flow.js削除: animate.cardMoveを使用
                                await animate.cardMove('cpu', pokemon.id, 'hand->bench', {
                                    isSetupPhase: true,
                                    benchIndex: benchIndex,
                                    card: pokemon
                                });
                            }
                        }
                    }
                });
            }

            await animator.run();

            return currentState;

        } catch (error) {
            if (error instanceof SetupError) {
                throw error;
            }
            throw new SetupError(
                SetupErrorType.UNEXPECTED_ERROR,
                `Error in placeNonBlockingCpuSetup: ${error.message}`,
                { originalError: error }
            );
        }
    }

    /**
     * カードの現在位置を取得
     * @private
     */
    _captureCardRect(playerId, cardId) {
        const handElement = document.getElementById(`${playerId}-hand`);
        if (!handElement) return null;

        const cardElement = handElement.querySelector(
            `[data-runtime-id="${cardId}"], [data-card-id="${cardId}"]`
        );

        return cardElement ? cardElement.getBoundingClientRect() : null;
    }

    /**
     * デバッグモード設定（廃止: loggerシステムを使用）
     * @deprecated logger経由でログレベルを制御してください
     */
    setDebugMode(enabled) {
        logger.warn('setDebugMode is deprecated. Use logger configuration instead.');
    }
}
