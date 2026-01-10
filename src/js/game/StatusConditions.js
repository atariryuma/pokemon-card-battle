/**
 * STATUS CONDITIONS SYSTEM
 * 
 * Pokemon TCG公式ルールに準拠した状態異常システム
 * - どく (Poisoned): ターン終了時に10ダメージ
 * - やけど (Burned): コイン投げ、ウラなら20ダメージ
 * - まひ (Paralyzed): 攻撃・にげるが不可、次のターン終了時に回復
 * - ねむり (Asleep): 攻撃・にげるが不可、コイン投げで目覚める
 * - こんらん (Confused): 攻撃前にコイン投げ、ウラなら自分に30ダメージ
 */

export const STATUS_CONDITIONS = {
    POISONED: 'poisoned',
    BURNED: 'burned',
    PARALYZED: 'paralyzed',
    ASLEEP: 'asleep',
    CONFUSED: 'confused'
};

export class StatusManager {
    /**
     * ポケモンに状態異常を付与
     * @param {Object} pokemon - ポケモンオブジェクト
     * @param {string} condition - 状態異常の種類
     * @returns {Object} 更新されたポケモン
     */
    static applyCondition(pokemon, condition) {
        if (!pokemon) return pokemon;

        // 状態異常配列を初期化（存在しない場合）
        if (!pokemon.statusConditions) {
            pokemon.statusConditions = [];
        }

        // まひ・ねむりは他の状態と同時に存在できない（公式ルール）
        if (condition === STATUS_CONDITIONS.PARALYZED || condition === STATUS_CONDITIONS.ASLEEP) {
            pokemon.statusConditions = pokemon.statusConditions.filter(
                c => c !== STATUS_CONDITIONS.PARALYZED && c !== STATUS_CONDITIONS.ASLEEP
            );
        }

        // 重複を避けて追加
        if (!pokemon.statusConditions.includes(condition)) {
            pokemon.statusConditions.push(condition);
        }

        return pokemon;
    }

    /**
     * 状態異常を解除
     * @param {Object} pokemon - ポケモンオブジェクト
     * @param {string} condition - 解除する状態異常（省略時は全て解除）
     * @returns {Object} 更新されたポケモン
     */
    static removeCondition(pokemon, condition = null) {
        if (!pokemon || !pokemon.statusConditions) return pokemon;

        if (condition) {
            pokemon.statusConditions = pokemon.statusConditions.filter(c => c !== condition);
        } else {
            pokemon.statusConditions = [];
        }

        return pokemon;
    }

    /**
     * どく状態のダメージを適用
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} 更新されたポケモン
     */
    static applyPoisonDamage(pokemon) {
        if (!pokemon || !this.hasCondition(pokemon, STATUS_CONDITIONS.POISONED)) {
            return pokemon;
        }

        // 10ダメージを追加
        pokemon.damage = (pokemon.damage || 0) + 10;

        return pokemon;
    }

    /**
     * やけど状態のダメージを適用（コイン投げ）
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} { pokemon: 更新されたポケモン, coinFlip: コイン結果 }
     */
    static applyBurnDamage(pokemon) {
        if (!pokemon || !this.hasCondition(pokemon, STATUS_CONDITIONS.BURNED)) {
            return { pokemon, coinFlip: null };
        }

        // コインを投げる
        const coinFlip = this.flipCoin();

        // ウラ（tails）なら20ダメージ
        if (coinFlip === 'tails') {
            pokemon.damage = (pokemon.damage || 0) + 20;
        }

        return { pokemon, coinFlip };
    }

    /**
     * ねむり状態の回復判定（コイン投げ）
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} { pokemon: 更新されたポケモン, awoke: 目覚めたか, coinFlip: コイン結果 }
     */
    static checkSleepAwaken(pokemon) {
        if (!pokemon || !this.hasCondition(pokemon, STATUS_CONDITIONS.ASLEEP)) {
            return { pokemon, awoke: false, coinFlip: null };
        }

        // コインを投げる
        const coinFlip = this.flipCoin();

        // オモテ（heads）なら目覚める
        if (coinFlip === 'heads') {
            pokemon = this.removeCondition(pokemon, STATUS_CONDITIONS.ASLEEP);
            return { pokemon, awoke: true, coinFlip };
        }

        return { pokemon, awoke: false, coinFlip };
    }

    /**
     * まひ状態を解除（ターン終了時）
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} 更新されたポケモン
     */
    static removeParalysis(pokemon) {
        return this.removeCondition(pokemon, STATUS_CONDITIONS.PARALYZED);
    }

    /**
     * こんらん状態の攻撃判定（コイン投げ）
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} { pokemon: 更新されたポケモン, canAttack: 攻撃可能か, coinFlip: コイン結果 }
     */
    static checkConfusionAttack(pokemon) {
        if (!pokemon || !this.hasCondition(pokemon, STATUS_CONDITIONS.CONFUSED)) {
            return { pokemon, canAttack: true, coinFlip: null };
        }

        // コインを投げる
        const coinFlip = this.flipCoin();

        // ウラ（tails）なら自分に30ダメージ
        if (coinFlip === 'tails') {
            pokemon.damage = (pokemon.damage || 0) + 30;
            return { pokemon, canAttack: false, coinFlip };
        }

        // オモテ（heads）なら攻撃可能
        return { pokemon, canAttack: true, coinFlip };
    }

