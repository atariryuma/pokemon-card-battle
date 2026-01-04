import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';
import { animate } from './animation-manager.js';
import { phaseManager, GAME_PHASES } from './phase-manager.js';
import { BUTTON_IDS, ACTION_BUTTON_GROUPS } from './ui-constants.js';
import { errorHandler, ERROR_TYPES } from './error-handler.js';
import { setupManager } from './setup-manager.js';
import { turnManager } from './turn-manager.js';
import { loadCardsFromJSON } from './data-manager.js';
import { addLogEntry } from './state.js';
import { modalManager } from './modal-manager.js';
import { ZIndexManager } from './z-index-constants.js';
import { memoryManager } from './memory-manager.js';
import { actionHUDManager } from './action-hud-manager.js';
import { noop } from './utils.js';
import { soundManager } from './sound-manager.js';
import { inputManager } from './input-manager.js';
import { stateQueue } from './state-queue.js';

// 新しいアーキテクチャのインポート
import { gameContext } from './core/game-context.js';
import { eventBus, GameEventTypes } from './core/event-bus.js';
import { GAME_CONFIG } from './constants/game-config.js';

export class Game {
    constructor(rootEl, playmatSlotsData) {
        this.rootEl = rootEl;
        this.state = null;
        this.view = null;
        this.playmatSlotsData = playmatSlotsData;
        this.debugEnabled = false; // デバッグログ制御フラグ

        // Game managers
        this.phaseManager = phaseManager;
        this.setupManager = setupManager;
        this.turnManager = turnManager;
        // unifiedAnimationManager は廃止（flow経由に統一）
        this.animate = animate;
        this.actionHUDManager = actionHUDManager;

        // Selected card for setup
        this.selectedCardForSetup = null;

        // ✅ Animation control flags（統一管理）
        this.animationStatus = {
            setupExecuted: false,           // セットアップアニメーション完了
            prizePlayerDealt: false,        // プレイヤーサイド配布完了
            prizeCpuDealt: false,           // CPUサイド配布完了
            cardRevealExecuted: false       // カード公開アニメーション完了
        };

        // レンダリング最適化用
        this.renderQueue = [];
        this.isRenderScheduled = false;
        this.lastRenderState = null;

        // アニメーション同期システム
        this.animationQueue = [];
        this.isAnimating = false;
        this.animationPromises = new Set();
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    /**
     * アニメーションキューマネージャー
     * @param {string} animationId - アニメーション識別子
     * @param {Function} animationFunction - 実行するアニメーション関数
     * @returns {Promise} アニメーション完了Promise
     */
    async _queueAnimation(animationId, animationFunction) {
        return new Promise((resolve, reject) => {
            const animationTask = {
                id: animationId,
                execute: animationFunction,
                resolve,
                reject
            };

            this.animationQueue.push(animationTask);
            this._processAnimationQueue();
        });
    }

    /**
     * アニメーションキューの処理
     */
    async _processAnimationQueue() {
        if (this.isAnimating || this.animationQueue.length === 0) {
            return;
        }

        this.isAnimating = true;
        const task = this.animationQueue.shift();

        try {
            noop(`🎬 Starting animation: ${task.id}`);
            await task.execute();
            noop(`✅ Animation completed: ${task.id}`);
            task.resolve();
        } catch (error) {
            console.error(`❌ Animation failed: ${task.id}`, error);
            task.reject(error);
        } finally {
            this.isAnimating = false;
            // 次のアニメーションを処理
            if (this.animationQueue.length > 0) {
                setTimeout(() => this._processAnimationQueue(), 100);
            }
        }
    }

    resetAnimationFlags() {
        this.animationStatus = {
            setupExecuted: false,
            prizePlayerDealt: false,
            prizeCpuDealt: false,
            cardRevealExecuted: false
        };
        noop('🔄 Animation flags reset');
    }

    /**
     * 状態検証システム - ゲーム状態の整合性をチェック
     * @param {Object} state - 検証対象のゲーム状態
     * @param {string} context - 検証コンテキスト（エラー追跡用）
     * @returns {Object} 検証結果と修正済み状態
     */
    _validateGameState(state, context = 'unknown') {
        const validationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            fixedState: state
        };

        if (!state) {
            validationResult.isValid = false;
            validationResult.errors.push('State is null or undefined');
            return validationResult;
        }

        // プレイヤー状態の検証
        ['player', 'cpu'].forEach(playerId => {
            const playerResult = this._validatePlayerState(state.players?.[playerId], playerId, context);
            validationResult.errors.push(...playerResult.errors);
            validationResult.warnings.push(...playerResult.warnings);

            if (playerResult.fixedPlayerState) {
                validationResult.fixedState.players[playerId] = playerResult.fixedPlayerState;
            }
        });

        // ゲーム全体状態の検証
        const globalResult = this._validateGlobalState(state, context);
        validationResult.errors.push(...globalResult.errors);
        validationResult.warnings.push(...globalResult.warnings);

        validationResult.isValid = validationResult.errors.length === 0;

        if (validationResult.errors.length > 0) {
            console.error(`❌ State validation failed in ${context}:`, validationResult.errors);
        }
        if (validationResult.warnings.length > 0) {
            console.warn(`⚠️ State validation warnings in ${context}:`, validationResult.warnings);
        }

        return validationResult;
    }

    /**
     * プレイヤー状態の検証
     */
    _validatePlayerState(playerState, playerId, context) {
        const result = {
            errors: [],
            warnings: [],
            fixedPlayerState: null
        };

        if (!playerState) {
            result.errors.push(`Player ${playerId} state is missing`);
            return result;
        }

        let fixed = false;
        const fixedState = { ...playerState };

        // 手札の検証と修復
        if (!Array.isArray(playerState.hand)) {
            result.warnings.push(`Player ${playerId} hand is not an array, fixing`);
            fixedState.hand = [];
            fixed = true;
        }

        // デッキの検証と修復
        if (!Array.isArray(playerState.deck)) {
            result.warnings.push(`Player ${playerId} deck is not an array, fixing`);
            fixedState.deck = [];
            fixed = true;
        }

        // ベンチの検証と修復
        if (!Array.isArray(playerState.bench)) {
            result.warnings.push(`Player ${playerId} bench is not an array, fixing`);
            fixedState.bench = new Array(5).fill(null);
            fixed = true;
        } else if (playerState.bench.length !== 5) {
            result.warnings.push(`Player ${playerId} bench length incorrect (${playerState.bench.length}), fixing to 5`);
            fixedState.bench = [...playerState.bench];
            while (fixedState.bench.length < 5) fixedState.bench.push(null);
            if (fixedState.bench.length > 5) fixedState.bench = fixedState.bench.slice(0, 5);
            fixed = true;
        }

        // サイドカードの検証と修復
        if (!Array.isArray(playerState.prize)) {
            result.warnings.push(`Player ${playerId} prize is not an array, fixing`);
            fixedState.prize = new Array(6).fill(null);
            fixed = true;
        } else if (playerState.prize.length !== 6) {
            result.warnings.push(`Player ${playerId} prize length incorrect (${playerState.prize.length}), fixing to 6`);
            fixedState.prize = [...playerState.prize];
            while (fixedState.prize.length < 6) fixedState.prize.push(null);
            if (fixedState.prize.length > 6) fixedState.prize = fixedState.prize.slice(0, 6);
            fixed = true;
        }

        // 捨て札の検証と修復
        if (!Array.isArray(playerState.discard)) {
            result.warnings.push(`Player ${playerId} discard is not an array, fixing`);
            fixedState.discard = [];
            fixed = true;
        }

        // prizeRemainingの検証と修復
        if (typeof playerState.prizeRemaining !== 'number' || playerState.prizeRemaining < 0 || playerState.prizeRemaining > 6) {
            const actualRemaining = fixedState.prize.filter(p => p !== null).length;
            result.warnings.push(`Player ${playerId} prizeRemaining incorrect, fixing to ${actualRemaining}`);
            fixedState.prizeRemaining = actualRemaining;
            fixed = true;
        }

        if (fixed) {
            result.fixedPlayerState = fixedState;
        }

        return result;
    }

    /**
     * グローバル状態の検証
     */
    _validateGlobalState(state, context) {
        const result = {
            errors: [],
            warnings: []
        };

        // フェーズの検証
        if (!state.phase || typeof state.phase !== 'string') {
            result.errors.push('Game phase is missing or invalid');
        }

        // ターン数の検証
        if (typeof state.turn !== 'number' || state.turn < 1) {
            result.warnings.push(`Turn number invalid (${state.turn}), should be >= 1`);
        }

        // プロンプトメッセージの検証
        if (!state.prompt || typeof state.prompt.message !== 'string') {
            result.warnings.push('Prompt message is missing or invalid');
        }

        return result;
    }

