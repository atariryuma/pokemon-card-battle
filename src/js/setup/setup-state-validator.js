/**
 * SETUP-STATE-VALIDATOR.JS - セットアップ状態検証クラス
 *
 * 目的:
 * - セットアップフェーズの状態検証を専門に担当
 * - SetupManager から検証ロジックを分離
 * - 明確なエラーレポート機能
 *
 * 設計原則:
 * - 単一責任: 状態検証のみを担当
 * - Pure Functions: 副作用なし
 * - 明確なエラーメッセージ
 */

import { SetupError, SetupErrorType } from '../errors/setup-error.js';

/**
 * セットアップ状態検証クラス
 */
export class SetupStateValidator {
    constructor() {
        this.validationRules = new Map();
        this._initializeRules();
    }

    /**
     * 検証ルールを初期化
     * @private
     */
    _initializeRules() {
        // 基本的な状態検証ルール
        this.validationRules.set('state_exists', this._validateStateExists.bind(this));
        this.validationRules.set('players_exist', this._validatePlayersExist.bind(this));
        this.validationRules.set('hand_valid', this._validateHandValid.bind(this));
        this.validationRules.set('deck_valid', this._validateDeckValid.bind(this));
        this.validationRules.set('bench_valid', this._validateBenchValid.bind(this));
        this.validationRules.set('active_valid', this._validateActiveValid.bind(this));
        this.validationRules.set('prize_valid', this._validatePrizeValid.bind(this));
    }

    /**
     * ゲーム状態全体を検証
     * @param {Object} state - ゲーム状態
     * @param {Array<string>} rules - 適用する検証ルール（省略時は全ルール）
     * @returns {Object} 検証結果 { isValid, errors, warnings }
     */
    validateState(state, rules = null) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const rulesToApply = rules || Array.from(this.validationRules.keys());

        for (const ruleName of rulesToApply) {
            const ruleFunction = this.validationRules.get(ruleName);
            if (!ruleFunction) {
                console.warn(`Unknown validation rule: ${ruleName}`);
                continue;
            }

            try {
                const ruleResult = ruleFunction(state);
                if (ruleResult.errors.length > 0) {
                    result.isValid = false;
                    result.errors.push(...ruleResult.errors);
                }
                result.warnings.push(...ruleResult.warnings);
            } catch (error) {
                console.error(`Error in validation rule ${ruleName}:`, error);
                result.errors.push({
                    rule: ruleName,
                    message: `Validation rule failed: ${error.message}`
                });
                result.isValid = false;
            }
        }

