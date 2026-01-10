/**
 * TURN-MANAGER.JS - ターンシーケンス管理
 *
 * プレイヤーとCPUのターン進行、制約管理、自動処理を統括
 */

import { animate } from './animation-manager.js';
import { CardOrientationManager } from './card-orientation.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry, updateTurnState } from './state.js';
import * as Logic from './logic.js';
import { noop } from './utils.js';
import { eventBus, GameEventTypes } from './core/event-bus.js';
import { GAME_CONFIG } from './constants/game-config.js';
import StatusManager from './game/StatusConditions.js';
import AIEngine from './ai/AIEngine.js';

/**
 * ターン管理クラス
 */
export class TurnManager {
  constructor() {
    this.turnActions = []; // ターン内でのアクション履歴
    // CPU思考時間は統一定数から取得
    this.cpuThinkingTime = {
      min: GAME_CONFIG.CPU_THINKING.MIN,
      max: GAME_CONFIG.CPU_THINKING.MAX
    };

    // 非同期処理管理
    this.pendingOperations = new Set();
    this.phaseTransitions = [];

    // AI Engine (default: medium difficulty)
    this.aiEngine = new AIEngine('medium');
  }

  /**
   * AI難易度を設定
   * @param {'easy'|'medium'|'hard'} difficulty - 難易度
   */
  setAIDifficulty(difficulty) {
    this.aiEngine.setDifficulty(difficulty);
    noop(`🤖 AI difficulty set to: ${difficulty}`);
  }

  /**
   * 非同期処理の同期化
   */
  async _waitForPendingOperations() {
    if (this.pendingOperations.size > 0) {
      await Promise.all(Array.from(this.pendingOperations));
      this.pendingOperations.clear();
    }
  }

  async _trackAsyncOperation(operation) {
    const promise = Promise.resolve(operation);
    this.pendingOperations.add(promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingOperations.delete(promise);
    }
  }

  /**
   * プレイヤーターン開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async startPlayerTurn(state) {
    noop('🎯 Starting player turn...');

    // 保留中の操作が完了するまで待機
    await this._waitForPendingOperations();

    let newState = cloneGameState(state);

    // ターン数増加（最初のターンは既に1なので、2ターン目から増加）
    if (newState.turnPlayer === 'player' && newState.turn > 1) {
      newState.turn++;
    }

    // ターンステートをリセット（プレイヤーターン開始時）
    newState.turnState = {
      hasAttacked: false,
      hasDrawn: false,
      energyAttached: 0,
      turnNumber: newState.turnState?.turnNumber || 1,
      canRetreat: true,
      canPlaySupporter: true
    };

    // Legacy ターン制約リセット（互換性のため）
    newState.turnPlayer = 'player';

    // 特殊状態処理（毒、火傷など）
    newState = await this._trackAsyncOperation(
      this.processSpecialConditions(newState, 'player')
    );

    // ドローフェーズに移行
    newState.phase = GAME_PHASES.PLAYER_DRAW;
    newState.prompt.message = '山札をクリックしてカードを引いてください。';

    this.turnActions = [];

    newState = addLogEntry(newState, {
      type: 'turn_start',
      player: 'player',
      message: `プレイヤーのターン ${newState.turn} 開始`
    });
    return newState;
  }

  /**
   * プレイヤードローフェーズ処理
   */
  async handlePlayerDraw(state) {
    noop('🎴 Player draw phase...');
    let newState = cloneGameState(state);

    // 自動ドロー（最初のターンのみ選択制、以降は強制）
    if (!newState.turnState.hasDrawn) {
      newState = Logic.drawCard(newState, 'player');

      // ドローアニメーション
      await this.animateCardDraw('player');

      // メインフェーズに自動移行


      newState = addLogEntry(newState, {
        type: 'card_draw',
        player: 'player',
        message: 'カードを1枚引きました'
      });
    }

    return newState;
  }

  /**
   * プレイヤーメインフェーズ処理
   */
  handlePlayerMainPhase(state, action, actionData = {}) {
    noop(`🎮 Player main phase action: ${action}`, actionData);
    let newState = cloneGameState(state);

    this.turnActions.push({ action, data: actionData, timestamp: Date.now() });

    switch (action) {
      case 'play_basic_pokemon':
        newState = this.handlePlayBasicPokemon(newState, actionData);
        break;

      case 'attach_energy':
        newState = this.handleAttachEnergy(newState, actionData);
        break;

      case 'use_trainer':
        newState = this.handleUseTrainer(newState, actionData);
        break;

      case 'retreat_pokemon':
        newState = this.handleRetreat(newState, actionData);
        break;

      case 'declare_attack':
        newState = this.handleAttackDeclaration(newState, actionData);
        break;

      case 'end_turn':
        newState = this.endPlayerTurn(newState);
        break;

      default:
        console.warn(`Unknown player action: ${action}`);
    }

    return newState;
  }

