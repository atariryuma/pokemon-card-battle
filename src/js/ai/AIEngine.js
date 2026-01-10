/**
 * AI ENGINE
 * 
 * ポケモンTCG AI対戦システム
 * - 3段階の難易度（Easy, Medium, Hard）
 * - 戦略的意思決定エンジン
 * - 有効な手の評価システム
 */

import * as Logic from '../logic.js';
import { GAME_PHASES } from '../phase-manager.js';

export class AIEngine {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'hard'

        // 難易度別設定
        this.config = {
            easy: {
                thinkTime: 800,           // 思考時間（ミリ秒）
                mistakeRate: 0.3,         // ミス率（30%の確率で最適でない手を選ぶ）
                lookahead: 0,             // 先読み深さ
                randomness: 0.5           // ランダム性（0-1）
            },
            medium: {
                thinkTime: 1200,
                mistakeRate: 0.1,
                lookahead: 1,
                randomness: 0.2
            },
            hard: {
                thinkTime: 1500,
                mistakeRate: 0,
                lookahead: 2,
                randomness: 0
            }
        }[difficulty];
    }

    /**
     * AI の意思決定
     * @param {Object} gameState - ゲーム状態
     * @returns {Promise<Object>} 選択された行動
     */
    async makeDecision(gameState) {
        // 思考時間のシミュレーション
        await this.delay(this.config.thinkTime);

        // 有効な手を取得
        const validMoves = this.getValidMoves(gameState);

        if (validMoves.length === 0) {
            return null; // 有効な手がない
        }

        // 難易度に応じた手の選択
        switch (this.difficulty) {
            case 'easy':
                return this.selectEasyMove(validMoves, gameState);
            case 'medium':
                return this.selectMediumMove(validMoves, gameState);
            case 'hard':
                return this.selectHardMove(validMoves, gameState);
            default:
                return this.selectMediumMove(validMoves, gameState);
        }
    }

    /**
     * 有効な手を全て列挙
     * @param {Object} state - ゲーム状態
     * @returns {Array} 有効な手の配列
     */
    getValidMoves(state) {
        const moves = [];
        const cpu = state.players.cpu;

        // 1. たねポケモンをプレイ
        cpu.hand.forEach(card => {
            if (card.card_type === 'Pokemon' && card.stage === 'Basic') {
                // バトル場が空の場合
                if (!cpu.active) {
                    moves.push({
                        type: 'PLAY_ACTIVE',
                        cardId: card.id,
                        priority: 100, // バトル場に出すのは最優先
                        description: `Play ${card.name_en} as Active`
                    });
                } else {
                    // ベンチに空きがある場合
                    const emptyBenchIndex = cpu.bench.findIndex(b => b === null);
                    if (emptyBenchIndex !== -1) {
                        moves.push({
                            type: 'PLAY_BENCH',
                            cardId: card.id,
                            benchIndex: emptyBenchIndex,
                            priority: 30,
                            description: `Play ${card.name_en} on Bench`
                        });
                    }
                }
            }
        });

        // 2. 進化
        cpu.hand.forEach(card => {
            if (card.card_type === 'Pokemon' && (card.stage === 'Stage1' || card.stage === 'Stage2')) {
                const targets = this.findEvolutionTargets(cpu, card);
                targets.forEach(target => {
                    moves.push({
                        type: 'EVOLVE',
                        cardId: card.id,
                        targetId: target.id,
                        priority: 60,
                        description: `Evolve ${target.name_en} into ${card.name_en}`
                    });
                });
            }
        });

        // 3. エネルギー付加（1ターン1回）
        if (!cpu.energyAttachedThisTurn) {
            const energyCards = cpu.hand.filter(c =>
                c.card_type === 'Basic Energy' || c.card_type === 'Special Energy'
            );

            if (energyCards.length > 0) {
                // 付加対象：バトル場＋ベンチ
                const targets = [cpu.active, ...cpu.bench.filter(b => b !== null)];

                energyCards.forEach(energyCard => {
                    targets.forEach(target => {
                        moves.push({
                            type: 'ATTACH_ENERGY',
                            energyId: energyCard.id,
                            targetId: target.id,
                            priority: 40,
                            description: `Attach ${energyCard.energy_type} Energy to ${target.name_en}`
                        });
                    });
                });
            }
        }

        // 4. 攻撃
        if (cpu.active && cpu.active.attacks) {
            cpu.active.attacks.forEach((attack, index) => {
                if (this.hasEnoughEnergy(cpu.active, attack)) {
                    const estimatedDamage = this.estimateDamage(cpu.active, state.players.player.active, attack);
                    moves.push({
                        type: 'ATTACK',
                        attackIndex: index,
                        attackName: attack.name_en,
                        priority: 80,
                        estimatedDamage,
                        description: `Use ${attack.name_en} (${estimatedDamage} damage)`
                    });
                }
            });
        }

        // 5. にげる
        const benchPokemons = cpu.bench.filter(b => b !== null);
        if (cpu.active && benchPokemons.length > 0) {
            // にげるコストをチェック
            const retreatCost = cpu.active.retreat_cost || 0;
            const hasEnoughEnergy = (cpu.active.attachedEnergy || []).length >= retreatCost;

            if (hasEnoughEnergy) {
                benchPokemons.forEach((benchPokemon, benchIndex) => {
                    moves.push({
                        type: 'RETREAT',
                        toBenchIndex: benchIndex,
                        priority: 20,
                        description: `Retreat to ${benchPokemon.name_en}`
                    });
                });
            }
        }

        return moves;
    }

    /**
     * Easy難易度の手選択（ランダム）
     */
    selectEasyMove(moves, state) {
        // 30%の確率で完全ランダム
        if (Math.random() < this.config.randomness) {
            return moves[Math.floor(Math.random() * moves.length)];
        }

        // それ以外は優先度でソートして上位からランダム
        const sortedMoves = moves.sort((a, b) => b.priority - a.priority);
        const topMoves = sortedMoves.slice(0, Math.min(5, sortedMoves.length));
        return topMoves[Math.floor(Math.random() * topMoves.length)];
    }

    /**
     * Medium難易度の手選択（良い手を選ぶ）
     */
    selectMediumMove(moves, state) {
        // スコア計算
        const scoredMoves = moves.map(move => ({
            move,
            score: this.evaluateMove(move, state, 'medium')
        }));

        // スコアでソート
        scoredMoves.sort((a, b) => b.score - a.score);

        // 10%の確率でミス（2番目の手を選ぶ）
        if (Math.random() < this.config.mistakeRate && scoredMoves.length > 1) {
            return scoredMoves[1].move;
        }

        return scoredMoves[0].move;
    }

    /**
     * Hard難易度の手選択（最善手）
     */
    selectHardMove(moves, state) {
        // スコア計算
        const scoredMoves = moves.map(move => ({
            move,
            score: this.evaluateMove(move, state, 'hard')
        }));

        // スコアでソート
        scoredMoves.sort((a, b) => b.score - a.score);

        // 常に最善手を選択
        return scoredMoves[0].move;
    }

    /**
     * 手の評価
     * @param {Object} move - 評価する手
     * @param {Object} state - ゲーム状態
     * @param {string} difficulty - 難易度
     * @returns {number} スコア
     */
    evaluateMove(move, state, difficulty) {
        let score = move.priority || 0;

        const cpu = state.players.cpu;
        const player = state.players.player;

        switch (move.type) {
            case 'ATTACK':
                // 攻撃の評価
                const targetHP = player.active ? (player.active.hp - (player.active.damage || 0)) : 0;
                const estimatedDamage = move.estimatedDamage || 0;

                // きぜつできる場合は大幅加点
                if (estimatedDamage >= targetHP && targetHP > 0) {
                    score += 150; // Knockout bonus!
                } else {
                    score += estimatedDamage; // ダメージ量に応じて加点
                }

                // Hard難易度では追加評価
                if (difficulty === 'hard') {
                    // サイドカードが少ない場合は攻撃を優先
                    if (player.prizeRemaining <= 2) {
                        score += 50; // 勝利に近い
                    }
                }
                break;

            case 'EVOLVE':
                // 進化の評価
                score += 60; // 進化は重要

                // Hard難易度では進化後の戦力を評価
                if (difficulty === 'hard') {
                    // TODO: 進化先のカードのHP・攻撃力を評価
                    score += 20;
                }
                break;

            case 'ATTACH_ENERGY':
                // エネルギー付加の評価
                score += 35;

                // 攻撃できるようになるエネルギーなら加点
                if (difficulty === 'medium' || difficulty === 'hard') {
                    // TODO: 攻撃コストとの比較
                    score += 15;
                }
                break;

            case 'PLAY_ACTIVE':
                // バトル場に出すのは最優先
                score += 100;
                break;

            case 'PLAY_BENCH':
                // ベンチポケモンの評価
                score += 25;
                break;

            case 'RETREAT':
                // にげるの評価（バトル場のポケモンが危険な場合）
                const activeHP = cpu.active ? (cpu.active.hp - (cpu.active.damage || 0)) : 0;
                const activeMaxHP = cpu.active ? cpu.active.hp : 0;

                // HPが70%以下ならにげるを検討
                if (activeHP / activeMaxHP < 0.7) {
                    score += 40;
                }

                // HPが30%以下なら強く推奨
                if (activeHP / activeMaxHP < 0.3) {
                    score += 60;
                }
                break;
        }

        return score;
    }

    /**
     * ダメージ推定
     */
    estimateDamage(attacker, defender, attack) {
        let baseDamage = attack.damage || 0;

        if (!defender) return baseDamage;

        // 弱点チェック
        if (defender.weakness && defender.weakness.length > 0) {
            for (const weak of defender.weakness) {
                if (attacker.types && attacker.types.includes(weak.type)) {
                    if (weak.value === '×2') {
                        baseDamage *= 2;
                    }
                }
            }
        }

        // 抵抗力チェック
        if (defender.resistance && defender.resistance.type !== 'None') {
            if (attacker.types && attacker.types.includes(defender.resistance.type)) {
                const reduction = parseInt(defender.resistance.value) || 0;
                baseDamage += reduction; // resistance.value is negative
            }
        }

        return Math.max(0, baseDamage);
    }

    /**
     * エネルギー判定
     */
    hasEnoughEnergy(pokemon, attack) {
        if (!pokemon || !pokemon.attachedEnergy || !attack || !attack.cost) {
            return false;
        }

        const energyCount = {};
        let totalEnergy = 0;

        pokemon.attachedEnergy.forEach(energy => {
            const type = energy.energy_type || energy.types?.[0] || 'Colorless';
            energyCount[type] = (energyCount[type] || 0) + 1;
            totalEnergy++;
        });

        let colorlessNeeded = 0;
        const requiredEnergy = {};

        // 必要なエネルギーをカウント
        attack.cost.forEach(reqType => {
            if (reqType === 'Colorless') {
                colorlessNeeded++;
            } else {
                requiredEnergy[reqType] = (requiredEnergy[reqType] || 0) + 1;
            }
        });

        // 固有タイプのエネルギーチェック
        let usedEnergy = 0;
        for (const reqType in requiredEnergy) {
            const needed = requiredEnergy[reqType];
            const available = energyCount[reqType] || 0;

            if (available < needed) {
                return false; // 足りない
            }
            usedEnergy += needed;
        }

        // 残りのエネルギーで無色コストを満たせるか
        const remainingEnergy = totalEnergy - usedEnergy;
        if (remainingEnergy < colorlessNeeded) {
            return false;
        }

        return true;
    }

    /**
     * 進化可能なポケモンを検索
     */
    findEvolutionTargets(playerState, evolutionCard) {
        const targets = [];

        if (!evolutionCard.evolves_from) {
            return targets; // 進化元が指定されていない
        }

        // バトル場＋ベンチをチェック
        const allPokemon = [playerState.active, ...playerState.bench].filter(p => p !== null);

        for (const pokemon of allPokemon) {
            // 名前が一致し、かつこのターン進化していない
            if (evolutionCard.evolves_from === pokemon.name_en && !pokemon.evolvedThisTurn) {
                targets.push(pokemon);
            }
        }

        return targets;
    }

    /**
     * 遅延処理
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 難易度変更
     */
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.config = {
            easy: { thinkTime: 800, mistakeRate: 0.3, lookahead: 0, randomness: 0.5 },
            medium: { thinkTime: 1200, mistakeRate: 0.1, lookahead: 1, randomness: 0.2 },
            hard: { thinkTime: 1500, mistakeRate: 0, lookahead: 2, randomness: 0 }
        }[difficulty];
    }
}

export default AIEngine;
