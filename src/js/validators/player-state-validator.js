/**
 * プレイヤー状態検証の責任を分割
 * 各属性ごとに独立した検証関数を提供
 */

export class PlayerStateValidator {
    /**
     * 手札の検証と修復
     */
    static validateHand(hand, playerId) {
        const result = { isValid: true, warnings: [], fixed: hand };

        if (!Array.isArray(hand)) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} hand is not an array`);
            result.fixed = [];
        }

        return result;
    }

    /**
     * デッキの検証と修復
     */
    static validateDeck(deck, playerId) {
        const result = { isValid: true, warnings: [], fixed: deck };

        if (!Array.isArray(deck)) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} deck is not an array`);
            result.fixed = [];
        }

        return result;
    }

    /**
     * ベンチの検証と修復
     */
    static validateBench(bench, playerId) {
        const result = { isValid: true, warnings: [], fixed: bench };

        if (!Array.isArray(bench)) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} bench is not an array`);
            result.fixed = Array(5).fill(null);
            return result;
        }

        if (bench.length !== 5) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} bench length is ${bench.length}, expected 5`);
            result.fixed = [...bench];
            while (result.fixed.length < 5) {
                result.fixed.push(null);
            }
            if (result.fixed.length > 5) {
                result.fixed = result.fixed.slice(0, 5);
            }
        }

        return result;
    }

    /**
     * サイドカードの検証と修復
     */
    static validatePrize(prize, playerId) {
        const result = { isValid: true, warnings: [], fixed: prize };

        if (!Array.isArray(prize)) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} prize is not an array`);
            result.fixed = [];
            return result;
        }

        // サイドカードは0〜6枚
        if (prize.length > 6) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} prize has ${prize.length} cards, max is 6`);
            result.fixed = prize.slice(0, 6);
        }

        return result;
    }

    /**
     * 捨て札の検証と修復
     */
    static validateDiscard(discard, playerId) {
        const result = { isValid: true, warnings: [], fixed: discard };

        if (!Array.isArray(discard)) {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} discard is not an array`);
            result.fixed = [];
        }

        return result;
    }

    /**
     * prizeRemainingの検証と修復
     */
    static validatePrizeRemaining(prizeRemaining, prizeArray, playerId) {
        const result = { isValid: true, warnings: [], fixed: prizeRemaining };

        if (typeof prizeRemaining !== 'number') {
            result.isValid = false;
            result.warnings.push(`Player ${playerId} prizeRemaining is not a number`);
            result.fixed = prizeArray ? prizeArray.length : 0;
            return result;
        }

        if (prizeArray && prizeRemaining !== prizeArray.length) {
            result.isValid = false;
            result.warnings.push(
                `Player ${playerId} prizeRemaining (${prizeRemaining}) !== prize.length (${prizeArray.length})`
            );
            result.fixed = prizeArray.length;
        }

        return result;
    }

    /**
     * プレイヤー状態全体の検証（上記関数を統合）
     */
    static validatePlayerState(playerState, playerId, context = 'unknown') {
        const result = {
            isValid: true,
            warnings: [],
            fixedPlayerState: { ...playerState },
        };

        // 各属性を順に検証
        const handResult = this.validateHand(playerState.hand, playerId);
        const deckResult = this.validateDeck(playerState.deck, playerId);
        const benchResult = this.validateBench(playerState.bench, playerId);
        const prizeResult = this.validatePrize(playerState.prize, playerId);
        const discardResult = this.validateDiscard(playerState.discard, playerId);
        const prizeRemainingResult = this.validatePrizeRemaining(
            playerState.prizeRemaining,
            playerState.prize,
            playerId
        );

        // 結果をマージ
        if (!handResult.isValid) {
            result.isValid = false;
            result.warnings.push(...handResult.warnings);
            result.fixedPlayerState.hand = handResult.fixed;
        }

        if (!deckResult.isValid) {
            result.isValid = false;
            result.warnings.push(...deckResult.warnings);
            result.fixedPlayerState.deck = deckResult.fixed;
        }

        if (!benchResult.isValid) {
            result.isValid = false;
            result.warnings.push(...benchResult.warnings);
            result.fixedPlayerState.bench = benchResult.fixed;
        }

        if (!prizeResult.isValid) {
            result.isValid = false;
            result.warnings.push(...prizeResult.warnings);
            result.fixedPlayerState.prize = prizeResult.fixed;
        }

        if (!discardResult.isValid) {
            result.isValid = false;
            result.warnings.push(...discardResult.warnings);
            result.fixedPlayerState.discard = discardResult.fixed;
        }

        if (!prizeRemainingResult.isValid) {
            result.isValid = false;
            result.warnings.push(...prizeRemainingResult.warnings);
            result.fixedPlayerState.prizeRemaining = prizeRemainingResult.fixed;
        }

        return result;
    }
}