  /**
   * たねポケモンをベンチに出す処理
   */
  handlePlayBasicPokemon(state, { cardId, benchIndex }) {
    let newState = Logic.placeCardOnBench(state, 'player', cardId, benchIndex);

    if (newState !== state) {
      newState = addLogEntry(newState, {
        type: 'pokemon_played',
        player: 'player',
        message: 'たねポケモンをベンチに出しました'
      });
    }

    return newState;
  }

  /**
   * エネルギー付与処理
   */
  handleAttachEnergy(state, { energyId, pokemonId }) {
    if (state.turnState.energyAttached > 0) {
      console.warn('Already attached energy this turn');
      return state;
    }

    let newState = Logic.attachEnergy(state, 'player', energyId, pokemonId);

    if (newState !== state) {
      newState = addLogEntry(newState, {
        type: 'energy_attached',
        player: 'player',
        message: 'エネルギーをポケモンに付けました'
      });
    }

    return newState;
  }

  /**
   * トレーナーズ使用処理
   */
  handleUseTrainer(state, { cardId, trainerType }) {
    // トレーナーズ処理は今回は簡略化
    let newState = cloneGameState(state);

    newState = addLogEntry(newState, {
      type: 'trainer_used',
      player: 'player',
      message: 'トレーナーズを使用しました'
    });

    return newState;
  }

  /**
   * にげる処理
   */
  handleRetreat(state, { fromActiveId, toBenchIndex }) {
    if (!state.canRetreat) {
      console.warn('Cannot retreat this turn');
      return state;
    }

    let newState = Logic.retreat(state, 'player', fromActiveId, toBenchIndex);

    if (newState !== state) {
      newState.canRetreat = false;
      newState = addLogEntry(newState, {
        type: 'pokemon_retreated',
        player: 'player',
        message: 'ポケモンがにげました'
      });
    }

    return newState;
  }

  /**
   * プレイヤーが攻撃可能かチェック
   */
  canPlayerAttack(state) {
    // 基本チェック
    if (state.turnState?.hasAttacked) return false;
    if (state.turnPlayer !== 'player') return false;
    if (state.phase !== GAME_PHASES.PLAYER_MAIN) return false;

    // ポケモン・エネルギーチェック
    const activePokemon = state.players.player.active;
    if (!activePokemon || !activePokemon.attacks) return false;

    // 使用可能な攻撃があるかチェック（Logic.jsを正しくimportして使用）
    return activePokemon.attacks.some(attack => {
      return Logic.hasEnoughEnergy(activePokemon, attack);
    });
  }

  /**
   * 攻撃宣言処理
   */
  handleAttackDeclaration(state, { attackIndex }) {
    let newState = cloneGameState(state);

    // 攻撃制限チェック
    if (newState.turnState.hasAttacked) {
      throw new Error('このターンは既に攻撃しました');
    }

    // 攻撃済みフラグを設定
    newState.turnState.hasAttacked = true;

    // 攻撃フェーズに移行
    newState.phase = GAME_PHASES.PLAYER_ATTACK;
    newState.pendingAction = {
      type: 'attack',
      attackIndex,
      attacker: 'player'
    };
    newState.prompt.message = '攻撃を実行中...';

    return newState;
  }