    /**
     * 包括的デバッグログシステム
     * @param {string} category - ログカテゴリ
     * @param {string} message - ログメッセージ
     * @param {Object} data - 追加データ
     */
    _debugLog(category, message, data = null) {
        if (!this.debugEnabled) return;

        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `[${timestamp}] 🔍 ${category.toUpperCase()}:`;

        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    /**
     * エラー回復機能 - 中断されたフローの自動復旧
     */
    async _recoverFromError(error, context) {
        console.error(`❌ Error in ${context}:`, error);

        // ActionHUDの状態をリセット
        if (this.actionHUDManager) {
            this.actionHUDManager.resetAllButtonStates();
        }

        // アニメーションキューをクリア
        this.animationQueue = [];
        this.isAnimating = false;

        // 基本的なエラーメッセージをユーザーに表示
        if (this.view) {
            // 予期せぬエラーからの回復時もエラートーストで通知
            this.view.showCustomToast('エラーが発生しましたが、ゲームを続行します。', 'error');
        }

        // 状態の検証と修復を試行
        if (this.state) {
            const validation = this._validateGameState(this.state, `error-recovery-${context}`);
            this.state = validation.fixedState;
        }

        this._debugLog('error-recovery', `Recovery attempted for ${context}`, {
            error: error.message,
            currentPhase: this.state?.phase
        });
    }

    async init() {
        // 📦 Load card data first
        try {
            await loadCardsFromJSON();
        } catch (error) {
            await errorHandler.handleError(error, ERROR_TYPES.NETWORK);
            return;
        }

        try {
            // アニメーションフラグをリセット
            this.resetAnimationFlags();

            this.state = createInitialState();

            // Initialize view
            this.view = new View(this.rootEl);
            this.view.bindCardClick(this._handleCardClick.bind(this));
            this.view.bindDragAndDrop(this._handleDragDrop.bind(this));
            this.view.setConfirmSetupButtonHandler(this._handleConfirmSetup.bind(this));

            // ✅ Three.js初期化を完了まで待機（最重要修正）
            console.log('⏳ Waiting for Three.js initialization...');
            const threeJSReady = await this.view.initThreeJS(this.playmatSlotsData);
            if (threeJSReady) {
                console.log('✅ Three.js 3D View ready - Animation system active');
                this.view.bindThreeJSDragDrop(this._handleDragDrop.bind(this));
            } else {
                throw new Error('Three.js initialization failed');
            }

            // Initialize ActionHUDManager and setup initial buttons
            this.actionHUDManager.init();

            // Setup action button event handlers
            this._setupActionButtonHandlers();

            // ✅ Three.js初期化後にレンダリング（順序保証）
            console.log('🎨 Rendering initial game state with deck...');
            this.view.render(this.state);
            console.log('✅ Initial render complete');

            // Show game start message and enable action HUD button
            this.view.showGameMessage('手札を7枚引くボタンを押してゲームを開始してください。');

            // ✅ リファクタリング: GameContextにすべての依存を登録
            gameContext.registerGameInstance(this);
            gameContext.registerStateQueue(stateQueue);
            gameContext.registerAnimationManager(animate);
            gameContext.registerSetupManager(setupManager);

            console.log('✅ GameContext initialized with all dependencies');

            // ✅ イベント駆動アーキテクチャ: ゲーム初期化完了を通知
            eventBus.emit(GameEventTypes.GAME_INITIALIZED, {
                state: this.state,
                timestamp: Date.now()
            });
            console.log('📡 EventBus: GAME_INITIALIZED event emitted');

            // ✅ Critical #5: 状態キューシステムの初期化
            stateQueue.setCurrentState(this.state);
            stateQueue.setStateUpdateCallback((newState) => {
                this._updateState(newState, 'stateQueue');
            });

            // カードエディタからの更新を監視
            this._setupCardDataListener();

            // Initialize sound and input managers
            this._setupSoundAndInputManagers();

            // システムメンテナンス開始
            this._scheduleSystemMaintenance();

            // FOUC防止: ゲーム準備完了
            setTimeout(() => {
                document.body.classList.add('game-ready');
            }, 100);
        } catch (error) {
            await errorHandler.handleError(error, ERROR_TYPES.SETUP_FAILED);
        }
    } // End of init

    /**
     * カードエディタからのデータ更新を監視
     * cardDataUpdatedイベントを受信して、ゲーム内のカードデータを同期
     */
    _setupCardDataListener() {
        noop('🔗 Setting up card data listener for editor integration...');

        // cardDataUpdatedイベントのリスナーを設定
        window.addEventListener('cardDataUpdated', async (event) => {
            try {
                const { cards } = event.detail;
                noop(`🔄 Card data updated: ${cards.length} cards available`);

                // ゲームが初期化されている場合のみ処理
                if (this.state && this.state.deck) {
                    await this._handleCardDataUpdate(cards);
                } else {
                    noop('⏳ Game not initialized yet, card data will be used on next game start');
                }
            } catch (error) {
                console.error('❌ Failed to handle card data update:', error);
                errorHandler.handleError(error, 'card_data_sync_failed');
            }
        });

        noop('✅ Card data listener setup completed');
    }

    /**
     * カードデータ更新の処理
     * @param {Array} updatedCards - 更新されたカードデータ配列
     */
    async _handleCardDataUpdate(updatedCards) {
        noop('📦 Processing card data update...');

        // 現在のゲーム状態に応じた処理
        const currentPhase = this.phaseManager.getCurrentPhase();

        if (currentPhase === GAME_PHASES.SETUP || currentPhase === GAME_PHASES.INITIAL) {
            // セットアップフェーズ中なら、次回のデッキ構築で反映
            noop('🔧 Game in setup phase, cards will be available for deck building');
        } else if (currentPhase === GAME_PHASES.PLAYING) {
            // ゲーム中の場合、プレイヤーにカードデータ更新を通知
            this.view.showGameMessage('カードデータが更新されました。次のゲームから新しいカードが利用できます。');
        }

        // UIにカード更新通知（必要に応じて）
        if (typeof this.view.showCardUpdateNotification === 'function') {
            this.view.showCardUpdateNotification(updatedCards.length);
        }

        noop(`✅ Card data update processed: ${updatedCards.length} cards`);
    }

    /**
     * モーダルからトリガーされるセットアップ開始
     */
    async triggerInitialSetup() {
        // 実際のセットアップ開始
        await this._startGameSetup();
    }


    /**
     * バッチレンダリングシステム - 複数の状態更新を1回のレンダリングにまとめる
     */
    _scheduleRender() {
        if (this.isRenderScheduled) return;

        this.isRenderScheduled = true;
        requestAnimationFrame(() => {
            this._performBatchRender();
            this.isRenderScheduled = false;
        });
    }

    _performBatchRender() {
        if (!this.state) return;

        // 差分チェック：前回のレンダリング状態と比較
        if (this._hasStateChanged(this.lastRenderState, this.state)) {
            this.view.render(this.state);
            this._updateUI();
            this.lastRenderState = this._cloneStateForComparison(this.state);
        }
    }

    _hasStateChanged(oldState, newState) {
        if (!oldState || !newState) return true;

        // 主要な描画に影響する状態のみをチェック
        const checkFields = [
            'phase', 'turn', 'turnPlayer', 'players.player.hand.length',
            'players.player.active?.id', 'players.player.bench.length',
            'players.cpu.hand.length', 'players.cpu.active?.id', 'players.cpu.bench.length'
        ];

        return checkFields.some(field => {
            const oldValue = this._getNestedProperty(oldState, field);
            const newValue = this._getNestedProperty(newState, field);
            return oldValue !== newValue;
        });
    }

    _getNestedProperty(obj, path) {
        return path.split('.').reduce((current, prop) => {
            if (prop.includes('?')) {
                const [key] = prop.split('?');
                return current?.[key];
            }
            return current?.[prop];
        }, obj);
    }

    _cloneStateForComparison(state) {
        // 軽量な状態複製（描画比較用）
        return {
            phase: state.phase,
            turn: state.turn,
            turnPlayer: state.turnPlayer,
            players: {
                player: {
                    hand: { length: state.players.player.hand.length },
                    active: state.players.player.active ? { id: state.players.player.active.id } : null,
                    bench: { length: state.players.player.bench.length }
                },
                cpu: {
                    hand: { length: state.players.cpu.hand.length },
                    active: state.players.cpu.active ? { id: state.players.cpu.active.id } : null,
                    bench: { length: state.players.cpu.bench.length }
                }
            }
        };
    }

    /**
     * 状態検証と修復を実行
     * @private
     */
    _validateAndFixState(newState, context) {
        const validation = this._validateGameState(newState, context);
        if (!validation.isValid) {
            console.error(`❌ Critical state validation error in ${context}, attempting recovery`);
            // 重大なエラーの場合、前の状態を保持
            if (this.state) {
                console.warn('⚠️ Keeping previous state due to validation failure');
                return null;
            }
        }
        return validation.fixedState;
    }

    /**
     * 状態適用とフェーズ遷移処理
     * @private
     */
    async _applyStateUpdate(validatedState, previousPhase) {
        // 修復された状態を使用
        this.state = validatedState;

        // ✅ Critical #5: 状態キューにも最新状態を反映
        if (stateQueue) {
            stateQueue.setCurrentState(validatedState);
        }

        // Update phase manager
        const oldPhase = this.phaseManager.currentPhase;
        this.phaseManager.currentPhase = validatedState.phase;

        // フェーズ遷移アニメーション（必要な場合のみ）
        if (oldPhase !== validatedState.phase) {
            await this.animate.changePhase(oldPhase, validatedState.phase);
            // フェーズ変更時のActionHUD制御
            this._handlePhaseTransition(oldPhase, validatedState.phase);
        }

        // Handle CPU prize selection
        if (this.state.phase === GAME_PHASES.PRIZE_SELECTION && this.state.playerToAct === 'cpu') {
            this.state = await this._handleCpuPrizeSelection();
        }

        // Handle CPU auto-selection after knockout
        if (this.state.needsCpuAutoSelect) {
            this.state = await this.turnManager.handleCpuAutoNewActive(this.state);
        }
    }

    /**
     * 状態変更後の処理（レンダリング、イベント発行）
     * @private
     */
    _finalizeStateUpdate(validatedState, previousPhase, context) {
        // バッチレンダリングをスケジュール（即座に実行せず、まとめて処理）
        this._scheduleRender();

        // スマートActionHUDシステム: プレイヤーのターンでボタンを更新
        if (validatedState.phase === GAME_PHASES.PLAYER_MAIN &&
            validatedState.turnPlayer === 'player') {
            // レンダリング後に非同期でボタンを更新
            requestAnimationFrame(() => {
                this._updateSmartActionButtons();
            });
        }

        // デバッグログ（重要な状態変更のみ）
        if (previousPhase !== validatedState.phase) {
            noop(`🔄 State updated in ${context}: ${previousPhase} → ${validatedState.phase}`);
        }

        // ✅ イベント駆動アーキテクチャ: 状態更新を通知
        eventBus.emit(GameEventTypes.STATE_UPDATED, {
            state: validatedState,
            previousPhase,
            context,
            timestamp: Date.now()
        });

        // ✅ フェーズ変更イベントを発行
        if (previousPhase !== validatedState.phase) {
            eventBus.emit(GameEventTypes.PHASE_CHANGED, {
                oldPhase: previousPhase,
                newPhase: validatedState.phase,
                turnPlayer: validatedState.turnPlayer,
                timestamp: Date.now()
            });
        }
    }

    /**
     * メイン状態更新メソッド（リファクタリング済み）
     * 単一責任原則に従い、3つの小関数に処理を委譲
     */
    async _updateState(newState, context = 'updateState') {
        const previousPhase = this.state?.phase;

        // 1. 状態検証と修復
        const validatedState = this._validateAndFixState(newState, context);
        if (!validatedState) return;

        // 2. 状態適用とフェーズ遷移処理
        await this._applyStateUpdate(validatedState, previousPhase);

        // 3. 状態変更後の処理（レンダリング、イベント発行）
        this._finalizeStateUpdate(validatedState, previousPhase, context);
    } // End of _updateState

    /**
     * フェーズ遷移時のActionHUD制御 - シンプル版
     */
    _handlePhaseTransition(oldPhase, newPhase) {
        noop(`🎯 Phase transition: ${oldPhase} → ${newPhase}`);

        // 戦闘ボタンは自動表示しない（手動制御）
        switch (newPhase) {
            case GAME_PHASES.PLAYER_DRAW:
            case GAME_PHASES.CPU_TURN:
            case GAME_PHASES.CPU_MAIN:
            case GAME_PHASES.CPU_ATTACK:
                // ドローフェーズ・CPUターン: すべて非表示
                this.actionHUDManager.hideAllButtons();
                break;
        }
    }

    /**
     * 統一されたアニメーション実行システム
     * 状態更新→アニメーション→最終レンダリングの順序を保証
     */
    async _executeAnimationSequence(sequence) {
        if (this.isAnimating) {
            // 既存のアニメーションが完了するまで待機
            await Promise.all(Array.from(this.animationPromises));
        }

        this.isAnimating = true;

        try {
            for (const step of sequence) {
                switch (step.type) {
                    case 'pre-render':
                        // 状態更新（アニメーション前）
                        if (step.stateUpdate) {
                            this.state = step.stateUpdate(this.state);
                        }
                        break;

                    case 'animation':
                        // アニメーション実行
                        if (step.animation) {
                            const animPromise = step.animation();
                            this.animationPromises.add(animPromise);
                            try {
                                await animPromise;
                            } catch (error) {
                                console.warn('Animation promise rejected:', error);
                            } finally {
                                this.animationPromises.delete(animPromise);
                            }
                        }
                        break;

                    case 'post-render':
                        // 最終レンダリング
                        this._scheduleRender();
                        if (step.callback) {
                            step.callback();
                        }
                        break;

                    case 'delay':
                        // 必要に応じた待機
                        if (step.duration) {
                            await this._delay(step.duration);
                        }
                        break;
                }
            }
        } catch (error) {
            console.error('Animation sequence error:', error);
            this._handleAnimationError(error);
        } finally {
            this.isAnimating = false;
        }
    }

    /**
     * 便利メソッド：状態更新とアニメーションを統合
     */
    async _updateStateWithAnimation(newState, animationFn, options = {}) {
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: () => newState
            },
            {
                type: 'animation',
                animation: animationFn
            },
            {
                type: 'post-render',
                callback: options.onComplete
            }
        ];