    /**
     * 攻撃可能かチェック（まひ・ねむり状態では不可）
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {boolean} 攻撃可能か
     */
    static canAttack(pokemon) {
        if (!pokemon) return false;

        // まひ・ねむり状態では攻撃不可
        if (this.hasCondition(pokemon, STATUS_CONDITIONS.PARALYZED)) return false;
        if (this.hasCondition(pokemon, STATUS_CONDITIONS.ASLEEP)) return false;

        return true;
    }

    /**
     * にげる可能かチェック（まひ・ねむり状態では不可）
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {boolean} にげる可能か
     */
    static canRetreat(pokemon) {
        if (!pokemon) return false;

        // まひ・ねむり状態ではにげる不可
        if (this.hasCondition(pokemon, STATUS_CONDITIONS.PARALYZED)) return false;
        if (this.hasCondition(pokemon, STATUS_CONDITIONS.ASLEEP)) return false;

        return true;
    }

    /**
     * 特定の状態異常を持っているかチェック
     * @param {Object} pokemon - ポケモンオブジェクト
     * @param {string} condition - 状態異常の種類
     * @returns {boolean}
     */
    static hasCondition(pokemon, condition) {
        if (!pokemon || !pokemon.statusConditions) return false;
        return pokemon.statusConditions.includes(condition);
    }

    /**
     * 全ての状態異常チェック結果を取得
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} 状態異常の情報
     */
    static getConditionStatus(pokemon) {
        if (!pokemon) {
            return {
                poisoned: false,
                burned: false,
                paralyzed: false,
                asleep: false,
                confused: false,
                canAttack: true,
                canRetreat: true
            };
        }

        return {
            poisoned: this.hasCondition(pokemon, STATUS_CONDITIONS.POISONED),
            burned: this.hasCondition(pokemon, STATUS_CONDITIONS.BURNED),
            paralyzed: this.hasCondition(pokemon, STATUS_CONDITIONS.PARALYZED),
            asleep: this.hasCondition(pokemon, STATUS_CONDITIONS.ASLEEP),
            confused: this.hasCondition(pokemon, STATUS_CONDITIONS.CONFUSED),
            canAttack: this.canAttack(pokemon),
            canRetreat: this.canRetreat(pokemon)
        };
    }

    /**
     * ターン終了時の状態異常処理
     * @param {Object} pokemon - ポケモンオブジェクト
     * @returns {Object} { pokemon: 更新されたポケモン, log: ログメッセージ配列 }
     */
    static processBetweenTurns(pokemon) {
        if (!pokemon) return { pokemon, log: [] };

        const log = [];
        let updatedPokemon = { ...pokemon };

        // どくダメージ
        if (this.hasCondition(updatedPokemon, STATUS_CONDITIONS.POISONED)) {
            updatedPokemon = this.applyPoisonDamage(updatedPokemon);
            log.push(`${pokemon.name_ja}はどくのダメージを受けた！（10ダメージ）`);
        }

        // やけどダメージ
        if (this.hasCondition(updatedPokemon, STATUS_CONDITIONS.BURNED)) {
            const result = this.applyBurnDamage(updatedPokemon);
            updatedPokemon = result.pokemon;
            if (result.coinFlip === 'tails') {
                log.push(`${pokemon.name_ja}はやけどのダメージを受けた！（20ダメージ）`);
            } else {
                log.push(`${pokemon.name_ja}はやけどのダメージを受けなかった。`);
            }
        }

        // まひ解除（ターン終了時）
        if (this.hasCondition(updatedPokemon, STATUS_CONDITIONS.PARALYZED)) {
            updatedPokemon = this.removeParalysis(updatedPokemon);
            log.push(`${pokemon.name_ja}のまひ状態が回復した！`);
        }

        // ねむり判定
        if (this.hasCondition(updatedPokemon, STATUS_CONDITIONS.ASLEEP)) {
            const result = this.checkSleepAwaken(updatedPokemon);
            updatedPokemon = result.pokemon;
            if (result.awoke) {
                log.push(`${pokemon.name_ja}は目を覚ました！`);
            } else {
                log.push(`${pokemon.name_ja}はまだ眠っている...`);
            }
        }

        return { pokemon: updatedPokemon, log };
    }

    /**
     * コインを投げる（公式ルール準拠）
     * @returns {string} 'heads' または 'tails'
     */
    static flipCoin() {
        return Math.random() < 0.5 ? 'heads' : 'tails';
    }

    /**
     * 複数回コインを投げる
     * @param {number} count - 投げる回数
     * @returns {Array} コイン結果の配列
     */
    static flipCoins(count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(this.flipCoin());
        }
        return results;
    }

    /**
     * 状態異常の日本語表示名を取得
     * @param {string} condition - 状態異常の種類
     * @returns {string} 日本語名
     */
    static getConditionName(condition) {
        const names = {
            [STATUS_CONDITIONS.POISONED]: 'どく',
            [STATUS_CONDITIONS.BURNED]: 'やけど',
            [STATUS_CONDITIONS.PARALYZED]: 'まひ',
            [STATUS_CONDITIONS.ASLEEP]: 'ねむり',
            [STATUS_CONDITIONS.CONFUSED]: 'こんらん'
        };
        return names[condition] || condition;
    }
}

// デフォルトエクスポート
export default StatusManager;