  /**
   * 攻撃実行処理
   */
  async executeAttack(state) {
    noop('⚔️ Executing attack...');
    let newState = cloneGameState(state);

    // 変数をtryブロックの外で定義
    let attacker, attackIndex;

    try {
      if (!newState.pendingAction || newState.pendingAction.type !== 'attack') {
        return newState;
      }

      ({ attackIndex, attacker } = newState.pendingAction);
      const defender = attacker === 'player' ? 'cpu' : 'player';

      noop(`🗡️ ${attacker} attacks ${defender} with attack index ${attackIndex}`);

      // 攻撃前の状態ログ
      const attackerPokemon = newState.players[attacker].active;
      const defenderPokemon = newState.players[defender].active;
      noop(`👊 Attacker: ${attackerPokemon?.name_ja} (HP: ${attackerPokemon?.hp - (attackerPokemon?.damage || 0)}/${attackerPokemon?.hp})`);
      noop(`🛡️ Defender: ${defenderPokemon?.name_ja} (HP: ${defenderPokemon?.hp - (defenderPokemon?.damage || 0)}/${defenderPokemon?.hp})`);

      // 攻撃実行
      newState = Logic.performAttack(newState, attacker, attackIndex);

      // 攻撃後の状態ログ（簡潔なゲームログ）
      const defenderAfter = newState.players[defender].active;
      const atkMon = newState.players[attacker].active;
      const usedAttack = atkMon?.attacks?.[attackIndex];
      const dealt = defenderAfter && defenderPokemon ? (defenderAfter.damage - (defenderPokemon.damage || 0)) : 0;
      newState = addLogEntry(newState, {
        type: 'attack',
        player: attacker,
        message: `${atkMon?.name_ja || '不明'}の「${usedAttack?.name_ja || 'ワザ'}」で${dealt > 0 ? dealt : 0}ダメージ`
      });

      // ✅ Three.js専用: 攻撃アニメーション（タイプ別エフェクト付き）
      const attackerAfter = newState.players[attacker].active;
      const attack = attackerAfter.attacks[attackIndex];
      const primaryType = attackerAfter.types && attackerAfter.types[0] ? attackerAfter.types[0] : 'Colorless';

      // 戦闘アニメーションシーケンス（新API使用）
      // ✅ runtimeIdを使用（Three.jsがカードを識別するため）
      const finalDamage = defenderAfter ? (defenderAfter.damage - (defenderPokemon?.damage || 0)) : 0;
      const targetRuntimeId = defenderAfter ? defenderAfter.runtimeId : null;

      if (targetRuntimeId) {
        // Get the actual attacker Pokemon runtimeId
        const attackerPokemon = newState.players[attacker].active;
        const attackerRuntimeId = attackerPokemon ? attackerPokemon.runtimeId : null;

        await animate.attackSequence(primaryType.toLowerCase(), finalDamage, targetRuntimeId, {
          attackerId: attackerRuntimeId,
          attackIndex
        });
      }

      // きぜつチェックとアニメーション
      const defenderStateBeforeKO = newState.players[defender];
      const isKnockout = defenderStateBeforeKO.active && defenderStateBeforeKO.active.damage >= defenderStateBeforeKO.active.hp;

      if (isKnockout) {
        // ノックアウトのログ
        if (defenderStateBeforeKO.active) {
          newState = addLogEntry(newState, {
            type: 'knockout',
            player: defender,
            message: `${defenderStateBeforeKO.active.name_ja}がきぜつ`
          });
        }
        // Play knockout animation with unified API
        // ✅ runtimeIdを使用（Three.jsがカードを識別するため）
        await animate.knockout(defenderStateBeforeKO.active.runtimeId, {
          playerId: defender
        });

        // Process knockout logic (sets up prize selection phase)
        newState = Logic.checkForKnockout(newState, defender);

        // Store that this attack caused a knockout for later turn management
        newState.attackCausedKnockout = true;
        newState.knockoutAttacker = attacker;

        // Clear pending action and return - prize selection phase will handle next steps
        newState.pendingAction = null;
        return newState;
      }

      // ペンディングアクションクリア
      newState.pendingAction = null;

      // 勝敗判定（新アクティブ選択が不要な場合のみ）
      newState = Logic.checkForWinner(newState);
      if (newState.phase === GAME_PHASES.GAME_OVER) {
        noop('🏆 Game ended after attack:', newState.winner, newState.gameEndReason);
        return newState;
      }

      // 攻撃後はターン終了（自動）
      if (attacker === 'player') {
        newState = this.endPlayerTurn(newState);
      } else {
        newState = await this.endCpuTurn(newState);
      }

      newState = addLogEntry(newState, {
        type: 'attack_executed',
        player: attacker,
        message: `攻撃を実行しました`
      });

      return newState;
    } catch (error) {
      console.error('攻撃実行中にエラーが発生しました:', error);

      // attacker変数が定義されている場合のみ処理実行
      if (attacker && attackIndex !== undefined) {
        // エラー時も基本的な攻撃処理は実行
        newState = Logic.performAttack(newState, attacker, attackIndex);
        newState.pendingAction = null;

        // 攻撃後のターン終了処理
        if (attacker === 'player') {
          newState = this.endPlayerTurn(newState);
        } else {
          newState = await this.endCpuTurn(newState);
        }
      } else {
        console.warn('攻撃者情報が不完全なため、エラー時の攻撃処理をスキップします');
        newState.pendingAction = null;
      }

      return newState;
    }
  }

  /**
   * プレイヤーターン終了
   */
  endPlayerTurn(state) {
    noop('🔄 Ending player turn...');
    let newState = cloneGameState(state);

    // ターンステートをリセット（攻撃制限等をクリア）
    newState.turnState = {
      hasAttacked: false,
      hasDrawn: false,
      energyAttached: 0,
      turnNumber: newState.turnState.turnNumber + 1, // ターン番号のみ増加
      canRetreat: true,
      canPlaySupporter: true
    };

    // Legacy フラグもリセット（互換性のため）

    newState.phase = GAME_PHASES.CPU_TURN;
    newState.turnPlayer = 'cpu';
    newState.prompt.message = '相手のターンです...';

    newState = addLogEntry(newState, {
      type: 'turn_end',
      player: 'player',
      message: 'プレイヤーのターン終了'
    });

    return newState;
  }