        await this._executeAnimationSequence(sequence);
    }

    /**
     * バトルステップ統一処理
     */
    async _processBattleStep(stepType, data) {
        const stepHandlers = {
            'damage': this._handleDamageStep.bind(this),
            'knockout': this._handleKnockoutStep.bind(this),
            'energy-attach': this._handleEnergyAttachStep.bind(this),
            'retreat': this._handleRetreatStep.bind(this),
            'card-play': this._handleCardPlayStep.bind(this)
        };

        const handler = stepHandlers[stepType];
        if (!handler) {
            console.warn(`Unknown battle step type: ${stepType}`);
            return this.state;
        }

        return await handler(data);
    }

    async _handleDamageStep(data) {
        const { damage, targetId, attackerType } = data;
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.applyDamage(state, targetId, damage)
            },
            {
                type: 'animation',
                animation: () => this.animate.attackSequence(attackerType, damage, targetId)
            },
            {
                type: 'post-render'
            }
        ];

        await this._executeAnimationSequence(sequence);
        return this.state;
    }

    async _handleKnockoutStep(data) {
        const { pokemonId } = data;
        const sequence = [
            {
                type: 'animation',
                animation: () => this.animate.knockout(pokemonId)
            },
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.handleKnockout(state, pokemonId)
            },
            {
                type: 'post-render'
            }
        ];

        await this._executeAnimationSequence(sequence);
        return this.state;
    }

    async _handleEnergyAttachStep(data) {
        const { energyId, pokemonId } = data;
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.attachEnergy(state, 'player', energyId, pokemonId)
            },
            {
                type: 'animation',
                animation: () => this.animate.energyAttach(energyId, pokemonId, this.state)
            },
            {
                type: 'post-render'
            }
        ];

        await this._executeAnimationSequence(sequence);
        return this.state;
    }

    async _handleRetreatStep(data) {
        const { fromActiveId, toBenchIndex } = data;
        const sequence = [
            {
                type: 'animation',
                animation: async () => {
                    const { animateFlow } = await import('./animations/flow.js');
                    await animateFlow.activeToBench('player', toBenchIndex);
                }
            },
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.retreat(state, 'player', fromActiveId, toBenchIndex)
            },
            { type: 'post-render' }
        ];

        await this._executeAnimationSequence(sequence);
        return this.state;
    }

    async _handleCardPlayStep(data) {
        const { cardId, zone, targetIndex } = data;
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: (state) => this._updateCardPlayState(state, cardId, zone, targetIndex)
            },
            {
                type: 'animation',
                animation: async () => {
                    const { animateFlow } = await import('./animations/flow.js');
                    await animateFlow.handToZone('player', cardId, zone, targetIndex);
                }
            },
            {
                type: 'post-render'
            }
        ];

        await this._executeAnimationSequence(sequence);
        return this.state;
    }

    _handleAnimationError(error) {
        console.error('Animation error:', error);
        // エラー時のロールバック機能
        if (this.lastRenderState) {
            this.state = { ...this.lastRenderState };
            this._scheduleRender();
        }

        // エラー通知
        this.view?.showErrorMessage?.('アニメーションエラーが発生しました', 'error');
    }

    /**
     * 未使用変数とメモリクリーンアップ
     */
    _performMemoryCleanup() {
        // DOM キャッシュのクリーンアップ
        if (this.view?.domCache) {
            const cacheSize = this.view.domCache.size;
            if (cacheSize > GAME_CONFIG.MEMORY.CACHE_MAX_SIZE) {
                const entries = Array.from(this.view.domCache.entries());
                // 古いエントリーを削除（LRU方式）
                const toDelete = entries.slice(0, cacheSize - GAME_CONFIG.MEMORY.CACHE_RETAIN_SIZE);
                toDelete.forEach(([key]) => this.view.domCache.delete(key));
            }
        }

        // レンダリングキューのクリーンアップ
        if (this.renderQueue.length > GAME_CONFIG.MEMORY.RENDER_QUEUE_MAX) {
            this.renderQueue = this.renderQueue.slice(-10); // 最新10件のみ保持
        }

        // アニメーションプロミスの確認
        if (this.animationPromises.size > 0) {
            console.warn(`${this.animationPromises.size} animation promises still pending`);
        }
    }

    /**
     * パフォーマンス監視
     */
    _monitorPerformance() {
        if (performance.memory) {
            const memory = performance.memory;
            const memoryUsage = {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            };

            if (memoryUsage.used > memoryUsage.limit * 0.8) {
                console.warn('High memory usage detected:', memoryUsage);
                this._performMemoryCleanup();
            }
        }
    }

    /**
     * 定期的なシステムメンテナンス
     */
    _scheduleSystemMaintenance() {
        if (this._maintenanceInterval) {
            clearInterval(this._maintenanceInterval);
        }

        this._maintenanceInterval = setInterval(() => {
            this._performMemoryCleanup();
            this._monitorPerformance();
        }, 30000); // 30秒ごと
    }

    /**
     * アクションボタンのイベントハンドラーを設定
     */
    async _setupActionButtonHandlers() {
        if (this.debugEnabled) console.log('🔧 Setting up action button handlers');

        try {
            // ActionHUDManagerの状態を確認
            if (this.debugEnabled) console.log('🔍 ActionHUDManager initialized:', this.actionHUDManager.isInitialized);

            // 初期フェーズのボタンを表示
            this.actionHUDManager.showPhaseButtons('initial', {
                startGame: () => this._handleStartGame(),
                cardEditor: () => this._handleCardEditor()
            });

            // ボタンの表示状態をデバッグ
            if (this.debugEnabled) console.log('🔍 Start game button visible:', this.actionHUDManager.isButtonVisible('start-game-button-float'));
            if (this.debugEnabled) console.log('🔍 Card editor button visible:', this.actionHUDManager.isButtonVisible('card-editor-button-float'));

            // DOM要素の確認
            const startButton = document.getElementById('start-game-button-float');
            const editorButton = document.getElementById('card-editor-button-float');
            if (this.debugEnabled) console.log('🔍 Start button DOM element:', startButton);
            if (this.debugEnabled) console.log('🔍 Start button classes:', startButton?.className);
            if (this.debugEnabled) console.log('🔍 Editor button DOM element:', editorButton);
            if (this.debugEnabled) console.log('🔍 Editor button classes:', editorButton?.className);

            if (this.debugEnabled) console.log('✅ Action button handlers configured');
        } catch (error) {
            console.error('❌ Failed to setup action button handlers:', error);
        }
    }

    /**
     * ゲーム開始ボタンのハンドラー
     */
    async _handleStartGame() {
        // Game start initiated
        noop('🎮 Start Game button clicked');
        try {
            // 既存のゲーム開始メソッドを呼び出し
            // Starting new game setup
            await this._startNewGame();

            // ActionHUDManagerでセットアップフェーズのボタンに切り替え
            this.actionHUDManager.showPhaseButtons('setup', {
                confirmSetup: () => this._handleConfirmSetup()
            });
        } catch (error) {
            console.error('❌ Failed to start game:', error);
        }
    }

    /**
     * カードエディタボタンのハンドラー
     */
    async _handleCardEditor() {
        noop('🎴 Card Editor button clicked');
        // カードエディタページへのリダイレクト
        window.location.href = 'card_viewer.html';
    }

    /**
     * セットアップ確定ボタンのハンドラー
     */
    async _handleConfirmSetup() {
        noop('✅ Confirm Setup button clicked');
        try {
            // セットアップ完了処理（簡易実装）
            this.view.showGameMessage('セットアップが完了しました！ゲームを開始します。');
            // await this.completeSetup(); // 実装されていない場合はコメントアウト

            // セットアップ完了後は一時的にボタンを非表示（ゲーム開始準備中）
            this.actionHUDManager.hideAllButtons();
        } catch (error) {
            console.error('❌ Failed to confirm setup:', error);
        }
    }

    /**
     * にげるボタンのハンドラー
     */
    async _handleRetreat() {
        noop('🏃 Retreat button clicked');
        // にげる処理の実装
    }

    /**
     * 攻撃ボタンのハンドラー
     */
    async _handleAttack() {
        noop('⚔️ Attack button clicked');
        // 攻撃処理の実装
    }

    /**
     * ターン終了ボタンのハンドラー
     */
    async _handleEndTurn() {
        noop('🔄 End Turn button clicked');
        // ターン終了処理の実装
    }

    async _handleCardClick(dataset) {
        const { owner, zone, cardId, index } = dataset;

        // 処理中の場合はクリックを無視
        if (this.state.isProcessing) {
            return;
        }

        // ターンプレイヤーと所有者のチェック（情報表示を除く）
        if (this.state.turnPlayer === 'player' && owner === 'cpu') {
            // CPUのカードは情報表示のみ許可（アクティブ・ベンチのみ）
            if (zone === 'active' || zone === 'bench') {
                // 情報表示は将来的に実装（現在は無視）
                return;
            }
            return;
        }

        if (this.state.turnPlayer === 'cpu' && owner === 'player') {
            // CPUターン中はプレイヤーカードをクリック不可
            return;
        }
        // Handle different phases
        switch (this.state.phase) {
            case GAME_PHASES.SETUP:
            case GAME_PHASES.INITIAL_POKEMON_SELECTION:
            case GAME_PHASES.PRIZE_CARD_SETUP:  // CPUが先に準備完了した場合
                await this._handleSetupCardClick(dataset);
                break;

            case GAME_PHASES.PLAYER_DRAW:
                if (zone === 'deck') {
                    await this._handlePlayerDraw();
                } else {
                    this.view.showError('DECK_NOT_SELECTED');
                }
                break;

            case GAME_PHASES.PLAYER_MAIN:
                await this._handlePlayerMainClick(dataset);
                break;

            case GAME_PHASES.AWAITING_NEW_ACTIVE:
                if (zone === 'bench') {
                    await this._handleNewActiveSelection(parseInt(index, 10));
                }
                break;

            case GAME_PHASES.PRIZE_SELECTION:
                if (zone === 'prize' && this.state.players.player.prizesToTake > 0) {
                    await this._handlePrizeSelection(parseInt(index, 10));
                }
                break;
        }
    } // End of _handleCardClick

    /**
     * ドラッグ&ドロップ処理
     */
    async _handleDragDrop({ dragData, dropTarget }) {
        if (this.state.phase !== GAME_PHASES.PLAYER_MAIN) return;
        if (this.state.isProcessing) return;

        // ターンプレイヤーチェック
        if (this.state.turnPlayer !== 'player') {
            return;
        }

        const { cardId, cardType, owner } = dragData;

        // CPUのカードはドラッグ不可
        if (owner === 'cpu') {
            return;
        }
        const { zone: targetZone, index: targetIndex } = dropTarget;

        try {
            this.state.isProcessing = true;

            // カードタイプに応じた処理
            switch (cardType) {
                case 'Pokémon':
                    await this._handlePokemonDrop(cardId, targetZone, targetIndex);
                    break;
                case 'Energy':
                    await this._handleEnergyDrop(cardId, targetZone, targetIndex);
                    break;
                case 'Trainer':
                    this.view.showCustomToast('トレーナーカードはクリックで使用してください', 'warning');
                    break;
            }
        } catch (error) {
            console.error('Drag drop error:', error);
            this.view.showErrorMessage('カードの配置に失敗しました');
        } finally {
            this.state.isProcessing = false;
        }
    }

    /**
     * ポケモンカードのドロップ処理
     */
    async _handlePokemonDrop(cardId, targetZone, targetIndex) {
        // cardId は runtimeId を想定（互換で master id も許容）
        const card = this.state.players.player.hand.find(c => (c.runtimeId === cardId) || (c.id === cardId));
        if (!card) return;

        if (targetZone === 'bench' && card.stage === 'BASIC') {
            const newState = this.turnManager.handlePlayerMainPhase(this.state, 'place_basic', {
                cardId: card.id,
                benchIndex: parseInt(targetIndex, 10)
            });
            this._updateState(newState);
            this.view.showSuccessMessage(`${card.name_ja}をベンチに配置しました`);
        } else if (targetZone === 'active' && card.stage === 'BASIC' && !this.state.players.player.active) {
            const newState = this.turnManager.handlePlayerMainPhase(this.state, 'place_active', {
                cardId: card.id
            });
            this._updateState(newState);
            this.view.showSuccessMessage(`${card.name_ja}をバトル場に配置しました`);
        } else if (targetZone === 'active' && !this.state.players.player.active) {
            this.view.showError('INVALID_INITIAL_POKEMON');
        } else {
            this.view.showErrorMessage('そこには配置できません');
        }
    }

    /**
     * エネルギーカードのドロップ処理
     */
    async _handleEnergyDrop(cardId, targetZone, targetIndex) {
        if (this.state.turnState?.energyAttached > 0) {
            this.view.showErrorMessage('このターンはすでにエネルギーを付けています', 'warning');
            return;
        }

        let targetPokemonId = null;
        if (targetZone === 'active' && this.state.players.player.active) {
            targetPokemonId = this.state.players.player.active.runtimeId || this.state.players.player.active.id;
        } else if (targetZone === 'bench') {
            const benchPokemon = this.state.players.player.bench[parseInt(targetIndex, 10)];
            if (benchPokemon) {
                targetPokemonId = benchPokemon.runtimeId || benchPokemon.id;
            }
        }

        if (targetPokemonId) {
            // ドロップ元カードは runtimeId かもしれないため、master id に変換
            const energyMasterId = this.state.players.player.hand.find(c => (c.runtimeId === cardId) || (c.id === cardId))?.id || cardId;
            const newState = this.turnManager.handlePlayerMainPhase(this.state, 'attach_energy', {
                energyId: energyMasterId,
                pokemonId: targetPokemonId
            });
            this._updateState(newState);

            const energyCard = this.state.players.player.hand.find(c => (c.runtimeId === cardId) || (c.id === cardId));
            this.view.showSuccessMessage(`エネルギーを付けました`);
        } else {
            this.view.showErrorMessage('エネルギーはポケモンにのみ付けられます');
        }
    }

    /**
     * ゲームセットアップ開始
     */
    async _startGameSetup() {
        // アニメーション準備クラスを追加
        document.getElementById('player-hand')?.classList.add('is-preparing-animation');
        document.getElementById('cpu-hand')?.classList.add('is-preparing-animation');

        this.state = await this.setupManager.initializeGame(this.state);

        // 手札が配られたらセットアップフェーズのボタンを表示
        this.actionHUDManager.showPhaseButtons('setup', {
            confirmSetup: () => this._handleConfirmSetup()
        });

        // 単一のレンダリングサイクルで処理（二重レンダリング防止）
        this._updateState(this.state);

        // 初期セットアップ後に確定HUD表示判定
        this._showConfirmHUDIfReady();

        // DOM要素の完全な準備を確実に待つ
        this._scheduleSetupAnimations();

        // デバッグ: 手札の内容を確認（state.players存在チェック付き）
        if (!this.state || !this.state.players) {
            console.warn('⚠️ State.players not initialized for debug logging');
        }

        // 手札レンダリングはview.render()で既に処理済み
    }

    /**
     * セットアップ時のカードクリック処理
     */
    async _handleSetupCardClick(dataset) {
        const { zone, cardId, index, owner } = dataset;

        // 処理中はStateのisProcessingフラグをtrueに設定
        this.state.isProcessing = true;

        try {
            if (zone === 'hand' && cardId) {
                // 手札のカードを選択（state.players存在チェック付き）
                if (!this.state?.players?.player?.hand) {
                    console.warn('⚠️ Player hand not initialized');
                    return;
                }
                // runtimeId 優先で特定（互換で master id も許容）
                const card = this.state.players.player.hand.find(c => (c.runtimeId === cardId) || (c.id === cardId));
                if (card && card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                    this.selectedCardForSetup = card;
                    // ✅ 選択時は'select'タイプでハイライト
                    this._highlightCard(card.runtimeId || card.id, true, { type: 'select' });
                    // Three.js版: 配置可能スロットをハイライト
                    if (this.view.threeViewBridge?.isActive()) {
                        this.view.threeViewBridge.highlightSlots('active', 'player');
                        this.view.threeViewBridge.highlightSlots('bench', 'player');
                    }
                    this.state.prompt.message = `「${card.name_ja}」をバトル場かベンチに配置してください。`;
                    this.view.updateStatusMessage(this.state.prompt.message);
                } else if (card && card.card_type === 'Pokémon') {
                    // 非たねポケモンが選択された場合はトーストで警告
                    this.view.showError('INVALID_INITIAL_POKEMON');
                    // Don't log as warning since this is expected behavior
                }
                // Silently ignore Energy and Trainer cards during setup
            } else if ((zone === 'active' || zone === 'bench') && this.selectedCardForSetup && owner === 'player') {
                // 配置先を選択
                const targetIndex = zone === 'bench' ? parseInt(index, 10) : 0;

                // ✅ Three.js専用モード: DOM版は完全削除
                const cardToAnimate = this.selectedCardForSetup;

                // ✅ アニメーション実行（状態更新の前）
                await this._animateBattlePokemonPlacement(
                    cardToAnimate.runtimeId || cardToAnimate.id,
                    zone,
                    targetIndex
                );

                // 状態更新実行（手札から除外し、配置）
                const previousState = this.state;
                this.state = await this.setupManager.handlePokemonSelection(
                    this.state,
                    'player',
                    cardToAnimate.id, // ロジック層は master id で処理
                    zone,
                    targetIndex
                );

                // 状態変更が成功したか確認
                if (this.state === previousState) {
                    console.warn('⚠️ Pokemon placement failed, state unchanged');
                    return;
                }

                // state.playersの存在確認
                if (!this.state || !this.state.players || !this.state.players.player) {
                    console.warn('⚠️ State or players not properly initialized');
                    return;
                }

                // selectedCardForSetup のリセットとハイライト解除を、
                // State更新直後、Viewレンダリングの前に移動
                this.selectedCardForSetup = null;
                this._clearAllHighlights();
                // Three.js版: スロットハイライト解除
                if (this.view.threeViewBridge?.isActive()) {
                    this.view.threeViewBridge.clearHighlights();
                }
                this.state.prompt.message = '次のたねポケモンを選択するか、確定してください。';

                // ✅ Three.js専用: Viewを更新（Three.jsが自動でアニメーション）
                await this._updateState(this.state);

                // バトルポケモンが配置されている場合は確定HUDを表示
                this._showConfirmHUDIfReady();

            } else if ((zone === 'active' || zone === 'bench') && !this.selectedCardForSetup) {
                // カードが選択されていない状態でスロットをクリックした場合
                this.state = addLogEntry(this.state, { message: '先に手札からたねポケモンを選択してください。' });
            }
        } finally {
            // 処理終了後にStateのisProcessingフラグをfalseに設定
            this.state.isProcessing = false;
        }
    }

    /**
     * プレイヤードロー処理
     */
    async _handlePlayerDraw() {
        // 既存のドロー制限チェック
        if (this.state.turnState?.hasDrawn || this.state.turnState?.hasDrawn) {
            this.state = addLogEntry(this.state, { message: 'このターンはすでにカードを引いています。' });
            this.view.showError('ALREADY_DRAWN_CARD');
            return;
        }

        // 手札制限チェック（10枚上限）
        if (!Logic.canDrawCard(this.state, 'player')) {
            this.state = addLogEntry(this.state, { message: '手札が上限のためドローできません。' });
            this.view.showError('HAND_AT_LIMIT');
            return;
        }

        // 8-9枚で警告表示
        const handStatus = Logic.getHandLimitStatus(this.state, 'player');
        if (handStatus.isNearLimit && handStatus.currentSize === 8) {
            this.view.showWarning('HAND_NEAR_LIMIT_8');
        } else if (handStatus.isNearLimit && handStatus.currentSize === 9) {
            this.view.showWarning('HAND_NEAR_LIMIT_9');
        }

        // Get the player's deck element for animation
        const playerDeckElement = document.querySelector('.player-self .deck-card-element');
        if (playerDeckElement) {
            playerDeckElement.classList.add('is-drawing');
            // Add a small delay to make the lift visible before the card moves
            await new Promise(resolve => setTimeout(resolve, 150));
        }


        this.state = await this.turnManager.handlePlayerDraw(this.state);

        // ✅ イベント駆動: カードドローイベント
        const drawnCard = this.state.players.player.hand[this.state.players.player.hand.length - 1];
        eventBus.emit(GameEventTypes.CARD_DRAWN, {
            playerId: 'player',
            cardId: drawnCard?.id || 'unknown',
            zone: 'hand',
            timestamp: Date.now()
        });

        // ドロー後にメインフェーズに移行
        this.state.phase = GAME_PHASES.PLAYER_MAIN;
        this.state.prompt.message = 'カードを1枚ドローしました。少しお待ちください...';

        this._updateState(this.state);

        // After state update and re-render, remove the drawing class
        if (playerDeckElement) {
            playerDeckElement.classList.remove('is-drawing');
        }

        // ドロー完了後、メッセージ更新とメインフェーズボタン表示
        setTimeout(() => {
            this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';
            this.view.render(this.state);
            // メインフェーズのインテリジェントなボタン表示
            this._showMainPhaseButtons();
        }, 1500);
    }

    /**
     * プレイヤーメインフェーズのクリック処理
     */
    async _handlePlayerMainClick(dataset) {
        const { zone, cardId, index } = dataset;

        if (this.state.pendingAction) {
            await this._handlePendingAction(dataset);
            return;
        }

        if (zone === 'hand') {
            await this._handleHandCardClick(cardId);
        } else if (zone === 'active' || zone === 'bench') {
            await this._handleBoardPokemonClick(cardId, zone, parseInt(index, 10));
        }

        // プレイヤーがクリックしたことで能動的にプレイしていることを示すため、
        // クリック後にメインフェーズボタンを表示
        this._showMainPhaseButtons();
    }

    /**
     * 新しいアクティブポケモン選択
     */
    async _handleNewActiveSelection(benchIndex) {
        // ベンチのポケモンを取得（アニメーション用）
        const benchPokemon = this.state.players[this.state.playerToAct]?.bench[benchIndex];
        const pokemonId = benchPokemon?.runtimeId || benchPokemon?.id;

        // ✅ アニメーション実行（状態更新の前）
        if (pokemonId) {
            await this._animateBenchToActive(pokemonId, benchIndex);
        }

        // Use the new unified turnManager method
        let newState = await this.turnManager.handleNewActiveSelection(this.state, benchIndex);

        this._updateState(newState);
    }

    /**
     * CPU自動サイド選択処理
     */
    async _handleCpuPrizeSelection() {
        const cpuState = this.state.players.cpu;
        const availablePrizes = cpuState.prize
            .map((prize, index) => ({ prize, index }))
            .filter(({ prize }) => prize !== null);

        if (availablePrizes.length === 0 || cpuState.prizesToTake === 0) {
            return this.state;
        }

        // CPU思考時間をシミュレート
        await this.turnManager.simulateCpuThinking(600);

        let newState = this.state;
        let prizesToTake = cpuState.prizesToTake;

        // 必要な枚数分ランダムに選択
        for (let i = 0; i < prizesToTake && availablePrizes.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePrizes.length);
            const selectedPrize = availablePrizes.splice(randomIndex, 1)[0];

            newState = Logic.takePrizeCard(newState, 'cpu', selectedPrize.index);
            await this._animatePrizeTake('cpu', selectedPrize.index);
        }

        // Prize selection completed, check if new active selection is needed
        if (newState.players.cpu.prizesToTake === 0) {
            if (newState.knockoutContext) {
                newState = Logic.processNewActiveAfterKnockout(newState);

                // If CPU needs to auto-select, handle it immediately  
                if (newState.needsCpuAutoSelect) {
                    newState = await this.turnManager.handleCpuAutoNewActive(newState);

                    // Set appropriate phase after CPU auto-selection
                    if (newState.phase !== GAME_PHASES.GAME_OVER) {
                        if (newState.turnPlayer === 'cpu') {
                            newState.phase = GAME_PHASES.CPU_MAIN;
                        } else {
                            newState.phase = GAME_PHASES.PLAYER_MAIN;
                        }
                    }
                }
            } else {
                // No knockout context, return to normal turn flow
                if (newState.turnPlayer === 'cpu') {
                    newState.phase = GAME_PHASES.CPU_MAIN;
                } else {
                    newState.phase = GAME_PHASES.PLAYER_MAIN;
                }
            }
        }
        if (newState.turnPlayer === 'cpu' && newState.phase !== GAME_PHASES.GAME_OVER) {
            // プレイヤーと同様にサイド取得後はターンを終了し、次のプレイヤーターンへ移行
            const postState = await this.turnManager.endCpuTurn(newState);
            return postState;
        }

        return newState;
    }

    /**
     * サイドカード選択処理
     */
    async _handlePrizeSelection(prizeIndex) {
        const playerId = this.state.playerToAct;

        // Validate the selection
        if (this.state.players[playerId].prizesToTake === 0) {
            return;
        }

        if (!this.state.players[playerId].prize[prizeIndex]) {
            return;
        }

        let newState = Logic.takePrizeCard(this.state, playerId, prizeIndex);

        // Check if state actually changed
        if (newState === this.state) {
            return;
        }

        // アニメーション
        await this._animatePrizeTake(playerId, prizeIndex);

        // サイド取得後の処理
        if (newState.players[playerId].prizesToTake === 0) {
            // Prize selection completed, check if new active selection is needed
            if (newState.knockoutContext) {
                newState = Logic.processNewActiveAfterKnockout(newState);

                // If CPU needs to auto-select, handle it immediately
                if (newState.needsCpuAutoSelect) {
                    newState = await this.turnManager.handleCpuAutoNewActive(newState);

                    // Set appropriate phase after CPU auto-selection
                    if (newState.phase !== GAME_PHASES.GAME_OVER) {
                        if (newState.turnPlayer === 'cpu') {
                            newState.phase = GAME_PHASES.CPU_MAIN;
                        } else {
                            newState.phase = GAME_PHASES.PLAYER_MAIN;
                        }
                    }
                }
            } else {
                // No knockout context, return to normal turn flow
                if (newState.turnPlayer === 'player') {
                    newState.phase = GAME_PHASES.PLAYER_MAIN;
                } else {
                    newState.phase = GAME_PHASES.CPU_MAIN;
                }
            }
        }

        this._updateState(newState);
    }

    /**
     * 複数サイド選択UI表示
     */
    _showMultiplePrizeSelection(prizesToTake) {
        const availablePrizes = this.state.players.player.prize
            .map((prize, index) => ({ prize, index }))
            .filter(({ prize }) => prize !== null);

        this.view.displayModal({
            title: `サイドカード選択 (${prizesToTake}枚)`,
            message: `
                <div class="text-center p-4">
                    <p class="text-lg mb-4">取得するサイドカードを${prizesToTake}枚選んでください</p>
                    <div class="grid grid-cols-3 gap-4">
                        ${availablePrizes.map(({ prize, index }) => `
                            <div class="prize-card cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-lg p-2" 
                                 data-prize-index="${index}">
                                <img src="assets/ui/card_back.webp" alt="サイドカード" 
                                     class="w-full h-auto rounded">
                                <p class="text-xs mt-1">サイド ${index + 1}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `,
            actions: []
        });

        // サイドカードクリックイベントを追加
        setTimeout(() => {
            const prizeCards = document.querySelectorAll('.prize-card');
            let selectedPrizes = [];

            prizeCards.forEach(card => {
                card.addEventListener('click', async () => {
                    const prizeIndex = parseInt(card.dataset.prizeIndex);

                    if (selectedPrizes.includes(prizeIndex)) {
                        // 選択解除
                        selectedPrizes = selectedPrizes.filter(p => p !== prizeIndex);
                        card.classList.remove('ring-2', 'ring-green-400');
                    } else if (selectedPrizes.length < prizesToTake) {
                        // 選択追加
                        selectedPrizes.push(prizeIndex);
                        card.classList.add('ring-2', 'ring-green-400');
                    }

                    // 必要な枚数選択したら自動実行
                    if (selectedPrizes.length === prizesToTake) {
                        this.view.hideModal();

                        // 選択したサイドを順次取得
                        for (const index of selectedPrizes) {
                            await this._handlePrizeSelection(index);
                        }
                    }
                });
            });
        }, 100);
    }

    async _placeOnBench(cardId) {
        const emptyIndex = this.state.players.player.bench.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            // cardId は runtimeId の可能性があるため、master id に正規化
            const handCard = this.state.players.player.hand.find(c => (c.runtimeId === cardId) || (c.id === cardId));
            const masterId = handCard?.id || cardId;

            // ✅ アニメーション実行（状態更新の前）
            await this._animateBattlePokemonPlacement(cardId, 'bench', emptyIndex);

            const newState = Logic.placeCardOnBench(this.state, 'player', masterId, emptyIndex);

            // ✅ イベント駆動: カードプレイイベント
            eventBus.emit(GameEventTypes.CARD_PLAYED, {
                cardId: masterId,
                cardType: handCard?.card_type,
                playerId: 'player',
                fromZone: 'hand',
                toZone: 'bench',
                benchIndex: emptyIndex,
                timestamp: Date.now()
            });

            this._updateState(newState);
        } else {
            // ベンチが埋まっている場合は警告トーストを表示
            this.view.showWarning('BENCH_FULL');
        }
    } // End of _placeOnBench

    /**
     * UI更新処理
     */
    _updateUI() {
        // 基本的なUI要素の初期状態（メッセージは次のメッセージまで保持）
        this.view.hideActionButtons();

        // ゲームステータスパネルを常時更新
        this.view.updateGameStatus(this.state);
        this.view.updateSetupProgress(this.state);

        // フェーズに応じたUI表示
        switch (this.state.phase) {
            case GAME_PHASES.SETUP:
            case GAME_PHASES.INITIAL_POKEMON_SELECTION:
                this.view.showGameMessage(this.state.prompt.message);
                // 静的な確定ボタンは非表示（アクションHUDを使用）
                this.view.hideInitialPokemonSelectionUI();
                // 確定HUDの表示判定
                this._showConfirmHUDIfReady();
                break;

            case GAME_PHASES.PRIZE_CARD_SETUP:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.hideActionButtons();
                break;

            case GAME_PHASES.GAME_START_READY:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                // 重複ボタン防止: 旧「確認」ボタン(✅)は非表示にして、
                // ゲームスタート(🎮)は _checkBothPrizeAnimationsComplete() で表示管理する
                this._hideFloatingActionButton('confirm-setup-button-float');
                break;

            case GAME_PHASES.PLAYER_DRAW:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                break;

            case GAME_PHASES.PLAYER_MAIN:
                this.view.showGameMessage(this.state.prompt.message);
                // プレイヤーメインフェーズのボタンは手動制御のみ（自動表示は削除）
                break;

            case GAME_PHASES.PLAYER_ATTACK:
                this.view.showGameMessage('攻撃中...');
                break;

            case GAME_PHASES.CPU_TURN:
            case GAME_PHASES.CPU_DRAW:
            case GAME_PHASES.CPU_MAIN:
            case GAME_PHASES.CPU_ATTACK:
                this.view.showGameMessage(this.state.prompt.message);
                break;

            case GAME_PHASES.AWAITING_NEW_ACTIVE:
                if (this.state.playerToAct === 'player') {
                    this.view.showGameMessage('新しいバトルポケモンをベンチから選んでください。');
                } else {
                    this.view.showGameMessage('相手が新しいバトルポケモンを選んでいます...');
                }
                break;

            case GAME_PHASES.PRIZE_SELECTION:
                const prizesToTake = this.state.players.player.prizesToTake || 0;
                const prizeMessage = prizesToTake > 1
                    ? `サイドカードを${prizesToTake}枚選んで取ってください。`
                    : 'サイドカードを選んで取ってください。';
                this.view.showGameMessage(prizeMessage);

                // 複数枚選択の場合は選択画面を表示
                if (prizesToTake > 1) {
                    this._showMultiplePrizeSelection(prizesToTake);
                }
                break;

            case GAME_PHASES.GAME_OVER:
                this.view.showGameMessage(this.state.prompt.message);
                // ゲーム終了処理を実行
                this._handleGameOver(this.state.winner, this.state.gameEndReason);
                break;
        }

        // ペンディングアクション表示
        if (this.state.pendingAction && this.state.pendingAction.type === 'attach-energy') {
            this.view.showGameMessage('エネルギーをつけるポケモンを選んでください。');
        }
    }

    /**
     * 手札のカードクリック処理
     */
    async _handleHandCardClick(cardId) {
        const card = this.state.players.player.hand.find(c => (c.runtimeId === cardId) || (c.id === cardId));
        if (!card) return;

        if (card.card_type === 'Pokémon' && card.stage === 'BASIC') {
            // たねポケモンをベンチに出す - 既存のカード情報システムを活用
            const cardInfoHtml = this._generateBenchPlacementModal(card);
            await this.view.showInteractiveMessage(
                cardInfoHtml,
                [
                    { text: 'はい', callback: () => this._placeOnBench(card.runtimeId || card.id) },
                    { text: 'いいえ', callback: () => { } }
                ],
                'central',
                true // allowHtml = true
            );

            // XSS対策: 画像エラーハンドリング
            setTimeout(() => {
                const img = document.querySelector('.bench-placement-card-image');
                if (img) {
                    img.addEventListener('error', function () {
                        this.src = 'assets/ui/card_back.webp';
                    });
                }
            }, 0);
        } else if (card.card_type === 'Basic Energy' || card.card_type === 'Energy') {
            // エネルギーを付ける
            if (this.state.turnState?.energyAttached > 0) {
                this.state = addLogEntry(this.state, { message: 'このターンはすでにエネルギーをつけました。' });
                this.view.showErrorMessage('このターンはすでにエネルギーをつけました。', 'warning');
                return;
            }

            const energyType = card.energy_type;
            const sourceCardId = card.id;

            // 既に同じエネルギー付与アクションがペンディング中の場合、キャンセルする
            if (this.state.pendingAction &&
                this.state.pendingAction.type === 'attach-energy' &&
                this.state.pendingAction.sourceCardId === sourceCardId) {

                this.state.pendingAction = null;
                this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';
                this._clearAllHighlights(); // すべてのハイライトをクリア
                this._updateState(this.state);
                this._showMainPhaseButtons();
                return;
            }

            // 他のペンディングアクションがあればクリアし、ハイライトも一旦すべて消す
            this._clearAllHighlights();

            // エネルギー付与の新しいペンディングアクション設定
            this.state.pendingAction = {
                type: 'attach-energy',
                sourceCardId: sourceCardId,
                energyType: energyType
            };
            this.state.prompt.message = 'エネルギーをつけるポケモンを選んでください。';
            this._updateState(this.state); // ここで一度UIを更新

            // ターゲット可能なポケモンをハイライト
            this._highlightEnergyTargets(energyType);
        }
    }

    /**
     * ボード上のポケモンクリック処理
     */
    async _handleBoardPokemonClick(pokemonId, zone, index) {
        if (this.state.pendingAction && this.state.pendingAction.type === 'attach-energy') {
            // エネルギー付与実行
            await this._attachEnergy(this.state.pendingAction.sourceCardId, pokemonId);
        }
        // その他のインタラクションは今後実装
    }

    /**
     * ベンチ配置確認用モーダルのHTMLを生成（view.jsのカード情報システムを活用）
     */
    _generateBenchPlacementModal(card) {
        // カード画像部分
        const imageHtml = `
            <div class="flex-shrink-0 w-48 max-w-[35%]">
                <img src="${this._getCardImagePath(card)}"
                     alt="${card.name_ja}"
                     class="w-full h-auto max-h-72 object-contain rounded-md border border-gray-700 bench-placement-card-image" />
            </div>
        `;

        // カード詳細情報部分（view.jsのメソッドを活用）
        const cardInfoHtml = this.view._generateCardInfoHtml(card);
        const detailsHtml = `
            <div class="flex-grow text-left text-[13px] leading-snug space-y-2 min-w-0 overflow-hidden">
                ${cardInfoHtml}
            </div>
        `;

        // 確認メッセージ
        const confirmationHtml = `
            <div class="mt-4 pt-3 border-t border-gray-600 text-center">
                <p class="text-white font-bold text-base mb-2">「${card.name_ja}」をベンチに出しますか？</p>
                <p class="text-gray-400 text-sm">一度ベンチに出すとバトル場以外では取り下げることはできません。</p>
            </div>
        `;

        // 全体のレイアウト
        return `
            <div class="flex flex-col md:flex-row gap-4 items-start max-w-full overflow-hidden">
                ${imageHtml}
                ${detailsHtml}
            </div>
            ${confirmationHtml}
        `;
    }

    /**
     * カード画像パスを取得（View層と統一）
     */
    _getCardImagePath(card) {
        // data-manager.jsのgetCardImagePath関数と同じロジック
        const { getCardImagePath } = window;
        return getCardImagePath ? getCardImagePath(card.name_en, card) : 'assets/ui/card_back.webp';
    }

    /**
     * ペンディングアクション処理
     */
    async _handlePendingAction(dataset) {
        const { cardId, zone, index } = dataset;

        if (this.state.pendingAction.type === 'attach-energy' && (zone === 'active' || zone === 'bench')) {
            if (cardId) {
                await this._attachEnergy(this.state.pendingAction.sourceCardId, cardId);
            }
        } else if (this.state.pendingAction.type === 'retreat-promote' && zone === 'bench') {
            await this._performRetreat(parseInt(index, 10));
        }
    }

    /**
     * エネルギー付与処理（新統合システム使用）
     */
    async _attachEnergy(energyId, pokemonId) {
        const initialState = this.state;

        // 統合バトルステップで処理
        this.state = await this._processBattleStep('energy-attach', {
            energyId,
            pokemonId
        });

        // 状態が変更された場合の後処理
        if (this.state !== initialState) {
            this.state.pendingAction = null;
            this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';
            // エネルギー付与後は従来のメインフェーズボタンシステムを使用
            this._showMainPhaseButtons();
        }

        this._clearAllHighlights();
    }

    /**
     * にげる実行
     */
    async _performRetreat(benchIndex) {
        const active = this.state.players.player.active;
        if (!active) return;

        const { newState, discardedEnergy } = this.turnManager.handlePlayerMainPhase(this.state, 'retreat_pokemon', {
            fromActiveId: active.id,
            toBenchIndex: benchIndex
        });

        if (newState !== this.state) {
            // ✅ Three.js専用: エネルギー廃棄アニメーション
            if (discardedEnergy && discardedEnergy.length > 0) {
                await animate.energyDiscard(discardedEnergy, null, null);
            }

            newState.pendingAction = null;
            newState.prompt.message = 'あなたのターンです。アクションを選択してください。';
        }

        this._clearAllHighlights();
        this._updateState(newState);

        // にげる完了後、Action HUDを復帰
        if (newState !== this.state) {
            this._showPostRetreatButtons();
        }
    }

    /**
     * 攻撃ボタンクリック処理
     */
    _handleAttack() {
        const attacker = this.state.players.player.active;
        if (!attacker || !attacker.attacks) return;

        const usableAttacks = attacker.attacks
            .map((attack, index) => ({ ...attack, index }))
            .filter(attack => Logic.hasEnoughEnergy(attacker, attack));

        if (usableAttacks.length === 0) {
            // 使用可能なワザがない場合は警告トーストを表示
            this.view.showCustomToast('使えるワザがありません。', 'warning');
            return;
        }

        this._showBattleAttackModal(usableAttacks);
    }

    /**
     * バトル攻撃選択モーダル表示
     */
    _showBattleAttackModal(usableAttacks) {
        const attacker = this.state.players.player.active;
        const defender = this.state.players.cpu.active;

        if (!attacker || !defender) {
            // バトルに参加できるポケモンがいない場合はエラートースト
            this.view.showCustomToast('バトルできるポケモンがいません。', 'error');
            return;
        }

        // 相手ポケモンの画像パスを確実に取得
        const defenderImagePath = this._getReliableCardImagePath(defender);
        noop('🖼️ Battle modal defender image path:', defenderImagePath, 'for card:', defender.name_ja);

        // バトル画面のHTMLを構築（右側に相手のポケモン画像を追加）
        const battleHtml = `
            <div class="battle-modal-container-enhanced">
                <!-- Left: Battle Info & Attack Selection -->
                <div class="battle-left-panel">
                    <div class="battle-modal-container">
                        <!-- Attacker (Left) -->
                        <div class="battle-pokemon attacker">
                            <h4 class="pokemon-name">${attacker.name_ja}</h4>
                            <div class="pokemon-stats">
                                <div class="hp-bar">HP: ${Math.max(0, attacker.hp - (attacker.damage || 0))}/${attacker.hp}</div>
                                <div class="pokemon-type">${attacker.types?.join('・') || 'ノーマル'}</div>
                            </div>
                        </div>
                        
                        <!-- VS -->
                        <div class="vs-indicator">
                            <span class="vs-text">VS</span>
                        </div>
                        
                        <!-- Defender (Right) -->
                        <div class="battle-pokemon defender">
                            <h4 class="pokemon-name">${defender.name_ja}</h4>
                            <div class="pokemon-stats">
                                <div class="hp-bar">HP: ${Math.max(0, defender.hp - (defender.damage || 0))}/${defender.hp}</div>
                                <div class="pokemon-type">${defender.types?.join('・') || 'ノーマル'}</div>
                                ${defender.weakness ? `<div class="weakness">弱点: ${defender.weakness.type}</div>` : ''}
                                ${defender.resistance ? `<div class="resistance">抵抗: ${defender.resistance.type}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="attack-selection">
                        <h3>ワザを選択してください</h3>
                        ${usableAttacks.map(attack => `
                            <div class="attack-option" data-attack-index="${attack.index}">
                                <div class="attack-name">${attack.name_ja}</div>
                                <div class="attack-details">
                                    <span class="damage">ダメージ: ${attack.damage || 0}</span>
                                    <span class="energy-cost">エネルギー: ${attack.cost?.join('・') || 'なし'}</span>
                                </div>
                                ${attack.text_ja ? `<div class="attack-effect">${attack.text_ja}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Right: Opponent Pokemon Card Image -->
                <div class="battle-right-panel">
                    <div class="opponent-card-display">
                        <img src="${defenderImagePath}"
                             alt="${defender.name_ja}"
                             class="opponent-card-image" />
                        <div class="card-overlay">
                            <h4>${defender.name_ja}</h4>
                            <div class="card-hp">HP: ${Math.max(0, defender.hp - (defender.damage || 0))}/${defender.hp}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalManager.showCentralModal({
            title: 'バトル - ワザ選択',
            message: battleHtml,
            allowHtml: true,
            actions: [
                { text: 'キャンセル', callback: () => { }, className: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg' }
            ]
        });

        // XSS対策: イベントリスナーを動的に追加
        setTimeout(() => {
            const attackOptions = document.querySelectorAll('.attack-option');
            attackOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const attackIndex = parseInt(option.dataset.attackIndex, 10);
                    this._executeAttackAndCloseModal(attackIndex);
                });
            });

            // 画像エラーハンドリング（XSS対策: onerror属性の代わり）
            const opponentImage = document.querySelector('.opponent-card-image');
            if (opponentImage) {
                opponentImage.addEventListener('error', function () {
                    this.src = 'assets/ui/card_back.webp';
                });
            }
        }, 0);
    }

    /**
     * 攻撃実行処理（モーダルを即座に閉じて、プレイマット上でアニメーション表示）
     */
    async _executeAttackAndCloseModal(attackIndex) {
        // モーダルを即座に閉じる
        modalManager.closeCentralModal();

        // 攻撃開始メッセージを表示（トーストではなく画面表示）
        this.view.showGameMessage('攻撃を実行しています...');

        // 少し待ってからアニメーション開始
        memoryManager.setTimeout(async () => {
            await this._executeAttack(attackIndex);
        }, 300);
    }

    /**
     * 攻撃実行処理
     */
    async _executeAttack(attackIndex) {
        try {
            if (!this.state.players.cpu.active) {
                const blockedState = addLogEntry(this.state, {
                    type: 'attack_blocked',
                    player: 'player',
                    message: '攻撃できません：相手のポケモンがきぜつしています'
                });
                await this._updateState(blockedState, 'attackBlocked');
                this.view.showWarning('OPPONENT_POKEMON_FAINTED');
                return;
            }

            // 攻撃宣言
            let newState = this.turnManager.handlePlayerMainPhase(this.state, 'declare_attack', {
                attackIndex
            });

            await this._updateState(newState);

            // 攻撃実行
            newState = await this.turnManager.executeAttack(newState);
            await this._updateState(newState); // state更新を復旧

            if (newState.turnPlayer === 'cpu') {
                memoryManager.setTimeout(async () => {
                    await this._executeCpuTurn();
                }, 1000);
            }
        } catch (error) {
            console.error('攻撃実行中にエラーが発生しました:', error);

            if (error.message === 'このターンは既に攻撃しました') {
                this.view.showCustomToast('このターンは既に攻撃しました。ターンを終了してください。', 'warning');
                // 攻撃済みの場合はターン終了のみ有効化
                this._showPostAttackButtons();
            } else {
                // 攻撃処理中にエラーが発生した場合はエラートーストを表示
                this.view.showCustomToast('攻撃実行中にエラーが発生しました。ゲームを続行します。', 'error');
                // エラー時はターンを終了して回復を試みる
                let newState = this.turnManager.endPlayerTurn(this.state);
                await this._updateState(newState);
            }
        }
    }

    /**
     * ターン終了ボタン処理
     */
    async _handleEndTurn() {
        // 山札を引いていない場合は警告
        if (this.state.phase === GAME_PHASES.PLAYER_DRAW) {
            this.view.showError('DECK_NOT_SELECTED');
            return;
        }

        // エネルギー付与のペンディングがある場合は警告を表示
        if (this.state.pendingAction && this.state.pendingAction.type === 'attach-energy') {
            this.view.showError('ENERGY_SELECTED_NO_TARGET');
            return;
        }

        // すべてのフローティングアクションボタンを非表示
        this.actionHUDManager.hideAllButtons();

        let newState = this.turnManager.endPlayerTurn(this.state);
        this._updateState(newState);

        // ターン終了通知を画面に表示
        this.view.showGameMessage('ターンが終了しました');

        // CPUターン開始
        memoryManager.setTimeout(async () => {
            this.view.showGameMessage('相手のターンが開始されました');
            await this._executeCpuTurn();
        }, 1000);
    }

    /**
     * CPUターン実行
     */
    async _executeCpuTurn() {
        // シンプルなCPUターン処理
        const newState = await this.turnManager.takeCpuTurn(this.state);
        this._updateState(newState); // CPUターン完了後に一度だけ状態を更新
    }

    /**
     * メインフェーズでのインテリジェントなボタン表示
     * 現在のゲーム状態に基づいて適切なアクションボタンを表示
     */
    _showMainPhaseButtons() {
        if (this.state.phase !== GAME_PHASES.PLAYER_MAIN) return;

        const callbacks = {
            retreat: () => this._handleRetreat(),
            attack: () => this._handleAttack(),
            evolve: () => this._handleEvolution(),
            endTurn: () => this._handleEndTurn()
        };

        // 基本的にすべてのメインフェーズボタンを表示
        this.actionHUDManager.showPhaseButtons('playerMain', callbacks);

        // 状況に応じてボタンの可用性を調整
        this._updateButtonAvailability();
    }

    /**
     * 現在の状況に基づいてボタンの可用性を更新
     */
    _updateButtonAvailability() {
        const playerData = this.state.players.player;

        // にげるボタンの可用性チェック
        const canRetreat = playerData.active &&
            playerData.bench.some(card => card !== null) &&
            !this.state.playerHasRetreated;

        if (!canRetreat) {
            this.actionHUDManager.disableButton(BUTTON_IDS.RETREAT);
        }

        // 攻撃ボタンの可用性チェック
        const canAttack = playerData.active &&
            playerData.active.attacks &&
            playerData.active.attacks.length > 0 &&
            !this.state.playerHasAttacked;

        if (!canAttack) {
            this.actionHUDManager.disableButton(BUTTON_IDS.ATTACK);
        }

        // ターン終了ボタンは常に有効
        this.actionHUDManager.enableButton(BUTTON_IDS.END_TURN);
    }

    /**
     * 攻撃後のボタン状態を設定（攻撃済みの場合）
     */
    _showPostAttackButtons() {
        // 攻撃後はターン終了のみ表示
        this.actionHUDManager.hideAllButtons();
        this.actionHUDManager.showButton(BUTTON_IDS.END_TURN, () => this._handleEndTurn());

        // または、全ボタンを表示してターン終了以外を無効化
        // this._showMainPhaseButtons();
        // this.actionHUDManager.disableButton(BUTTON_IDS.ATTACK);
        // this.actionHUDManager.disableButton(BUTTON_IDS.RETREAT);
    }

    /**
     * にげる後のボタン状態を設定
     */
    _showPostRetreatButtons() {
        // にげる後はターン終了のみ表示
        this.actionHUDManager.hideAllButtons();
        this.actionHUDManager.showButton(BUTTON_IDS.END_TURN, () => this._handleEndTurn());
    }

    /**
     * ゲーム終了処理
     */
    async _handleGameOver(winner, reason = '') {
        noop('🏆 Game Over:', winner, reason);

        // ゲーム終了アニメーション実行
        await this._playGameOverAnimation(winner);

        // 勝敗理由の詳細メッセージ
        const reasonMessages = {
            'prizes': 'すべてのサイドカードを獲得しました！',
            'no_pokemon': '相手のポケモンがいなくなりました！',
            'deck_out': '相手の山札がなくなりました！'
        };

        const reasonText = reasonMessages[reason] || reason || '不明な理由';

        // ゲーム統計情報を取得
        const gameStats = this._getGameStats();

        // 特別な勝敗リザルトモーダル表示
        await this._showGameResultModal(winner, reasonText, gameStats);
    }

    /**
     * 特別な勝敗リザルトモーダル表示
     */
    async _showGameResultModal(winner, reasonText, gameStats) {
        const isVictory = winner === 'player';

        // プレイマットエフェクトを維持するため背景ボケを軽減
        const resultModal = document.createElement('div');
        resultModal.id = 'game-result-modal';
        resultModal.className = 'fixed inset-0 flex items-center justify-center game-result-overlay';

        const modalContent = `
            <div class="game-result-container ${isVictory ? 'victory-result' : 'defeat-result'}">
                <!-- 背景デコレーション -->
                <div class="result-background-decoration"></div>
                
                <!-- メインコンテンツ -->
                <div class="result-content">
                    <!-- 勝敗バナー -->
                    <div class="result-banner">
                        <div class="result-icon-container">
                            ${isVictory ?
                '<div class="victory-crown">👑</div><div class="victory-sparkles">✨🎊✨</div>' :
                '<div class="defeat-cloud">☁️</div><div class="defeat-rain">💧💧💧</div>'
            }
                        </div>
                        <h1 class="result-title">
                            ${isVictory ? 'VICTORY!' : 'DEFEAT'}
                        </h1>
                        <h2 class="result-subtitle">
                            ${isVictory ? 'ポケモンマスターへの道' : '次回頑張ろう'}
                        </h2>
                    </div>
                    
                    <!-- 詳細情報 -->
                    <div class="result-details">
                        <div class="result-reason">
                            <div class="reason-label">勝因</div>
                            <div class="reason-text">${reasonText}</div>
                        </div>
                        
                        <div class="result-stats">
                            <div class="stat-item">
                                <div class="stat-label">ターン数</div>
                                <div class="stat-value">${gameStats.totalTurns}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">使用カード</div>
                                <div class="stat-value">${gameStats.cardsPlayed}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">与ダメージ</div>
                                <div class="stat-value">${gameStats.damageDealt}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- アクションボタン -->
                    <div class="result-actions">
                        <button class="result-btn primary-btn" data-action="newGame">
                            <span class="btn-icon">🚀</span>
                            <span class="btn-text">新しいバトル</span>
                        </button>
                        <button class="result-btn secondary-btn" data-action="stats">
                            <span class="btn-icon">📊</span>
                            <span class="btn-text">詳細統計</span>
                        </button>
                    </div>
                </div>
                
                <!-- アニメーション要素 -->
                <div class="result-particles">
                    ${isVictory ? this._generateVictoryParticles() : this._generateDefeatParticles()}
                </div>
            </div>
        `;

        resultModal.innerHTML = modalContent;
        document.body.appendChild(resultModal);
        ZIndexManager.apply(resultModal, 'MODALS');

        // XSS対策: イベントリスナーを動的に追加
        const newGameBtn = resultModal.querySelector('[data-action="newGame"]');
        const statsBtn = resultModal.querySelector('[data-action="stats"]');

        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                this._startNewGame();
                resultModal.remove();
            });
        }

        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                this._showDetailedStats();
                resultModal.remove();
            });
        }

        // アニメーション開始
        requestAnimationFrame(() => {
            resultModal.classList.add('result-modal-enter');
        });

        // 自動削除タイマー（30秒後）
        setTimeout(() => {
            if (resultModal.parentNode) {
                resultModal.classList.add('result-modal-exit');
                setTimeout(() => resultModal.remove(), 500);
            }
        }, 30000);
    }

    /**
     * 勝利時のパーティクル生成
     */
    _generateVictoryParticles() {
        const particles = [];
        for (let i = 0; i < 15; i++) {
            const delay = Math.random() * 2;
            const duration = 2 + Math.random() * 3;
            const size = 0.5 + Math.random() * 1;
            particles.push(`
                <div class="victory-particle" style="
                    animation-delay: ${delay}s;
                    animation-duration: ${duration}s;
                    transform: scale(${size});
                    left: ${Math.random() * 100}%;
                    --particle-emoji: '${['⭐', '✨', '🎊', '🎉', '💫', '🌟'][Math.floor(Math.random() * 6)]}';
                "></div>
            `);
        }
        return particles.join('');
    }

    /**
     * 敗北時のパーティクル生成
     */
    _generateDefeatParticles() {
        const particles = [];
        for (let i = 0; i < 8; i++) {
            const delay = Math.random() * 1.5;
            const duration = 3 + Math.random() * 2;
            particles.push(`
                <div class="defeat-particle" style="
                    animation-delay: ${delay}s;
                    animation-duration: ${duration}s;
                    left: ${Math.random() * 100}%;
                "></div>
            `);
        }
        return particles.join('');
    }

    /**
     * ゲーム終了アニメーション
     */
    async _playGameOverAnimation(winner) {
        if (winner === 'player') {
            // プレイヤー勝利時の演出
            await this._playVictoryAnimation();
        } else {
            // プレイヤー敗北時の演出
            await this._playDefeatAnimation();
        }
    }

    /**
     * 勝利アニメーション
     */
    async _playVictoryAnimation() {
        // プレイマット全体に勝利エフェクト
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.style.filter = 'brightness(1.2) saturate(1.3)';
            gameBoard.style.transition = 'filter 1s ease';
        }

        // プレイヤーのカードを光らせる
        const playerCards = document.querySelectorAll('[data-owner="player"]');

        // 段階的にカードを光らせる勝利演出
        playerCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('victory-celebration');
                card.style.boxShadow = '0 0 30px rgba(252, 211, 77, 0.8), 0 0 60px rgba(252, 211, 77, 0.4)';
                card.style.transform = 'scale(1.1)';
                card.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
                ZIndexManager.apply(card, 'ANIMATIONS');
            }, index * 150);
        });

        // 勝利パーティクルをプレイマットに追加
        this._createVictoryParticlesOnBoard();

        await new Promise(resolve => setTimeout(resolve, 2500));

        // エフェクトクリーンアップ
        playerCards.forEach(card => {
            card.classList.remove('victory-celebration');
            card.style.transform = '';
            card.style.boxShadow = '';
            ZIndexManager.reset(card);
        });

        if (gameBoard) {
            gameBoard.style.filter = '';
        }
    }

    /**
     * 敗北アニメーション
     */
    async _playDefeatAnimation() {
        // プレイマット全体に敗北エフェクト
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.style.filter = 'grayscale(30%) brightness(0.8) contrast(0.9)';
            gameBoard.style.transition = 'filter 1.5s ease';
        }

        // プレイヤーのカードを沈ませる
        const playerCards = document.querySelectorAll('[data-owner="player"]');
        playerCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.filter = 'grayscale(60%) brightness(0.6) blur(0.5px)';
                card.style.transform = 'scale(0.95) translateY(5px)';
                card.style.opacity = '0.7';
                card.style.transition = 'all 1.2s ease-out';
                card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
            }, index * 100);
        });

        // CPUカードを勝利演出
        const cpuCards = document.querySelectorAll('[data-owner="cpu"]');
        cpuCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.6), 0 0 50px rgba(239, 68, 68, 0.3)';
                card.style.transform = 'scale(1.08)';
                card.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
                ZIndexManager.apply(card, 'ANIMATIONS');
            }, index * 120);
        });

        // 敗北パーティクルをプレイマットに追加
        this._createDefeatParticlesOnBoard();

        await new Promise(resolve => setTimeout(resolve, 2000));

        // エフェクトクリーンアップ（敗北時は少し暗いまま残す）
        cpuCards.forEach(card => {
            card.style.transform = '';
            card.style.boxShadow = '';
            ZIndexManager.reset(card);
        });
    }

    /**
     * プレイマット上に勝利パーティクルを生成
     */
    _createVictoryParticlesOnBoard() {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'board-victory-particle';
            particle.style.position = 'absolute';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
            ZIndexManager.apply(particle, 'ANIMATIONS');
            particle.style.pointerEvents = 'none';
            particle.innerHTML = ['⭐', '✨', '🎊', '🎉', '💫', '🌟'][Math.floor(Math.random() * 6)];
            particle.style.animation = `boardVictoryFloat ${2 + Math.random() * 3}s ease-out ${Math.random() * 1}s forwards`;

            gameBoard.appendChild(particle);

            // 自動削除
            setTimeout(() => {
                if (particle.parentNode) particle.remove();
            }, 5000);
        }
    }

    /**
     * プレイマット上に敗北パーティクルを生成
     */
    _createDefeatParticlesOnBoard() {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'board-defeat-particle';
            particle.style.position = 'absolute';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = '0%';
            particle.style.width = '3px';
            particle.style.height = '15px';
            particle.style.background = 'rgba(156, 163, 175, 0.6)';
            particle.style.borderRadius = '2px';
            ZIndexManager.apply(particle, 'ANIMATIONS');
            particle.style.pointerEvents = 'none';
            particle.style.animation = `boardDefeatFall ${3 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`;

            gameBoard.appendChild(particle);

            // 自動削除
            setTimeout(() => {
                if (particle.parentNode) particle.remove();
            }, 6000);
        }
    }

    /**
     * ゲーム統計情報取得
     */
    _getGameStats() {
        const state = this.state || {};
        const players = state.players || {};
        const playerState = players.player || {};
        const cpuState = players.cpu || {};

        return {
            totalTurns: state.turn || 0,
            playerPrizes: playerState.prizeRemaining || 0,
            cpuPrizes: cpuState.prizeRemaining || 0,
            cardsPlayed: (playerState.discard?.length || 0),
            damageDealt: this._calculateTotalDamage(),
            winner: state.winner || 'unknown',
            reason: state.gameEndReason || 'unknown'
        };
    }

    /**
     * 総ダメージ量計算（概算）
     */
    _calculateTotalDamage() {
        // ログから攻撃ダメージを推定（簡易版）
        const logs = this.state?.log || [];
        let totalDamage = 0;

        logs.forEach(entry => {
            if (entry.message && entry.message.includes('ダメージ')) {
                const damageMatch = entry.message.match(/(\d+)ダメージ/);
                if (damageMatch) {
                    totalDamage += parseInt(damageMatch[1], 10);
                }
            }
        });

        return totalDamage;
    }

    /**
     * 詳細統計表示
     */
    _showDetailedStats() {
        const stats = this._getGameStats();
        const logs = this.state?.log || [];

        modalManager.showCentralModal({
            title: '📊 バトル統計',
            content: `
                <div class="detailed-stats-container">
                    <div class="stats-section">
                        <h3 class="stats-section-title">基本情報</h3>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">総ターン数</div>
                                <div class="stat-value">${stats.totalTurns}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">勝者</div>
                                <div class="stat-value">${stats.winner === 'player' ? 'プレイヤー' : 'CPU'}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">残りサイド</div>
                                <div class="stat-value">あなた: ${stats.playerPrizes} / CPU: ${stats.cpuPrizes}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-section">
                        <h3 class="stats-section-title">プレイ情報</h3>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">使用カード数</div>
                                <div class="stat-value">${stats.cardsPlayed}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">与えた総ダメージ</div>
                                <div class="stat-value">${stats.damageDealt}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">ログ記録</div>
                                <div class="stat-value">${logs.length} 件</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-section">
                        <h3 class="stats-section-title">最近の行動</h3>
                        <div class="recent-logs">
                            ${logs.slice(-5).reverse().map(entry =>
                `<div class="log-entry">${entry.message || 'アクション記録なし'}</div>`
            ).join('')}
                        </div>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: '閉じる',
                    callback: () => modalManager.closeCentralModal()
                }
            ]
        });
    }

    /**
     * カード画像パスを確実に取得
     */
    _getReliableCardImagePath(card) {
        if (!card) return 'assets/ui/card_back.webp'; // デフォルト画像

        // 複数のパスを試行する配列を作成
        const possiblePaths = [];

        // 1. 既にimagePath があれば最優先
        if (card.imagePath) {
            possiblePaths.push(card.imagePath);
        }

        // 2. カードタイプに基づいてサブディレクトリを決定
        const getCardSubdir = (card) => {
            if (card.card_type === 'Pokemon' || card.card_type === 'Pokémon') return 'pokemon';
            // Handle all energy type aliases
            if (card.card_type === 'Energy' || card.card_type === 'Basic Energy' || card.card_type === 'Special Energy') {
                return 'energy';
            }
            if (card.card_type === 'Trainer') return 'trainer';
            // Default to pokemon for unknown types to avoid 404s
            return 'pokemon';
        };

        const subdir = getCardSubdir(card);

        // 3. name_en から複数パターン生成
        if (card.name_en) {
            const cleanName = card.name_en.replace(/\s+/g, '_');
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.webp`);
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.png`);
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.jpg`);
        }

        // 4. name_ja から生成
        if (card.name_ja) {
            const cleanName = card.name_ja.replace(/\s+/g, '_');
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.webp`);
        }

        // 5. ID から生成
        if (card.id) {
            possiblePaths.push(`assets/cards/${subdir}/${card.id}.webp`);
            possiblePaths.push(`assets/cards/${subdir}/${card.id}.png`);
            possiblePaths.push(`assets/cards/${subdir}/${card.id}.jpg`);
        }

        // 最初のパスを返す（onerrorで他のパスも試行される）
        return possiblePaths[0] || 'assets/ui/card_back.webp';
    }

    /**
     * 新しいゲーム開始
     */
    async _startNewGame() {
        // New game initialization
        noop('🎮 Starting new game...');

        // モーダルを閉じる
        this.view.hideModal();

        // 画面をクリア（メッセージは新しいゲーム開始時のみクリア）
        this.view.hideGameMessage();
        this.view.hideActionButtons();

        // 新しいゲーム初期化 - init()は既に初期化されているので_startGameSetupを直接呼ぶ
        // Proceeding with game setup
        await this._startGameSetup();
    }

    /**
     * 詳細統計表示
     */
    _showDetailedStats(stats = null) {
        // 互換: 引数が未指定の場合は現在の状態から統計を取得
        const effectiveStats = stats || this._getGameStats();
        this.view.displayModal({
            title: 'ゲーム詳細統計',
            message: `
                <div class="detailed-stats">
                    <h3 class="font-bold text-lg mb-4">バトル結果</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="player-stats">
                            <h4 class="font-semibold">プレイヤー</h4>
                            <p>残りサイド: ${effectiveStats.playerPrizes}</p>
                        </div>
                        <div class="cpu-stats">
                            <h4 class="font-semibold">CPU</h4>
                            <p>残りサイド: ${effectiveStats.cpuPrizes}</p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <p><strong>総ターン数:</strong> ${effectiveStats.totalTurns || effectiveStats.turns || 0}</p>
                        <p><strong>勝者:</strong> ${effectiveStats.winner === 'player' ? 'プレイヤー' : 'CPU'}</p>
                        <p><strong>勝因:</strong> ${effectiveStats.reason}</p>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: '新しいゲーム',
                    callback: () => this._startNewGame(),
                    className: 'px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
                },
                {
                    text: '閉じる',
                    callback: () => this.view.hideModal(),
                    className: 'px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg'
                }
            ]
        });
    }

    /**
     * にげる処理
     */
    _handleRetreat() {
        if (this.state.turnPlayer !== 'player') return;

        const activePokemon = this.state.players.player.active;
        if (!activePokemon) {
            this.state = addLogEntry(this.state, { message: 'バトル場にポケモンがいません。' });
            this.view.showErrorMessage('バトル場にポケモンがいません。', 'warning');
            return;
        }

        if (!this.state.canRetreat) {
            this.state = addLogEntry(this.state, { message: 'このターンはすでににげました。' });
            this.view.showErrorMessage('このターンはすでににげました。', 'warning');
            return;
        }

        const retreatCost = activePokemon.retreat_cost || 0;
        const attachedEnergyCount = activePokemon.attached_energy ? activePokemon.attached_energy.length : 0;

        if (attachedEnergyCount < retreatCost) {
            this.state = addLogEntry(this.state, { message: 'にげるためのエネルギーが足りません。' });
            this.view.showErrorMessage('にげるためのエネルギーが足りません。', 'warning');
            return;
        }

        this.view.displayModal(
            {
                title: 'にげる確認',
                message: `にげますか？ バトル場の「${activePokemon.name_ja}」をにがします。ベンチポケモンを選択してください。`,
                actions: [
                    { text: 'はい', callback: () => this._initiateRetreat() },
                    { text: 'いいえ', callback: () => { } }
                ]
            }
        );
    }

    /**
     * にげる処理の開始
     */
    _initiateRetreat() {
        this.state.pendingAction = { type: 'retreat-promote' };
        this.state.prompt.message = 'にげるポケモンをベンチから選択してください。';
        this._updateState(this.state);
        this._highlightBenchSlots();
    }

    /**
     * 進化ボタンのハンドラー
     */
    async _handleEvolution() {
        noop('🔄 Evolution button clicked');

        if (this.state.turnPlayer !== 'player') return;

        const playerState = this.state.players.player;
        const hand = playerState.hand || [];
        const currentTurn = this.state.turn;

        // 進化可能な組み合わせを探す
        const evolutionOptions = [];
        const boardPokemon = [playerState.active, ...playerState.bench].filter(Boolean);

        hand.forEach(card => {
            if (card.card_type === 'Pokémon' && card.evolves_from && card.stage !== 'BASIC') {
                boardPokemon.forEach((pokemon, index) => {
                    if (pokemon.name_en === card.evolves_from && pokemon.turnPlayed !== currentTurn) {
                        evolutionOptions.push({
                            evolutionCard: card,
                            targetPokemon: pokemon,
                            targetLocation: index === 0 ? 'active' : 'bench',
                            targetIndex: index === 0 ? -1 : index - 1 // ベンチのインデックス調整
                        });
                    }
                });
            }
        });

        if (evolutionOptions.length === 0) {
            this.view.showErrorMessage('進化できるポケモンがいません。', 'warning');
            return;
        }

        // 進化選択UIを表示
        this._showEvolutionSelectionModal(evolutionOptions);
    }

    /**
     * 進化選択モーダルを表示
     */
    _showEvolutionSelectionModal(options) {
        const optionsHtml = options.map((option, index) => {
            const locationText = option.targetLocation === 'active' ? 'バトル場' : 'ベンチ';
            return `
                <div class="evolution-option" data-option-index="${index}">
                    <div class="evolution-info">
                        <strong>${option.targetPokemon.name_ja}</strong> (${locationText})
                        → <strong>${option.evolutionCard.name_ja}</strong>
                    </div>
                    <button class="evolution-select-btn" data-option-index="${index}">この進化を実行</button>
                </div>
            `;
        }).join('');

        const modalContent = `
            <div class="evolution-modal">
                <h3>進化するポケモンを選択してください</h3>
                <div class="evolution-options">
                    ${optionsHtml}
                </div>
            </div>
        `;

        this.view.showInteractiveMessage(
            modalContent,
            options.map((option, index) => ({
                text: `${option.targetPokemon.name_ja} → ${option.evolutionCard.name_ja}`,
                callback: () => this._executeEvolution(option)
            })).concat([
                { text: 'キャンセル', callback: () => { } }
            ]),
            'central',
            true
        );
    }

    /**
     * 進化を実行
     */
    async _executeEvolution(option) {
        const { evolutionCard, targetPokemon, targetLocation, targetIndex } = option;

        try {
            // Logic.jsの進化機能を使用
            const newState = Logic.evolvePokemon(
                this.state,
                'player',
                evolutionCard.runtimeId || evolutionCard.id,
                targetLocation,
                targetIndex
            );

            if (newState !== this.state) {
                this.state = addLogEntry(newState, {
                    message: `${targetPokemon.name_ja}が${evolutionCard.name_ja}に進化しました！`
                });
                this._updateState(this.state);

                // 進化後にボタンを再評価
                setTimeout(() => {
                    this._showMainPhaseButtons();
                }, 500);

                noop('🔄 Evolution completed successfully');
            } else {
                this.view.showErrorMessage('進化に失敗しました。', 'error');
            }
        } catch (error) {
            console.error('Evolution error:', error);
            this.view.showErrorMessage('進化処理中にエラーが発生しました。', 'error');
        }
    }

    /**
     * エネルギーが足りるかチェック（フォールバック用）
     */
    _hasEnoughEnergy(pokemon, attack) {
        if (!pokemon.attached_energy || !attack.cost) return false;

        const attached = pokemon.attached_energy.map(e => e.energy_type || e.type);
        const cost = [...attack.cost];

        // 簡単なエネルギーマッチング
        for (let i = attached.length - 1; i >= 0; i--) {
            const energyType = attached[i];
            const costIndex = cost.findIndex(c => c === energyType || c === 'Colorless');
            if (costIndex !== -1) {
                cost.splice(costIndex, 1);
                attached.splice(i, 1);
            }
        }

        return cost.length === 0 || (cost.every(c => c === 'Colorless') && attached.length >= cost.length);
    }


    /**
     * スマートなボタン表示システム - 条件に基づいてボタンを表示
     */
    _updateSmartActionButtons() {
        if (this.state.phase !== GAME_PHASES.PLAYER_MAIN ||
            this.state.turnPlayer !== 'player' ||
            this.state.pendingAction) {
            this.actionHUDManager.hideAllButtons();
            return;
        }

        const availableActions = this._getAvailableActions();
        const buttonConfigs = [];

        // ターン終了は常に可能
        if (availableActions.canEndTurn) {
            buttonConfigs.push({
                id: BUTTON_IDS.END_TURN,
                callback: () => this._handleEndTurn(),
                options: { text: 'ターン終了', icon: '✅' }
            });
        }

        // にげる - 条件を満たす場合のみ
        if (availableActions.canRetreat) {
            buttonConfigs.push({
                id: BUTTON_IDS.RETREAT,
                callback: () => this._handleRetreat(),
                options: { text: 'にげる', icon: '🏃' }
            });
        }

        // 攻撃 - エネルギーが足りる場合のみ
        if (availableActions.canAttack) {
            buttonConfigs.push({
                id: BUTTON_IDS.ATTACK,
                callback: () => this._handleAttack(),
                options: { text: '攻撃', icon: '⚔️' }
            });
        }

        // 進化 - 条件を満たす場合のみ
        if (availableActions.canEvolve) {
            buttonConfigs.push({
                id: BUTTON_IDS.EVOLVE,
                callback: () => this._handleEvolution(),
                options: { text: '進化', icon: '🔄' }
            });
        }

        this.actionHUDManager.showButtons(buttonConfigs);
        noop('🎯 Smart action buttons updated:', availableActions);
    }

    /**
     * 現在の状況で可能なアクションを判定
     */
    _getAvailableActions() {
        const playerState = this.state.players.player;
        const active = playerState.active;

        return {
            canEndTurn: true, // ターン終了は常に可能
            canRetreat: this._canPlayerRetreat(),
            canAttack: this._canPlayerAttack(),
            canEvolve: this._canPlayerEvolve()
        };
    }

    /**
     * プレイヤーがにげることができるかチェック
     */
    _canPlayerRetreat() {
        const playerState = this.state.players.player;
        const active = playerState.active;

        if (!active || playerState.bench.length === 0) return false;
        if (this.state.hasRetreatedThisTurn || this.state.canRetreat === false) return false;

        const retreatCost = active.retreat_cost || 0;
        const attachedEnergy = active.attached_energy || [];

        return attachedEnergy.length >= retreatCost;
    }

    /**
     * プレイヤーが攻撃できるかチェック
     */
    _canPlayerAttack() {
        const playerState = this.state.players.player;
        const active = playerState.active;

        if (!active || !active.attacks || active.attacks.length === 0) return false;

        // 少なくとも一つの攻撃が使用可能かチェック
        return active.attacks.some(attack => {
            return this._hasEnoughEnergy(active, attack);
        });
    }

    /**
     * プレイヤーが進化できるかチェック
     */
    _canPlayerEvolve() {
        const playerState = this.state.players.player;
        const hand = playerState.hand || [];
        const currentTurn = this.state.turn;

        // 手札に進化カードがあるかチェック
        const evolutionCards = hand.filter(card =>
            card.card_type === 'Pokémon' &&
            card.evolves_from &&
            card.stage !== 'BASIC'
        );

        if (evolutionCards.length === 0) return false;

        // 場に進化元のポケモンがいるかチェック
        const boardPokemon = [playerState.active, ...playerState.bench].filter(Boolean);

        for (const evolutionCard of evolutionCards) {
            for (const pokemon of boardPokemon) {
                if (pokemon.name_en === evolutionCard.evolves_from &&
                    pokemon.turnPlayed !== currentTurn) { // このターンに出していない
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * プレイヤーメインフェーズのボタンを表示（旧システム互換）
     */
    _showPlayerMainButtonsAfterAction() {
        this._showMainPhaseButtons();
    }

    /**
     * 確定HUDの表示判定と表示
     */
    _showConfirmHUDIfReady() {
        if (this.state.phase !== GAME_PHASES.INITIAL_POKEMON_SELECTION) return;

        const playerActive = this.state.players.player.active;
        const hasBasicPokemonInActive = playerActive && playerActive.card_type === 'Pokémon' && playerActive.stage === 'BASIC';

        if (hasBasicPokemonInActive) {
            this._showFloatingActionButton('confirm-setup-button-float', () => this._handleConfirmSetup());
        }
    }

    /**
     * フローティングアクションボタン表示（ActionHUDManager統合）
     */
    _showFloatingActionButton(buttonId, callback) {
        this.actionHUDManager.showButton(buttonId, callback);
    }

    /**
     * フローティングアクションボタン非表示（ActionHUDManager統合）
     */
    _hideFloatingActionButton(buttonId) {
        this.actionHUDManager.hideButton(buttonId);
    }

    /**
     * セットアップ確定処理
     */
    async _handleConfirmSetup() {

        // フェーズに応じて処理を分岐
        if (this.state.phase === GAME_PHASES.GAME_START_READY) {
            // ゲームスタートボタンが押された場合
            await this._startActualGame();
            return;
        }

        // 初期ポケモン配置確定の場合
        // Note: ActionHUDManager がクリック中はボタンを一時的に disabled にしますが、
        // ここではその状態を理由に早期リターンしないようにします（正規のクリックを阻害しない）

        const active = this.state?.players?.player?.active;
        if (!active || active.card_type !== 'Pokémon' || active.stage !== 'BASIC') {
            this.state = addLogEntry(this.state, { message: 'バトル場にたねポケモンを配置してください。' });
            return;
        }

        noop('🔥 CONFIRM BUTTON PRESSED - Starting setup confirmation flow');
        noop('🔥 Animation flags at confirm button press:', {
            setupAnimationsExecuted: this.setupAnimationsExecuted,
            prizeCardAnimationExecuted: this.prizeCardAnimationExecuted,
            cardRevealAnimationExecuted: this.cardRevealAnimationExecuted
        });

        // 確定ボタン押下時にUIを非表示
        this.view.hideActionHUD(); // 確定HUDを非表示
        this.view.clearInteractiveButtons();
        this.view.hideInitialPokemonSelectionUI();
        // メッセージは次のメッセージが表示されるまで保持

        // 「サイドカード配布中...」メッセージを表示 - 進行状況なので右パネル
        this.view.showInteractiveMessage('ポケモン配置完了！サイドカードを配布しています...', [], 'panel');
        this.state = addLogEntry(this.state, { message: 'サイドカード配布開始' });

        noop('🔥 About to call setupManager.confirmSetup');

        // 確定ボタンを隠す
        this._hideFloatingActionButton('confirm-setup-button-float');

        // サイドカード配布の状態更新（レンダリングはアニメーション後）
        let newState = await this.setupManager.confirmSetup(this.state);
        this._updateState(newState); // 状態更新とレンダリング

        // プレイヤー側サイドカードアニメーション実行
        noop('🔥 About to call _animatePlayerPrizeCardSetup');
        await this._animatePlayerPrizeCardSetup();
        noop('✅ Player prize card animation completed');

        // プレイヤー側アニメーション完了をマーク
        this.animationStatus.prizePlayerDealt = true;

        // 両者準備完了チェック（setup-manager経由）
        this.setupManager._checkBothPlayersReady();
    }

    /**
     * 実際のゲーム開始処理
     */
    async _startActualGame() {
        noop('🔥 _startActualGame() CALLED - Current phase:', this.state.phase);
        noop('🔥 _startActualGame() - Animation flags:', {
            setupAnimationsExecuted: this.setupAnimationsExecuted,
            prizeCardAnimationExecuted: this.prizeCardAnimationExecuted,
            cardRevealAnimationExecuted: this.cardRevealAnimationExecuted
        });

        // すべてのHUDボタンを非表示にする
        this.actionHUDManager.hideAllButtons();

        // 重複実行を防ぐため、既にゲーム開始済みなら早期return
        if (this.state.phase === GAME_PHASES.PLAYER_MAIN || this.state.phase === GAME_PHASES.PLAYER_TURN) {
            noop('🔄 Game already started, skipping _startActualGame');
            return;
        }

        noop('🎮 Starting actual game with card reveal animation');

        // 1. カードをめくるアニメーションを実行
        noop('🔥 About to call _animateCardReveal');
        await this._animateCardReveal();
        noop('🔥 _animateCardReveal completed');

        // 2. カードを表向きにする (State更新)
        let newState = await this.setupManager.startGameRevealCards(this.state);

        // 手札データ保護チェック
        if (!newState.players.player.hand || newState.players.player.hand.length === 0) {
            console.warn('⚠️ Player hand is empty after startGameRevealCards, restoring from previous state');
            newState.players.player.hand = this.state.players.player.hand || [];
        }

        // 3. ターン制約をリセット (ドロー以外のもの)

        // 4. プレイヤーのドローフェーズに移行（手動ドロー）
        newState.phase = GAME_PHASES.PLAYER_DRAW;
        newState.prompt.message = '山札をクリックしてカードを1枚ドローしてください。';

        noop('🃏 Hand before _updateState:', newState.players.player.hand?.length || 0, 'cards');
        this._updateState(newState);
        noop('🃏 Hand after _updateState:', this.state.players.player.hand?.length || 0, 'cards');

        this.state = addLogEntry(this.state, { message: 'バトル開始！' });

        // ✅ イベント駆動: ゲーム開始イベント
        eventBus.emit(GameEventTypes.GAME_STARTED, {
            firstPlayer: 'player',
            timestamp: Date.now()
        });

        // ✅ イベント駆動: プレイヤーターン開始イベント
        eventBus.emit(GameEventTypes.TURN_STARTED, {
            turnPlayer: 'player',
            turnNumber: this.state.turn || 1,
            timestamp: Date.now()
        });
    }

    /**
     * カード公開アニメーション
     */
    async _animateCardReveal() {
        // 重複実行防止
        if (this.cardRevealAnimationExecuted) {
            noop('🔄 Card reveal animation already executed, skipping');
            return;
        }

        this.cardRevealAnimationExecuted = true;
        noop('✅ Three.js専用: カードフリップはThree.jsが自動処理（表示は常に正しい面）');

        // ✅ Three.js専用モード: カードは常に正しい面で表示される
        // フリップアニメーションは不要（Three.jsがrotationYで管理）
    }

    /**
     * セットアップアニメーション スケジューリング
     */
    _scheduleSetupAnimations() {
        // 重複実行防止
        if (this.animationStatus.setupExecuted) {
            return;
        }

        this.animationStatus.setupExecuted = true;

        // requestAnimationFrame を使って確実にDOM準備完了を待つ
        requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
                // さらに少し待ってから実行
                setTimeout(async () => {
                    await this._executeSetupAnimations();
                }, 100);
            });
        });
    }

    /**
     * セットアップアニメーション実行
     */
    async _executeSetupAnimations() {
        try {
            // DOM要素の存在確認を強化
            await this._verifyDOMElements();

            // 手札のアニメーション
            await this._animateInitialHandDraw();

            // サイドカードアニメーション - 新システムでは個別実行されるためコメントアウト
            // await this._animatePrizeCardSetup();

            // Note: CPUの初期ポケモン配置はプレイヤーの操作後に実行
        } catch (error) {
            errorHandler.handleError(error, ERROR_TYPES.ANIMATION_FAILED, false);
        }
    }

    /**
     * DOM要素存在確認（ハイブリッドモード対応）
     * ✅ 手札はDOMで管理されるため要素の存在確認が必要
     */
    async _verifyDOMElements() {
        const maxAttempts = 20;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const playerHand = document.getElementById('player-hand');
            const cpuHand = document.getElementById('cpu-hand');

            if (playerHand && cpuHand) {
                console.log('✅ DOM elements verified: #player-hand and #cpu-hand exist');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 50));
            attempts++;
        }

        console.warn('⚠️ _verifyDOMElements: Timeout waiting for hand elements');
    }

    /**
     * 初期手札ドローアニメーション（ハイブリッド方式：DOM版）
     */
    async _animateInitialHandDraw() {
        // ✅ ハイブリッド方式: 手札はDOM版なのでDOM版アニメーションを使用
        try {
            await this.setupManager.animateInitialDraw();
        } catch (error) {
            console.error('Failed to animate initial hand draw:', error);
            // フォールバック: 遅延のみ
            await this._delay(300);
        }
    }

    /**
     * プレイヤー側サイドカード配置アニメーション（Three.js専用）
     */
    async _animatePlayerPrizeCardSetup() {
        // 重複実行防止
        if (this.animationStatus.prizePlayerDealt) {
            noop('🔄 Player prize card animation already executed, skipping');
            return;
        }

        noop('🎯 Starting PLAYER prize card animation (Three.js mode)');

        // ✅ Three.js専用: サイドカードアニメーションはThree.jsが処理
        this.animationStatus.prizePlayerDealt = true;
        noop('✅ Player prize card animation completed (Three.js mode)');

        // プレイヤー側完了後の状態更新
        this._updateState(this.state);

        // 両方完了しているかチェック
        this._checkBothPrizeAnimationsComplete();
    }

    /**
     * CPU側サイドカード配置アニメーション
     */
    async _animateCPUPrizeCardSetup() {
        noop('🤖 _animateCPUPrizeCardSetup: Method called');

        // 重複実行防止
        if (this.animationStatus.prizeCpuDealt) {
            noop('🔄 _animateCPUPrizeCardSetup: CPU prize card animation already executed, skipping');
            return;
        }

        noop('🎯 _animateCPUPrizeCardSetup: Starting CPU prize card animation (Three.js mode)');

        // ✅ Three.js専用: サイドカードアニメーションはThree.jsが処理
        this.animationStatus.prizeCpuDealt = true;
        noop('✅ CPU prize card animation completed (Three.js mode)');

        // CPU側完了後の状態更新
        this._updateState(this.state);

        // 両方完了しているかチェック
        this._checkBothPrizeAnimationsComplete();
    }

    /**
     * サイドカード配置アニメーション（レガシー版、下位互換のため保持）
     */
    async _animatePrizeCardSetup() {
        // 新しい分離されたアニメーションシステムを使用
        await Promise.all([
            this._animatePlayerPrizeCardSetup(),
            this._animateCPUPrizeCardSetup()
        ]);

        // レガシーフラグも設定（互換性のため）
        this.prizeCardAnimationExecuted = true;
        this.prizeAnimationCompleted = true;
    }

    /**
     * 両方のサイドアニメーション完了チェック
     */
    _checkBothPrizeAnimationsComplete() {
        const { prizePlayerDealt, prizeCpuDealt } = this.animationStatus;

        noop('🔍 Checking prize animations completion:', { prizePlayerDealt, prizeCpuDealt });

        if (prizePlayerDealt && prizeCpuDealt) {
            noop('🎉 Both prize animations completed! Showing game start button');

            // 両方完了時のメッセージ表示
            this.view.showGameMessage(
                '準備完了！「ゲームスタート」を押してバトルを開始してください。'
            );

            // ゲームスタートボタンを表示
            this.actionHUDManager.showPhaseButtons('gameStart', {
                startActualGame: () => {
                    noop('🔥 GAME START BUTTON CLICKED - Starting actual game');
                    this._startActualGame();
                }
            });

            // ログエントリを追加
            this.state = addLogEntry(this.state, {
                type: 'all_prize_animations_complete',
                message: '両陣営のサイドカード配布が完了しました！'
            });

        } else if (prizePlayerDealt && !prizeCpuDealt) {
            // プレイヤー完了、CPU待ち
            this.view.showGameMessage('相手の準備を待っています...');

        } else if (!prizePlayerDealt && prizeCpuDealt) {
            // CPU完了、プレイヤー待ち（通常は発生しない）
            this.view.showGameMessage('あなたの配置確定を待っています...');
        }
    }

    /**
     * アニメーション用に裏面サイドカードを事前作成
     * @param {string} targetPlayer - 'player', 'cpu', または省略時は両方
     */
    async _createPrizeBackCardsForAnimation(targetPlayer = 'both') {
        noop(`🎯 Creating back cards for ${targetPlayer} prize animation`);

        if (targetPlayer === 'player' || targetPlayer === 'both') {
            // プレイヤー用裏面カード作成
            const playerPrizeSlots = document.querySelectorAll('.player-self .side-left .card-slot');
            playerPrizeSlots.forEach((slot, index) => {
                if (index < 6) {
                    slot.innerHTML = ''; // 既存内容をクリア
                    const backCard = this._createPrizeBackCard('player', index);
                    // 注: 向き制御は親スロットの data-orientation を CSS が継承
                    slot.appendChild(backCard);
                }
            });
        }

        if (targetPlayer === 'cpu' || targetPlayer === 'both') {
            // CPU用裏面カード作成
            const cpuPrizeSlots = document.querySelectorAll('.opponent-board .side-right .card-slot');
            cpuPrizeSlots.forEach((slot, index) => {
                if (index < 6) {
                    slot.innerHTML = ''; // 既存内容をクリア
                    const backCard = this._createPrizeBackCard('cpu', index);
                    // 注: 向き制御は親スロットの data-orientation を CSS が継承
                    slot.appendChild(backCard);
                }
            });
        }

        // DOM更新を待つ
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    /**
     * サイド用裏面カード要素を作成
     */
    _createPrizeBackCard(playerType, index) {
        const cardElement = document.createElement('div');
        cardElement.className = 'relative w-full h-full card-back-element';
        cardElement.dataset.zone = 'prize';
        cardElement.dataset.owner = playerType;
        cardElement.dataset.prizeIndex = index.toString();

        // 裏面画像を作成（向きは CardOrientationManager が管理）
        const cardBack = document.createElement('div');
        cardBack.className = 'w-full h-full card-back card-image';
        cardBack.style.backgroundImage = 'url("assets/ui/card_back.webp")';
        cardBack.style.backgroundSize = 'cover';
        cardBack.style.backgroundPosition = 'center';
        cardBack.style.borderRadius = '8px';
        cardBack.style.border = '1px solid rgba(255, 255, 255, 0.2)';

        cardElement.appendChild(cardBack);
        return cardElement;
    }

    // ==================== アニメーション関連メソッド ====================

    /**
     * カード配置アニメーション
     */
    async _animateCardPlacement(cardElement, zone, index) {
        // ✅ Three.js専用: カード配置アニメーション
        // cardElementパラメータは互換性のため残すが使用しない

        // Three.jsでは状態更新時に自動でカードが正しい位置に移動
        // アニメーションはthree-view-bridge.jsのrender()で処理される

        // 短い遅延で視覚的フィードバック
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    /**
     * ポケモン昇格アニメーション
     */
    async _animatePokemonPromotion(playerId, benchIndex) {
        const playerState = this.state.players[playerId];
        const card = playerState.bench[benchIndex];
        if (!card) return;

        // ✅ Three.js専用: ベンチ→アクティブアニメーション
        if (this.view?.threeViewBridge?.isActive()) {
            const runtimeId = card.runtimeId || card.id;
            await this.view.threeViewBridge.animateCardToActive(runtimeId, 400);
        }

        // 短い遅延で視覚的フィードバック
        await new Promise(resolve => setTimeout(resolve, 200));
    }


    /**
     * ポケモン要素を検索（アクティブ・ベンチ両方）
     */
    _findPokemonElement(pokemonId) {
        // プレイヤーのアクティブポケモンをチェック
        const playerActiveSlot = document.querySelector('.player-self .active-bottom');
        if (playerActiveSlot) {
            const card = playerActiveSlot.querySelector('[data-card-id]');
            if (card && (card.dataset.runtimeId === pokemonId || card.dataset.cardId === pokemonId)) {
                return playerActiveSlot;
            }
        }

        // プレイヤーのベンチポケモンをチェック
        for (let i = 1; i <= 5; i++) {
            const benchSlot = document.querySelector(`.player-self .bottom-bench-${i}`);
            if (benchSlot) {
                const card = benchSlot.querySelector('[data-card-id]');
                if (card && (card.dataset.runtimeId === pokemonId || card.dataset.cardId === pokemonId)) {
                    return benchSlot;
                }
            }
        }

        // CPUのアクティブポケモンをチェック
        const cpuActiveSlot = document.querySelector('.opponent-board .active-top');
        if (cpuActiveSlot) {
            const card = cpuActiveSlot.querySelector('[data-card-id]');
            if (card && (card.dataset.runtimeId === pokemonId || card.dataset.cardId === pokemonId)) {
                return cpuActiveSlot;
            }
        }

        // CPUのベンチポケモンをチェック
        for (let i = 1; i <= 5; i++) {
            const benchSlot = document.querySelector(`.opponent-board .top-bench-${i}`);
            if (benchSlot) {
                const card = benchSlot.querySelector('[data-card-id]');
                if (card && (card.dataset.runtimeId === pokemonId || card.dataset.cardId === pokemonId)) {
                    return benchSlot;
                }
            }
        }

        return null;
    }

    /**
     * バトル中のポケモン配置アニメーション（準備フェーズ流用）
     */
    async _animateBattlePokemonPlacement(cardId, targetZone, targetIndex) {
        try {
            if (this.view?.threeViewBridge?.isActive()) {
                // ✅ カード配置アニメーション
                if (targetZone === 'active') {
                    await this.view.threeViewBridge.animateCardToActive(cardId, 400);
                } else if (targetZone === 'bench') {
                    await this.view.threeViewBridge.animateCardToBench(cardId, 400);
                } else {
                    await this.view.threeViewBridge.animatePlayCard(cardId, 400);
                }

                // ✅ カードフリップアニメーション（裏→表）
                await this.view.threeViewBridge.flipCard(cardId, 600);
            }

            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error('❌ Battle Pokemon placement animation failed:', error);
            noop(`⚠️ Battle Pokemon placement animation failed: ${error.message}`);
        }
    }

    /**
     * ベンチ→アクティブ昇格アニメーション
     */
    async _animateBenchToActive(pokemonId, benchIndex) {
        try {
            // ✅ Three.js専用: ベンチ→アクティブ昇格アニメーション
            if (this.view?.threeViewBridge?.isActive()) {
                await this.view.threeViewBridge.animateBenchToActive?.(pokemonId, benchIndex, 500);
            }

            // 短い遅延で視覚的フィードバック
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            noop(`⚠️ Bench to active animation failed: ${error.message}`);
            // アニメーション失敗時も処理を続行
        }
    }

    /**
     * サイドカード取得アニメーション
     */
    async _animatePrizeTake(playerId, prizeIndex) {
        const playerState = this.state.players[playerId];
        const card = playerState.prize[prizeIndex];

        try {
            // ✅ Three.js専用: サイドカード取得アニメーション
            if (this.view?.threeViewBridge?.isActive()) {
                // カードのruntimeIdを取得
                const runtimeId = card?.runtimeId || card?.id || `prize-${prizeIndex}`;

                // Three.jsでサイドカード→手札アニメーション実行
                await this.view.threeViewBridge.animatePrizeTake?.(runtimeId, 400);
            }

            // 短い遅延で視覚的フィードバック
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            noop(`⚠️ Prize take animation failed: ${error.message}`);
            // アニメーション失敗時も処理を続行
        }
    }

    // ==================== ハイライト関連メソッド ====================

    /**
     * カードハイライト（Three.js専用）
     * @param {string} cardId - カードID
     * @param {boolean} highlight - ハイライト表示/非表示
     * @param {Object} options - オプション { type: 'highlight'|'select' }
     */
    _highlightCard(cardId, highlight = true, options = {}) {
        // ✅ Three.js専用: Three.jsハイライトシステムを使用
        if (this.view?.threeViewBridge) {
            if (highlight) {
                this.view.threeViewBridge.highlightCard?.(cardId);
            } else {
                this.view.threeViewBridge.clearCardHighlight?.(cardId);
            }
        }
    }

    /**
     * エネルギー対象ハイライト（Three.js専用）
     */
    _highlightEnergyTargets(energyType) {
        const player = this.state.players.player;

        // ✅ Three.js専用: スロットハイライトシステムを使用
        if (!this.view?.threeViewBridge) return;

        // アクティブポケモンをチェック
        if (player.active && Logic.canUseEnergy(player.active, energyType)) {
            // Three.jsでアクティブスロットをハイライト
            this.view.threeViewBridge.highlightSlotsByZone?.('active', 'player');

            // カードもハイライト
            const runtimeId = player.active.runtimeId || player.active.id;
            this.view.threeViewBridge.setCardHighlighted?.(runtimeId, true);
        }

        // ベンチポケモンをチェック
        player.bench.forEach((pokemon, index) => {
            if (pokemon && Logic.canUseEnergy(pokemon, energyType)) {
                // Three.jsでベンチスロットをハイライト
                this.view.threeViewBridge.highlightSlotsByZone?.('bench', 'player', index);

                // カードもハイライト
                const runtimeId = pokemon.runtimeId || pokemon.id;
                this.view.threeViewBridge.setCardHighlighted?.(runtimeId, true);
            }
        });
    }

    /**
     * ベンチスロットハイライト（Three.js専用）
     */
    _highlightBenchSlots() {
        // ✅ Three.js専用: 全ベンチスロットをハイライト
        if (this.view?.threeViewBridge) {
            this.view.threeViewBridge.highlightSlotsByZone?.('bench', 'player');

            // 既にカードが配置されているベンチポケモンもハイライト
            const player = this.state.players.player;
            player.bench.forEach((pokemon, index) => {
                if (pokemon) {
                    const runtimeId = pokemon.runtimeId || pokemon.id;
                    this.view.threeViewBridge.setCardHighlighted?.(runtimeId, true);
                }
            });
        }
    }

    /**
     * 全ハイライト解除（Three.js専用）
     */
    _clearAllHighlights() {
        // ✅ Three.js専用: ハイライト解除
        if (this.view?.threeViewBridge) {
            this.view.threeViewBridge.clearHighlights();
            this.view.threeViewBridge.clearAllCardHighlights();
        }
    }

    /**
     * サウンドとインプットマネージャーの初期化
     */
    _setupSoundAndInputManagers() {
        try {
            // サウンドマネージャーの初期化 - バトルBGMを再生
            soundManager.playMusic('battle');

            // インプットマネージャーのキーボードショートカット設定
            // ターン終了
            inputManager.on('endTurn', () => {
                if (this.phaseManager.getCurrentPhase() !== 'SETUP') {
                    this._handleEndTurn();
                }
            });

            // サウンドトグル
            inputManager.on('toggleSound', () => {
                const enabled = soundManager.toggle();
                if (this.view) {
                    this.view.showCustomToast(
                        'サウンド: ' + (enabled ? 'ON' : 'OFF'),
                        enabled ? 'success' : 'info'
                    );
                }
            });

            // 確定アクション（選択中の要素をクリック）
            inputManager.on('confirm', () => {
                inputManager.confirmSelection();
            });

            // キャンセルアクション
            inputManager.on('cancel', () => {
                if (modalManager.isModalOpen && modalManager.isModalOpen()) {
                    modalManager.closeModal();
                }
            });

            // ヘルプ表示
            inputManager.on('showHelp', () => {
                this._showKeyboardHelp();
            });

            // 手札の選択可能な要素を更新
            this._updateSelectableElements();

            console.log('Sound and Input Managers initialized');
        } catch (error) {
            console.warn('Failed to initialize sound/input managers:', error);
        }
    }

    /**
     * 選択可能な要素を更新
     */
    _updateSelectableElements() {
        try {
            const handSlots = Array.from(document.querySelectorAll('#player-hand .hand-slot'));
            const buttons = Array.from(document.querySelectorAll('.pokemon-action-btn:not(.hidden)'));
            const selectableElements = [...handSlots, ...buttons];
            inputManager.updateSelectableElements(selectableElements);
        } catch (error) {
            console.warn('Failed to update selectable elements:', error);
        }
    }

    /**
     * キーボードヘルプを表示
     */
    _showKeyboardHelp() {
        const helpContent = `
            <div class="keyboard-help-panel">
                <div class="keyboard-help-title">キーボードショートカット</div>

                <div class="keyboard-help-section">
                    <h3>基本操作</h3>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">Enter / Space</span>
                        <span class="keyboard-help-description">選択を確定</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">Esc</span>
                        <span class="keyboard-help-description">キャンセル</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">E</span>
                        <span class="keyboard-help-description">ターン終了</span>
                    </div>
                </div>

                <div class="keyboard-help-section">
                    <h3>ナビゲーション</h3>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">← / A</span>
                        <span class="keyboard-help-description">左に移動</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">→ / D</span>
                        <span class="keyboard-help-description">右に移動</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">↑ / W</span>
                        <span class="keyboard-help-description">上に移動</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">↓ / S</span>
                        <span class="keyboard-help-description">下に移動</span>
                    </div>
                </div>

                <div class="keyboard-help-section">
                    <h3>カード選択</h3>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">1-7</span>
                        <span class="keyboard-help-description">手札のカードを選択</span>
                    </div>
                </div>

                <div class="keyboard-help-section">
                    <h3>UI操作</h3>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">M</span>
                        <span class="keyboard-help-description">サウンドON/OFF</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">H / F1</span>
                        <span class="keyboard-help-description">ヘルプ表示</span>
                    </div>
                    <div class="keyboard-help-item">
                        <span class="keyboard-help-key">F</span>
                        <span class="keyboard-help-description">フルスクリーン切替</span>
                    </div>
                </div>

                <button class="keyboard-help-close" onclick="document.querySelector('.keyboard-help-overlay').remove()">
                    閉じる (Esc)
                </button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'keyboard-help-overlay';
        overlay.innerHTML = helpContent;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        document.body.appendChild(overlay);
    }

    /**
     * サウンドエフェクトを再生
     * @param {string} soundName - 再生するサウンド名
     */
    _playSound(soundName) {
        try {
            soundManager.play(soundName);
        } catch (error) {
            console.warn('Failed to play sound:', soundName, error);
        }
    }
} // End of Game class