        return result;
    }

    /**
     * プレイヤー状態を検証
     * @param {Object} state - ゲーム状態
     * @param {string} playerId - プレイヤーID
     * @returns {Object} 検証結果
     */
    validatePlayerState(state, playerId) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // プレイヤー存在チェック
        if (!state || !state.players || !state.players[playerId]) {
            result.isValid = false;
            result.errors.push({
                type: SetupErrorType.MISSING_PLAYER,
                message: `Player ${playerId} not found in state`
            });
            return result;
        }

        const playerState = state.players[playerId];

        // 各フィールドの検証
        const checks = [
            () => this._validateHandValid({ players: { [playerId]: playerState } }, playerId),
            () => this._validateDeckValid({ players: { [playerId]: playerState } }, playerId),
            () => this._validateBenchValid({ players: { [playerId]: playerState } }, playerId),
            () => this._validateActiveValid({ players: { [playerId]: playerState } }, playerId),
            () => this._validatePrizeValid({ players: { [playerId]: playerState } }, playerId)
        ];

        for (const check of checks) {
            const checkResult = check();
            result.errors.push(...checkResult.errors);
            result.warnings.push(...checkResult.warnings);
            if (checkResult.errors.length > 0) {
                result.isValid = false;
            }
        }

        return result;
    }

    /**
     * カード配置の妥当性を検証
     * @param {Object} state - ゲーム状態
     * @param {string} playerId - プレイヤーID
     * @param {string} cardId - カードID
     * @param {string} targetZone - 配置先ゾーン ('active' | 'bench')
     * @param {number} targetIndex - 配置先インデックス（ベンチの場合）
     * @returns {Object} 検証結果
     */
    validateCardPlacement(state, playerId, cardId, targetZone, targetIndex = 0) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 状態の基本検証
        const stateValidation = this.validatePlayerState(state, playerId);
        if (!stateValidation.isValid) {
            return stateValidation;
        }

        const playerState = state.players[playerId];

        // カードが手札に存在するか
        const card = playerState.hand.find(c => c.runtimeId === cardId || c.id === cardId);
        if (!card) {
            result.isValid = false;
            result.errors.push({
                type: SetupErrorType.CARD_NOT_FOUND,
                message: `Card ${cardId} not found in ${playerId} hand`,
                context: { playerId, cardId }
            });
            return result;
        }

        // たねポケモンかチェック
        if (card.card_type !== 'Pokémon' || card.stage !== 'BASIC') {
            result.isValid = false;
            result.errors.push({
                type: SetupErrorType.NOT_BASIC_POKEMON,
                message: `Card ${card.name_ja} is not a Basic Pokemon (type: ${card.card_type}, stage: ${card.stage})`,
                context: { playerId, cardId, cardType: card.card_type, stage: card.stage }
            });
            return result;
        }

        // 配置先の検証
        if (targetZone === 'active') {
            if (playerState.active !== null) {
                result.isValid = false;
                result.errors.push({
                    type: SetupErrorType.SLOT_OCCUPIED,
                    message: `Active slot already occupied by ${playerState.active.name_ja}`,
                    context: { playerId, targetZone, occupiedBy: playerState.active.name_ja }
                });
            }
        } else if (targetZone === 'bench') {
            if (targetIndex < 0 || targetIndex >= 5) {
                result.isValid = false;
                result.errors.push({
                    type: SetupErrorType.INVALID_INDEX,
                    message: `Invalid bench index: ${targetIndex} (must be 0-4)`,
                    context: { playerId, targetZone, targetIndex }
                });
            } else if (playerState.bench[targetIndex] !== null) {
                result.isValid = false;
                result.errors.push({
                    type: SetupErrorType.SLOT_OCCUPIED,
                    message: `Bench slot ${targetIndex} already occupied by ${playerState.bench[targetIndex].name_ja}`,
                    context: { playerId, targetZone, targetIndex, occupiedBy: playerState.bench[targetIndex].name_ja }
                });
            }
        } else {
            result.isValid = false;
            result.errors.push({
                type: SetupErrorType.INVALID_ZONE,
                message: `Invalid target zone: ${targetZone}`,
                context: { playerId, targetZone }
            });
        }

        return result;
    }

    /**
     * セットアップ完了条件を検証
     * @param {Object} state - ゲーム状態
     * @returns {Object} 検証結果
     */
    validateSetupComplete(state) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            details: {
                playerReady: false,
                cpuReady: false,
                bothReady: false
            }
        };

        // プレイヤーのセットアップ完了チェック
        if (!state?.players?.player?.active) {
            result.details.playerReady = false;
            result.warnings.push({
                message: 'Player has no active Pokemon',
                context: { playerId: 'player' }
            });
        } else if (state.players.player.active.card_type === 'Pokémon' &&
                   state.players.player.active.stage === 'BASIC') {
            result.details.playerReady = true;
        }

        // CPUのセットアップ完了チェック
        if (!state?.players?.cpu?.active) {
            result.details.cpuReady = false;
            result.warnings.push({
                message: 'CPU has no active Pokemon',
                context: { playerId: 'cpu' }
            });
        } else if (state.players.cpu.active.card_type === 'Pokémon' &&
                   state.players.cpu.active.stage === 'BASIC') {
            result.details.cpuReady = true;
        }

        result.details.bothReady = result.details.playerReady && result.details.cpuReady;
        result.isValid = result.details.bothReady;

        return result;
    }

    /**
     * マリガン必要性を検証
     * @param {Object} state - ゲーム状態
     * @param {string} playerId - プレイヤーID
     * @returns {Object} 検証結果
     */
    validateMulliganNeeded(state, playerId) {
        const result = {
            needed: false,
            hasBasicPokemon: false,
            basicPokemonCount: 0,
            cards: []
        };

        if (!state?.players?.[playerId]?.hand) {
            return result;
        }

        const hand = state.players[playerId].hand;
        const basicPokemon = hand.filter(card =>
            card.card_type === 'Pokémon' && card.stage === 'BASIC'
        );

        result.basicPokemonCount = basicPokemon.length;
        result.hasBasicPokemon = basicPokemon.length > 0;
        result.needed = !result.hasBasicPokemon;
        result.cards = basicPokemon.map(c => ({ id: c.id, name: c.name_ja }));

        return result;
    }

    // ====================================
    // 個別検証ルール
    // ====================================

    _validateStateExists(state) {
        const result = { errors: [], warnings: [] };

        if (!state) {
            result.errors.push({
                type: SetupErrorType.INVALID_STATE,
                message: 'State is null or undefined'
            });
        }

        return result;
    }

    _validatePlayersExist(state) {
        const result = { errors: [], warnings: [] };

        if (!state?.players) {
            result.errors.push({
                type: SetupErrorType.INVALID_STATE,
                message: 'Players object is missing'
            });
            return result;
        }

        if (!state.players.player) {
            result.errors.push({
                type: SetupErrorType.MISSING_PLAYER,
                message: 'Player state is missing'
            });
        }

        if (!state.players.cpu) {
            result.errors.push({
                type: SetupErrorType.MISSING_PLAYER,
                message: 'CPU state is missing'
            });
        }

        return result;
    }

    _validateHandValid(state, playerId = null) {
        const result = { errors: [], warnings: [] };

        const players = playerId ? [playerId] : ['player', 'cpu'];

        for (const pid of players) {
            const playerState = state?.players?.[pid];
            if (!playerState) continue;

            if (!Array.isArray(playerState.hand)) {
                result.errors.push({
                    type: SetupErrorType.MISSING_HAND,
                    message: `${pid} hand is not an array`,
                    context: { playerId: pid }
                });
            } else if (playerState.hand.some(card => !card || !card.id)) {
                result.warnings.push({
                    message: `${pid} hand contains invalid cards`,
                    context: { playerId: pid }
                });
            }
        }

        return result;
    }

    _validateDeckValid(state, playerId = null) {
        const result = { errors: [], warnings: [] };

        const players = playerId ? [playerId] : ['player', 'cpu'];

        for (const pid of players) {
            const playerState = state?.players?.[pid];
            if (!playerState) continue;

            if (!Array.isArray(playerState.deck)) {
                result.errors.push({
                    type: SetupErrorType.INVALID_STATE,
                    message: `${pid} deck is not an array`,
                    context: { playerId: pid }
                });
            }
        }

        return result;
    }

    _validateBenchValid(state, playerId = null) {
        const result = { errors: [], warnings: [] };

        const players = playerId ? [playerId] : ['player', 'cpu'];

        for (const pid of players) {
            const playerState = state?.players?.[pid];
            if (!playerState) continue;

            if (!Array.isArray(playerState.bench)) {
                result.errors.push({
                    type: SetupErrorType.INVALID_STATE,
                    message: `${pid} bench is not an array`,
                    context: { playerId: pid }
                });
            } else if (playerState.bench.length !== 5) {
                result.warnings.push({
                    message: `${pid} bench length is ${playerState.bench.length}, expected 5`,
                    context: { playerId: pid, length: playerState.bench.length }
                });
            }
        }

        return result;
    }

    _validateActiveValid(state, playerId = null) {
        const result = { errors: [], warnings: [] };

        const players = playerId ? [playerId] : ['player', 'cpu'];

        for (const pid of players) {
            const playerState = state?.players?.[pid];
            if (!playerState) continue;

            if (playerState.active !== null && playerState.active !== undefined) {
                if (!playerState.active.id) {
                    result.warnings.push({
                        message: `${pid} active Pokemon has no id`,
                        context: { playerId: pid }
                    });
                }
            }
        }

        return result;
    }

    _validatePrizeValid(state, playerId = null) {
        const result = { errors: [], warnings: [] };

        const players = playerId ? [playerId] : ['player', 'cpu'];

        for (const pid of players) {
            const playerState = state?.players?.[pid];
            if (!playerState) continue;

            if (!Array.isArray(playerState.prize)) {
                result.errors.push({
                    type: SetupErrorType.INVALID_STATE,
                    message: `${pid} prize is not an array`,
                    context: { playerId: pid }
                });
            } else if (playerState.prize.length > 6) {
                result.warnings.push({
                    message: `${pid} prize length is ${playerState.prize.length}, expected max 6`,
                    context: { playerId: pid, length: playerState.prize.length }
                });
            }
        }

        return result;
    }

    /**
     * 検証ルールを追加（拡張用）
     * @param {string} name - ルール名
     * @param {Function} ruleFunction - 検証関数
     */
    addRule(name, ruleFunction) {
        this.validationRules.set(name, ruleFunction);
    }

    /**
     * 検証ルールを削除
     * @param {string} name - ルール名
     */
    removeRule(name) {
        this.validationRules.delete(name);
    }

    /**
     * 利用可能なルール一覧を取得
     * @returns {Array<string>} ルール名の配列
     */
    getAvailableRules() {
        return Array.from(this.validationRules.keys());
    }
}

/**
 * デフォルトインスタンス
 */
export const setupStateValidator = new SetupStateValidator();