  /**
   * CPUターン開始
   */
  async startCpuTurn(state) {
    noop('🤖 Starting CPU turn...');
    let newState = cloneGameState(state);

    // ターン数増加
    newState.turn++;

    // ターン制約リセット
    newState.turnPlayer = 'cpu';

    // 特殊状態処理
    newState = this.processSpecialConditions(newState, 'cpu');

    // CPUの思考時間
    await this.simulateCpuThinking();

    newState = addLogEntry(newState, {
      type: 'turn_start',
      player: 'cpu',
      message: `CPUのターン ${newState.turn} 開始`
    });
    return newState;
  }

  /**
   * CPUターンを一括で処理
   * @param {object} state - 現在のゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async takeCpuTurn(state) {
    let newState = await this.startCpuTurn(state);
    newState = await this.executeCpuTurn(newState);
    return newState;
  }

  /**
   * CPU自動ターン実行
   */
  async executeCpuTurn(state) {
    noop('🎯 Executing CPU turn...');
    let newState = cloneGameState(state);

    // 1. バトルポケモンがいない場合はベンチから昇格
    if (!newState.players.cpu.active) {
      newState = await this.cpuPromoteToActive(newState);
      if (!newState.players.cpu.active) {
        // 昇格できない場合はゲーム終了
        return Logic.checkForWinner(newState);
      }
    }

    // 2. ドロー
    newState = Logic.drawCard(newState, 'cpu');
    newState = updateTurnState(newState, { hasDrawn: true });
    await this.animateCardDraw('cpu');
    await this.simulateCpuThinking(300);

    // 3. にげるを検討
    newState = await this.cpuConsiderRetreat(newState);

    // 4. たねポケモンをベンチに出す（可能なら）
    newState = await this.cpuPlayBasicPokemon(newState);
    await this.simulateCpuThinking(500);

    // 5. 進化（可能なら）
    newState = await this.cpuEvolvePokemon(newState);

    // 6. エネルギーを付ける（可能なら）
    newState = await this.cpuAttachEnergy(newState);
    await this.simulateCpuThinking(400);

    // 7. 攻撃（可能なら）
    const canAttack = this.cpuCanAttack(newState);
    if (canAttack) {
      newState = await this.cpuPerformAttack(newState);
    } else {
      // 攻撃できない場合はターン終了
      newState = await this.endCpuTurn(newState);
    }

    return newState;
  }

  /**
   * CPU: ベンチからバトル場に昇格（戦略的AI）
   */
  async cpuPromoteToActive(state) {
    let newState = cloneGameState(state);
    const benchPokemon = newState.players.cpu.bench.map((p, index) => ({ pokemon: p, originalIndex: index })).filter(item => item.pokemon !== null);

    if (benchPokemon.length > 0) {
      let bestCandidate = null;
      let maxScore = -1;

      for (const candidate of benchPokemon) {
        const p = candidate.pokemon;
        let score = 0;

        // 1. すぐに攻撃できるか
        if (p.attacks && p.attacks.some(attack => Logic.hasEnoughEnergy(p, attack))) {
          score += 100;
        }

        // 2. HPの高さ
        score += p.hp || 0;

        // 3. にげるコストの低さ（コストが高いほど減点）
        score -= (p.retreat_cost || 0) * 20;

        // 4. エネルギーがついているか
        score += (p.attached_energy?.length || 0) * 10;

        if (score > maxScore) {
          maxScore = score;
          bestCandidate = candidate;
        }
      }

      const selectedIndex = bestCandidate.originalIndex;
      newState = Logic.promoteToActive(newState, 'cpu', selectedIndex);

      await this.simulateCpuThinking();

      // CPU新アクティブ選択完了後の勝敗判定
      newState = Logic.checkForWinner(newState);
      if (newState.phase === GAME_PHASES.GAME_OVER) {
        noop('🏆 Game ended after CPU new active selection:', newState.winner, newState.gameEndReason);
        return newState;
      }

      // 新しいポケモンがバトル場に出たので、フェーズをCPUのメインフェーズに戻す
      newState.phase = GAME_PHASES.CPU_MAIN;
      newState.prompt.message = '相手のターンです...';
      newState.playerToAct = null; // 行動待ちプレイヤーをリセット

      newState = addLogEntry(newState, {
        type: 'pokemon_promoted',
        player: 'cpu',
        message: `CPUが${newState.players.cpu.active.name_ja}をバトル場に出しました`
      });
    } else {
      // ベンチにポケモンがいない場合、CPUはポケモンを出せないためゲーム終了
      newState = Logic.checkForWinner(newState);
      if (newState.phase !== GAME_PHASES.GAME_OVER) {
        newState = await this.endCpuTurn(newState);
      }
    }

    return newState;
  }

  /**
   * CPU: たねポケモンをベンチに出す（戦略的AI）
   */
  async cpuPlayBasicPokemon(state) {
    let newState = cloneGameState(state);
    const cpuState = newState.players.cpu;

    const emptyBenchIndex = cpuState.bench.findIndex(slot => slot === null);
    if (emptyBenchIndex === -1) {
      return newState; // ベンチに空きがない
    }

    const basicPokemonInHand = cpuState.hand.filter(card =>
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    if (basicPokemonInHand.length > 0) {
      let bestPokemonToPlay = null;
      let maxScore = -1;

      for (const pokemon of basicPokemonInHand) {
        let score = 0;
        // 1. HP
        score += pokemon.hp || 0;
        // 2. 最大攻撃力
        if (pokemon.attacks && pokemon.attacks.length > 0) {
          const maxDamage = Math.max(...pokemon.attacks.map(a => a.damage || 0));
          score += maxDamage;
        }
        // 3. 特性の有無
        if (pokemon.ability) {
          score += 30; // 特性持ちを評価
        }

        if (score > maxScore) {
          maxScore = score;
          bestPokemonToPlay = pokemon;
        }
      }

      if (bestPokemonToPlay) {
        newState = Logic.placeCardOnBench(newState, 'cpu', bestPokemonToPlay.id, emptyBenchIndex);

        // ✅ flow.js削除: animate.cardMoveを使用
        try {
          await animate.cardMove('cpu', bestPokemonToPlay.id, 'hand->bench', {
            benchIndex: emptyBenchIndex,
            card: bestPokemonToPlay
          });
        } catch (e) {
          console.warn('CPU bench place animation failed:', e);
        }

        newState = addLogEntry(newState, {
          type: 'pokemon_played',
          player: 'cpu',
          message: `CPUが${bestPokemonToPlay.name_ja}をベンチに出しました`
        });
      }
    }

    return newState;
  }

  /**
   * CPU: ポケモンを進化させる（戦略的AI）
   */
  async cpuEvolvePokemon(state) {
    let newState = cloneGameState(state);
    const cpuState = newState.players.cpu;

    // ターン1と、先攻プレイヤーの最初の番は進化できないルール
    if (newState.turn === 1) {
      return newState;
    }

    let evolutionPerformed = false;

    // 複数回進化できるようにループ
    for (let i = 0; i < 5; i++) { // 念のため無限ループを避ける
      let bestEvolution = null;
      let maxScore = -1;

      const pokemonOnBoard = [cpuState.active, ...cpuState.bench].filter(p => p);
      const cardsInHand = cpuState.hand;

      // 進化可能な組み合わせを探す
      for (const pokemon of pokemonOnBoard) {
        if (pokemon.turnPlayed === newState.turn) continue; // このターンに出したポケモンは進化不可

        for (const card of cardsInHand) {
          if (card.evolves_from === pokemon.name_en) {
            // 進化後の強さを評価
            let score = (card.hp || 0) + Math.max(...(card.attacks || []).map(a => a.damage || 0));
            if (pokemon.id === cpuState.active?.id) {
              score += 20; // バトル場のポケモンを優先
            }

            if (score > maxScore) {
              maxScore = score;
              bestEvolution = { evolutionCard: card, targetPokemon: pokemon };
            }
          }
        }
      }

      if (bestEvolution) {
        newState = Logic.evolvePokemon(newState, 'cpu', bestEvolution.evolutionCard.id, bestEvolution.targetPokemon.id);
        evolutionPerformed = true;
        // 1回進化したら、次の進化を探すために手札と場の状況を再評価
        // （ループの次のイテレーションで自動的に行われる）
      } else {
        break; // 進化できるポケモンがもういない
      }
    }

    if (evolutionPerformed) {
      await this.simulateCpuThinking(800);
    }

    return newState;
  }

  /**
   * CPU: エネルギー付与（戦略的AI）
   */
  async cpuAttachEnergy(state) {
    let newState = cloneGameState(state);
    if (newState.turnState.energyAttached > 0) {
      return newState;
    }

    const cpuState = newState.players.cpu;
    const energyCards = cpuState.hand.filter(card => card.card_type === 'Basic Energy' || card.card_type === 'Special Energy');
    if (energyCards.length === 0) {
      return newState; // No energy to attach
    }

    const allPokemon = [cpuState.active, ...cpuState.bench].filter(p => p);
    if (allPokemon.length === 0) {
      return newState; // No pokemon to attach to
    }

    let bestAttachment = null;
    let bestAttackDamage = -1;

    // Find the best pokemon and energy combination
    for (const pokemon of allPokemon) {
      if (!pokemon.attacks) continue;

      for (const energy of energyCards) {
        // Simulate attaching this energy
        const tempPokemon = { ...pokemon, attached_energy: [...(pokemon.attached_energy || []), energy] };

        // Check if any new attacks become usable
        for (const attack of tempPokemon.attacks) {
          const canUseNow = Logic.hasEnoughEnergy(tempPokemon, attack);
          const couldUseBefore = Logic.hasEnoughEnergy(pokemon, attack);

          if (canUseNow && !couldUseBefore) {
            // This attachment enables an attack. Is it the best one so far?
            const currentDamage = attack.damage || 0;
            if (currentDamage > bestAttackDamage) {
              bestAttackDamage = currentDamage;
              bestAttachment = { pokemon, energy };
            }
          }
        }
      }
    }

    // If we found a good candidate, attach the energy
    if (bestAttachment) {
      const { pokemon, energy } = bestAttachment;
      newState = Logic.attachEnergy(newState, 'cpu', energy.id, pokemon.id);
      if (newState !== state) {
        // ✅ runtimeIdを使用（Three.jsがカードを識別するため）
        await animate.energyAttach(energy.runtimeId || energy.id, pokemon.runtimeId, newState);
      }
      return newState;
    }

    // FALLBACK: If no pokemon is close to attacking, attach to the active pokemon
    if (cpuState.active) {
      const energyToAttach = energyCards[0];
      newState = Logic.attachEnergy(newState, 'cpu', energyToAttach.id, cpuState.active.id);
      if (newState !== state) {
        // ✅ runtimeIdを使用（Three.jsがカードを識別するため）
        await animate.energyAttach(energyToAttach.runtimeId || energyToAttach.id, cpuState.active.runtimeId, newState);
      }
      return newState;
    }

    // FINAL FALLBACK: If no active pokemon, attach to the first pokemon on bench
    if (allPokemon.length > 0) {
      const energyToAttach = energyCards[0];
      const targetPokemon = allPokemon[0];
      newState = Logic.attachEnergy(newState, 'cpu', energyToAttach.id, targetPokemon.id);
      if (newState !== state) {
        // ✅ runtimeIdを使用（Three.jsがカードを識別するため）
        await animate.energyAttach(energyToAttach.runtimeId || energyToAttach.id, targetPokemon.runtimeId, newState);
      }
    }

    return newState;
  }

  /**
   * CPU攻撃可能チェック
   */
  cpuCanAttack(state) {
    const activePokemon = state.players.cpu.active;
    if (!activePokemon || !activePokemon.attacks) return false;

    return activePokemon.attacks.some(attack =>
      Logic.hasEnoughEnergy(activePokemon, attack)
    );
  }

  /**
   * CPU攻撃実行
   */
  async cpuPerformAttack(state) {
    let newState = cloneGameState(state);
    const activePokemon = newState.players.cpu.active;

    const usableAttacks = activePokemon.attacks
      .map((attack, index) => ({ ...attack, index }))
      .filter(attack => Logic.hasEnoughEnergy(activePokemon, attack));

    if (usableAttacks.length > 0) {
      // 戦略的AI: 相手を倒せる攻撃を優先、次に高ダメージ攻撃を選択
      const bestAttack = this._selectBestAttack(newState, usableAttacks, activePokemon);

      newState.phase = GAME_PHASES.CPU_ATTACK;
      newState.pendingAction = {
        type: 'attack',
        attackIndex: bestAttack.index,
        attacker: 'cpu'
      };

      // 攻撃実行
      newState = await this.executeAttack(newState);

    }

    return newState;
  }

  /**
   * CPU戦略的攻撃選択
   */
  _selectBestAttack(state, usableAttacks, attacker) {
    const defender = state.players.player.active;
    if (!defender) return usableAttacks[0];

    const attackScores = usableAttacks.map(attack => {
      let score = attack.damage || 0;
      const remainingHP = defender.hp - (defender.damage || 0);

      // 相手を倒せる攻撃に高い優先度
      if (score >= remainingHP) {
        score += 100; // KOボーナス
      }

      // 弱点を突ける場合の追加スコア
      if (defender.weakness && attacker.types) {
        // weakness is an object with {type: string, value: string}
        if (typeof defender.weakness === 'object' && defender.weakness.type) {
          if (attacker.types.includes(defender.weakness.type)) {
            score += 50; // 弱点ボーナス
          }
        }
        // fallback for array format
        else if (Array.isArray(defender.weakness)) {
          if (defender.weakness.some(w => attacker.types.includes(w.type))) {
            score += 50; // 弱点ボーナス
          }
        }
      }

      return { ...attack, score };
    });

    // スコア順にソート
    attackScores.sort((a, b) => b.score - a.score);

    // 上位攻撃からランダム選択（完全に予測可能にしない）
    const topAttacks = attackScores.filter(attack =>
      attack.score >= attackScores[0].score - 10
    );

    return topAttacks[Math.floor(Math.random() * topAttacks.length)];
  }

  /**
   * CPU: にげるを検討する（戦略的AI）
   */
  async cpuConsiderRetreat(state) {
    let newState = cloneGameState(state);
    const { active, bench } = newState.players.cpu;

    if (!active || !newState.canRetreat) {
      return newState;
    }

    const damagePercentage = (active.damage || 0) / active.hp;
    const hasEnoughEnergyForRetreat = (active.attached_energy?.length || 0) >= (active.retreat_cost || 0);

    // HPが60%以上削られていて、にげるエネルギーがある場合
    if (damagePercentage >= 0.6 && hasEnoughEnergyForRetreat) {
      // ベンチに交代できるポケモンがいるか探す
      const healthyBenchPokemon = bench
        .map((p, index) => ({ pokemon: p, originalIndex: index }))
        .filter(item => item.pokemon && ((item.pokemon.damage || 0) / item.pokemon.hp) < 0.5);

      if (healthyBenchPokemon.length > 0) {
        // 最もHPが高いポケモンを交代先として選ぶ
        healthyBenchPokemon.sort((a, b) => b.pokemon.hp - a.pokemon.hp);
        const bestCandidateIndex = healthyBenchPokemon[0].originalIndex;

        const { newState: retreatedState, discardedEnergy } = Logic.retreat(newState, 'cpu', active.id, bestCandidateIndex);

        if (retreatedState !== newState) {
          // アニメーションなどをここに追加可能
          await this.simulateCpuThinking(600);
          retreatedState.canRetreat = false; // にげるは1ターンに1回
          return retreatedState;
        }
      }
    }

    return newState;
  }

  /**
   * CPUターン終了
   */
  async endCpuTurn(state) {
    noop('🔄 Ending CPU turn...');
    let newState = cloneGameState(state);

    newState = addLogEntry(newState, {
      type: 'turn_end',
      player: 'cpu',
      message: 'CPUのターン終了'
    });

    // プレイヤーターンに戻る
    return await this.startPlayerTurn(newState);
  }

  /**
   * 特殊状態処理（毒、火傷など）
   */
  processSpecialConditions(state, playerId) {
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];

    if (!playerState.active) {
      return newState; // アクティブポケモンがいない
    }

    const pokemon = playerState.active;

    // StatusManagerを使用してターン間処理を実行
    const result = StatusManager.processBetweenTurns(pokemon);

    // 更新されたポケモンを適用
    playerState.active = result.pokemon;

    // ログメッセージを追加
    result.log.forEach(message => {
      newState = addLogEntry(newState, {
        type: 'status_condition',
        player: playerId,
        message: message
      });
    });

    // アニメーション実行（状態異常に応じて）
    const status = StatusManager.getConditionStatus(result.pokemon);

    if (status.poisoned) {
      animate.effect.condition('poisoned', pokemon.runtimeId || pokemon.id).catch(console.warn);
    }

    if (status.burned) {
      animate.effect.condition('burned', pokemon.runtimeId || pokemon.id).catch(console.warn);
    }

    if (status.confused) {
      animate.effect.condition('confused', pokemon.runtimeId || pokemon.id).catch(console.warn);
    }

    if (status.asleep) {
      animate.effect.condition('asleep', pokemon.runtimeId || pokemon.id).catch(console.warn);
    }

    if (status.paralyzed) {
      animate.effect.condition('paralyzed', pokemon.runtimeId || pokemon.id).catch(console.warn);
    }

    // きぜつチェック
    if (result.pokemon.damage >= result.pokemon.hp) {
      noop(`⚠️ ${result.pokemon.name_ja} was knocked out by status conditions!`);
      newState = Logic.checkForKnockout(newState, playerId);
    }

    return newState;
  }

  /**
   * カードドローアニメーション
   */
  async animateCardDraw(playerId) {
    const handElement = playerId === 'player'
      ? document.getElementById('player-hand')
      : document.getElementById('cpu-hand');

    if (handElement) {
      const cards = handElement.querySelectorAll('.relative');
      const lastCard = cards.length ? cards[cards.length - 1] : null;
      if (lastCard) {
        await animate.cardDraw("player", lastCard);
      }
    }
  }

  /**
   * 攻撃アニメーション
   */
  async animateAttack(attackerId, state) {
    const defenderId = attackerId === 'player' ? 'cpu' : 'player';
    await animate.attackSequence("normal", 50, defenderId, { attackerId: attackerId });
  }


  /**
   * CPU思考時間シミュレーション
   */
  async simulateCpuThinking(baseTime = null) {
    const thinkTime = baseTime || (
      Math.random() * (this.cpuThinkingTime.max - this.cpuThinkingTime.min) + this.cpuThinkingTime.min
    );

    await new Promise(resolve => setTimeout(resolve, thinkTime));
  }

  /**
   * ターンアクション履歴取得
   */
  getTurnActions() {
    return [...this.turnActions];
  }


  /**
   * Handle new active pokemon selection after knockout
   */
  async handleNewActiveSelection(state, benchIndex) {
    let newState = Logic.promoteToActive(state, state.playerToAct, benchIndex);

    if (newState !== state) {
      // Add promotion animation for both player and CPU
      const playerId = state.playerToAct;
      const promotedPokemon = newState.players[playerId].active;

      if (promotedPokemon) {
        // Create promotion animation with new API
        // ✅ flow.js削除: animate.cardMoveを使用
        try {
          await animate.cardMove(playerId, promotedPokemon.id, 'bench->active', {
            benchIndex: benchIndex,
            card: promotedPokemon
          });
        } catch (e) {
          console.warn('Promotion animation failed:', e);
        }
      }

      // Clear knockout context and reset phase
      newState = Logic.clearKnockoutContext(newState);

      // Check for winner
      newState = Logic.checkForWinner(newState);

      if (newState.phase !== GAME_PHASES.GAME_OVER) {
        // Check if this was caused by an attack that should end the turn
        if (newState.attackCausedKnockout && newState.knockoutAttacker) {
          const attacker = newState.knockoutAttacker;

          // End the attacker's turn
          if (attacker === 'player') {
            newState = this.endPlayerTurn(newState);
          } else {
            newState = await this.endCpuTurn(newState);
          }
        } else {
          // Return to appropriate turn phase
          if (newState.turnPlayer === 'player') {
            newState.phase = GAME_PHASES.PLAYER_MAIN;
            newState.prompt.message = 'あなたのターンです。行動を選んでください。';
          } else {
            newState.phase = GAME_PHASES.CPU_MAIN;
            newState.prompt.message = '相手のターンです...';
          }
        }
      }

      newState = addLogEntry(newState, {
        type: 'pokemon_promoted',
        player: playerId,
        message: `${playerId === 'player' ? 'あなた' : '相手'}は${promotedPokemon.name_ja}をバトル場に出しました。`
      });
    }

    return newState;
  }

  /**
   * Handle CPU auto-selection after knockout
   */
  async handleCpuAutoNewActive(state) {
    if (!state.needsCpuAutoSelect) {
      return state;
    }

    await this.simulateCpuThinking(800);

    let newState = Logic.cpuAutoSelectNewActive(state);

    // Add CPU selection animation with new API
    const cpuActive = newState.players.cpu.active;
    if (cpuActive) {
      // ✅ flow.js削除: animate.cardMoveを使用
      try {
        // benchIndex を再特定
        const idx = newState.players.cpu.bench.findIndex(p => p && (p.runtimeId === cpuActive.runtimeId || p.id === cpuActive.id));
        await animate.cardMove('cpu', cpuActive.id, 'bench->active', {
          benchIndex: Math.max(0, idx),
          card: cpuActive
        });
      } catch (e) {
        console.warn('CPU auto promote animation failed:', e);
      }
    }

    // Set appropriate phase after CPU selection
    if (newState.phase !== GAME_PHASES.GAME_OVER) {
      // Check if this was caused by an attack that should end the turn
      if (newState.attackCausedKnockout && newState.knockoutAttacker) {
        const attacker = newState.knockoutAttacker;

        // End the attacker's turn
        if (attacker === 'player') {
          newState = this.endPlayerTurn(newState);
        } else {
          newState = await this.endCpuTurn(newState);
        }
      } else {
        if (newState.turnPlayer === 'cpu') {
          newState.phase = GAME_PHASES.CPU_MAIN;
          newState.prompt.message = '相手のターンです...';
        } else {
          newState.phase = GAME_PHASES.PLAYER_MAIN;
          newState.prompt.message = 'あなたのターンです。行動を選んでください。';
        }
      }
    }

    return newState;
  }

  /**
   * エネルギータイプを抽出
   */
  extractEnergyType(energyTypeOrId) {
    if (!energyTypeOrId) return 'colorless';

    const energyTypes = ['fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal'];
    const lowerInput = energyTypeOrId.toLowerCase();

    return energyTypes.find(type => lowerInput.includes(type)) || 'colorless';
  }

  /**
   * ターンマネージャーリセット
   */
  reset() {
    this.turnActions = [];
    noop('🔄 Turn manager reset');
  }
}

// デフォルトのターンマネージャーインスタンス
export const turnManager = new TurnManager();
