/**
 * SETUP-MANAGER.JS - セットアップフェーズ専用処理（リファクタリング版）
 *
 * 目的:
 * - グローバル依存の排除（window.gameInstance削除）
 * - 責任の明確な分離（専門クラスへの委譲）
 * - 依存性注入パターンの導入
 *
 * 変更点:
 * - GameContextを使用してゲームインスタンスにアクセス
 * - InitialSetupOrchestratorに大部分の処理を委譲
 * - PokemonPlacementHandlerでポケモン配置を管理
 * - SetupStateValidatorで状態検証を実施
 * - エラーハンドリングの強化
 */

import { animateFlow } from './animations/flow.js';
import { animate } from './animation-manager.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';
import { gameLogger } from './game-logger.js';
import { noop } from './utils.js';
import { ANIMATION_TIMING, SHAKE_CONFIG, MULLIGAN_CONFIG } from './constants/timing.js';

// 新しいアーキテクチャのインポート
import { gameContext } from './core/game-context.js';
import { InitialSetupOrchestrator, SetupPhase } from './setup/setup-orchestrator.js';
import { PokemonPlacementHandler } from './setup/pokemon-placement-handler.js';
import { setupStateValidator } from './setup/setup-state-validator.js';
import { SetupError, SetupErrorType, SetupErrorHandler } from './errors/setup-error.js';

/**
 * セットアップ管理クラス（リファクタリング版）
 *
 * 主な責任:
 * - 外部APIの提供（後方互換性のため）
 * - 各専門クラスへの処理委譲
 * - エラーハンドリング
 */
export class SetupManager {
  constructor(gameContextInstance = null) {
    // 依存性注入: GameContextを受け取る
    this.gameContext = gameContextInstance || gameContext;

    // 専門クラスのインスタンス化
    this.placementHandler = new PokemonPlacementHandler(this.gameContext);
    this.orchestrator = new InitialSetupOrchestrator(this.gameContext, this.placementHandler);
    this.validator = setupStateValidator;
    this.errorHandler = new SetupErrorHandler(this.gameContext);

    // 後方互換性のためのフィールド
    this.mulliganCount = 0;
    this.debugEnabled = false;
    this.setupPhases = ['shuffle', 'initial-deal', 'prize-deal', 'mulligan', 'initial-selection'];
    this.currentSetupPhase = null;
  }

  /**
   * GameContextを設定（初期化時に呼ばれる）
   * @param {GameContext} context - ゲームコンテキスト
   */
  setGameContext(context) {
    this.gameContext = context;
    this.placementHandler = new PokemonPlacementHandler(context);
    this.orchestrator = new InitialSetupOrchestrator(context, this.placementHandler);
    this.errorHandler = new SetupErrorHandler(context);
  }
  
  /**
   * ゲーム初期化とセットアップ開始
   * オーケストレーターに処理を委譲
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async initializeGame(state) {
    try {
      // InitialSetupOrchestratorに委譲
      const newState = await this.orchestrator.executeFullSetup(state);

      // 後方互換性のためmulliganCountを同期
      this.mulliganCount = this.orchestrator.mulliganCount;

      return newState;
    } catch (error) {
      // エラーハンドリング
      if (error instanceof SetupError) {
        await this.errorHandler.handleError(error);
      } else {
        console.error('Unexpected error in initializeGame:', error);
      }
      return state;
    }
  }

  /**
   * 統一セットアップフロー（後方互換性のため残す）
   * @deprecated オーケストレーターを直接使用してください
   */
  async _executeSetupPhase(phaseType, state, options = {}) {
    this.currentSetupPhase = phaseType;

    try {
      const result = await this.orchestrator._executePhase(phaseType, state);
      return result;
    } catch (error) {
      console.error(`Setup phase ${phaseType} error:`, error);
      if (error instanceof SetupError) {
        await this.errorHandler.handleError(error);
      }
      return state;
    } finally {
      this.currentSetupPhase = null;
    }
  }

  /**
   * デッキシャッフルアニメーション
   */
  async animateDeckShuffle() {
    const playerDeck = document.querySelector('.player-self .deck-container');
    const cpuDeck = document.querySelector('.opponent-board .deck-container');
    
    if (playerDeck && cpuDeck) {
      // シャッフルアニメーションを同時実行
      await Promise.all([
        this.shuffleDeckAnimation(playerDeck),
        this.shuffleDeckAnimation(cpuDeck)
      ]);
    }
  }

  /**
   * 単一デッキのシャッフルアニメーション
   */
  async shuffleDeckAnimation(deckElement) {
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
   * 初期手札ドロー（7枚ずつ）
   */
  async drawInitialHands(state) {
    let newState = cloneGameState(state);

    // プレイヤーとCPUの初期手札をドロー
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
    
    // Initial hands drawn successfully

    newState = addLogEntry(newState, {
      type: 'initial_draw',
      message: '両プレイヤーが初期手札を引きました。'
    });
    
    // 手札配布完了後、Promise-based非同期実行でCPUの初期ポケモン配置
    if (this.debugEnabled) console.log('🤖 drawInitialHands: Starting CPU initial setup scheduling...');
    this._scheduleCPUInitialSetup().catch(error => {
      console.error('❌ Error in CPU initial setup:', error);
    });
    
    // Note: アニメーションはGame.jsでview.render()の後に呼ばれる
    // ここでは状態の更新のみを行い、アニメーションは別途実行する

    return newState;
  }

  /**
   * サイドカード配布
   * 各プレイヤーのデッキから6枚をサイドカードとして配布
   */
  async dealPrizeCards(state) {
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

    // アニメーションはGame.jsで実行される
    return newState;
  }

  /**
   * 初期ドローアニメーション（カードフリップ演出付き）
   * ✅ DOM要素の準備を待ってから実行
   */
  async animateInitialDraw() {
    // DOM要素の準備を待つ（最大10回、50msずつリトライ）
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const playerHand = document.getElementById('player-hand');
      const cpuHand = document.getElementById('cpu-hand');

      // 両方の要素が存在し、カードが含まれている場合に実行
      if (playerHand && cpuHand) {
        const playerCards = Array.from(playerHand.querySelectorAll('.relative'));
        const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));

        if (playerCards.length > 0 && cpuCards.length > 0) {
          // ✅ フリップアニメーション有効化（Hearthstone/MTG Arena風）
          await animate.handDeal(playerCards, 'player', { withFlip: true });

          // ✅ CPU側もフリップアニメーション
          await animate.handDeal(cpuCards, 'cpu', { withFlip: true });

          console.log('✅ Initial hand draw animation completed');
          return; // 成功したら終了
        }
      }

      // 50ms待機して再試行
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }

    // タイムアウト時の警告
    console.warn('⚠️ animateInitialDraw: DOM elements not ready after maximum attempts');
  }

  /**
   * マリガンチェックと処理
   */
  async handleMulligans(state) {
    let newState = cloneGameState(state);

    const playerNeedsMultigan = !this.hasBasicPokemon(newState.players.player);
    const cpuNeedsMultigan = !this.hasBasicPokemon(newState.players.cpu);

    if (playerNeedsMultigan || cpuNeedsMultigan) {
      this.mulliganCount++;
      
      if (this.mulliganCount <= MULLIGAN_CONFIG.MAX_COUNT) {
        let mulliganMessage = '';
        if (playerNeedsMultigan && cpuNeedsMultigan) {
          mulliganMessage = `双方ともたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
        } else if (playerNeedsMultigan) {
          mulliganMessage = `あなたの手札にたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
        } else {
          mulliganMessage = `相手の手札にたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
        }
        
        newState = addLogEntry(newState, {
          type: 'mulligan',
          message: mulliganMessage
        });

        // UI に一時的にマリガンメッセージを表示
        newState.prompt.message = mulliganMessage + ' 新しい手札を配り直しています...';

        // マリガン処理
        if (playerNeedsMultigan) {
          newState = await this.performMulligan(newState, 'player');
        }
        if (cpuNeedsMultigan) {
          newState = await this.performMulligan(newState, 'cpu');
        }

        // 再帰的にマリガンチェック
        return await this.handleMulligans(newState);
      } else {
        console.warn('⚠️ Maximum mulligans exceeded, proceeding with current hands');
        newState = addLogEntry(newState, {
          type: 'mulligan_limit',
          message: `マリガン上限に達しました。現在の手札でゲームを開始します。`
        });
      }
    }

    return newState;
  }

  /**
   * たねポケモンを持っているかチェック
   */
  hasBasicPokemon(playerState) {
    return playerState.hand.some(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );
  }

  /**
   * マリガン処理
   */
  async performMulligan(state, playerId) {
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];

    // 手札をデッキに戻してシャッフル
    playerState.deck.push(...playerState.hand);
    playerState.hand = [];
    
    // デッキをシャッフル
    this.shuffleArray(playerState.deck);

    // 新しい7枚をドロー
    for (let i = 0; i < 7; i++) {
      if (playerState.deck.length > 0) {
        const card = playerState.deck.shift();
        playerState.hand.push(card);
      }
    }

    // マリガンアニメーション
    await this.animateMulligan(playerId);

    return newState;
  }

  /**
   * マリガンアニメーション
   */
  async animateMulligan(playerId) {
    const handElement = playerId === 'player' 
      ? document.getElementById('player-hand')
      : document.getElementById('cpu-hand');

    if (handElement) {
      // コンテナの不透明度は触らない（バグ原因のため）
      // 新しい手札の入場のみをアニメーション
      const cards = Array.from(handElement.querySelectorAll('.relative'));
      if (cards.length > 0) {
        await animateFlow.handEntry(cards);
      }
    }
  }

  /**
   * サイドカード配置
   */
  async setupPrizeCards(state) {
    let newState = cloneGameState(state);

    // プレイヤーのサイドカード（裏面フラグ付き）
    for (let i = 0; i < 6; i++) {
      if (newState.players.player.deck.length > 0) {
        const prizeCard = newState.players.player.deck.shift();
        newState.players.player.prize.push({ ...prizeCard, isPrizeCard: true });
      }
    }

    // CPUのサイドカード（裏面フラグ付き）
    for (let i = 0; i < 6; i++) {
      if (newState.players.cpu.deck.length > 0) {
        const prizeCard = newState.players.cpu.deck.shift();
        newState.players.cpu.prize.push({ ...prizeCard, isPrizeCard: true });
      }
    }

    // Note: アニメーションはGame.jsでview.render()の後に呼ばれる
    // ここでは状態の更新のみを行う

    return newState;
  }


  /**
   * 初期ポケモン選択の処理（リファクタリング版）
   * PokemonPlacementHandlerに処理を委譲
   */
  async handlePokemonSelection(state, playerId, cardId, targetZone, targetIndex = 0) {
    try {
      // PokemonPlacementHandlerに委譲
      const newState = await this.placementHandler.placePlayerPokemon(
        state,
        playerId,
        cardId,
        targetZone,
        targetIndex
      );

      // プレイヤーがアクティブポケモンを配置した場合、両者準備完了チェック
      if (targetZone === 'active' && newState !== state) {
        setTimeout(() => {
          try {
            const currentState = this.gameContext.getState();
            if (currentState.cpuSetupReady) {
              this._checkBothPlayersReady();
            }
          } catch (error) {
            console.error('Error in post-placement check:', error);
          }
        }, 100);
      }

      return newState;

    } catch (error) {
      // エラーハンドリング
      if (error instanceof SetupError) {
        await this.errorHandler.handleError(error);
      } else {
        console.error('Unexpected error in handlePokemonSelection:', error);
      }
      return state;
    }
  }

  /**
   * 統一CPU ポケモン配置関数（初期・ゲーム中両対応）
   */
  async unifiedCpuPokemonSetup(state, isInitialSetup = false) {
    if (this.debugEnabled) console.log(`🤖 unifiedCpuPokemonSetup: Starting (isInitialSetup: ${isInitialSetup})`);
    try {
      let newState = cloneGameState(state);
      const cpuState = newState.players.cpu;
      
      if (this.debugEnabled) console.log(`🤖 CPU hand size: ${cpuState.hand.length}`);
      
      // 基本ポケモンをフィルタリング
      const basicPokemon = cpuState.hand.filter(card => 
        card.card_type === 'Pokémon' && card.stage === 'BASIC'
      );
      
      if (this.debugEnabled) console.log(`🤖 CPU basic Pokemon found: ${basicPokemon.length}`);
      basicPokemon.forEach(pokemon => {
        if (this.debugEnabled) console.log(`🤖 - ${pokemon.name_ja} (${pokemon.id})`);
      });
      
      if (basicPokemon.length === 0) {
        console.warn('⚠️ CPU has no Basic Pokemon for setup');
        return newState;
      }
      
      // 初期セットアップの場合: アクティブ + ベンチ
      if (isInitialSetup) {
        // CPUがすでにアクティブポケモンを持っている場合はスキップ
        if (newState.players.cpu.active) {
          return newState;
        }
        
        // 1. アクティブポケモン配置
        const activeCandidate = basicPokemon[0];
        
        newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);
        
        if (newState.players.cpu.active) {
          newState.players.cpu.active.setupFaceDown = true;
          
          // 統一アニメーション実行
          await animate.cardMove('cpu', activeCandidate.id, 'hand->active', 
            { isSetupPhase: true, card: activeCandidate }
          );
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // 2. ベンチポケモン配置（残りの基本ポケモン、最大5体）
        const remainingBasic = newState.players.cpu.hand.filter(card => 
          card.card_type === 'Pokémon' && card.stage === 'BASIC'
        );
        
        let benchCount = 0;
        for (const pokemon of remainingBasic) {
          if (benchCount >= 5) break;
          
          newState = Logic.placeCardOnBench(newState, 'cpu', pokemon.id, benchCount);
          
          if (newState.players.cpu.bench[benchCount]) {
            newState.players.cpu.bench[benchCount].setupFaceDown = true;
            
            // 統一アニメーション実行
            await animate.cardMove('cpu', pokemon.id, 'hand->bench', 
              { isSetupPhase: true, benchIndex: benchCount, card: pokemon }
            );
            benchCount++;
            
            if (benchCount < remainingBasic.length && benchCount < 5) {
              await new Promise(resolve => setTimeout(resolve, 600));
            }
          }
        }
        
        newState = addLogEntry(newState, {
          type: 'cpu_setup',
          message: `CPUが初期ポケモンを配置しました（バトル場: ${newState.players.cpu.active.name_ja}, ベンチ: ${benchCount}体）`
        });
        
      } else {
        // ゲーム中: ベンチのみ（1体ずつ）
        const emptyBenchIndex = cpuState.bench.findIndex(slot => slot === null);
        if (emptyBenchIndex !== -1) {
          const selectedPokemon = basicPokemon[0];
          
          newState = Logic.placeCardOnBench(newState, 'cpu', selectedPokemon.id, emptyBenchIndex);
          
          // 統一アニメーション実行
          await animate.cardMove('cpu', selectedPokemon.id, 'hand->bench', 
            { isSetupPhase: false, benchIndex: emptyBenchIndex, card: selectedPokemon }
          );
          
          newState = addLogEntry(newState, {
            type: 'pokemon_played',
            player: 'cpu',
            message: 'CPUがたねポケモンをベンチに出しました'
          });
        }
      }
      return newState;
      
    } catch (error) {
      console.error('❌ Error in unified CPU setup:', error);
      return state;
    }
  }






  /**
   * 非ブロッキングCPUセットアップ（リファクタリング版）
   * setInterval + asyncの危険な組み合わせを排除
   * SequentialAnimatorを使用した安全な実装
   */
  async startNonBlockingCpuSetup() {
    try {
      if (!this.gameContext.hasGameInstance()) {
        console.warn('⚠️ startNonBlockingCpuSetup: Game instance not available');
        return;
      }

      const currentState = this.gameContext.getState();

      // CPUがすでにアクティブポケモンを持っている場合はスキップ
      if (currentState.players.cpu.active) {
        return;
      }

      // PokemonPlacementHandlerに委譲
      await this.placementHandler.placeNonBlockingCpuSetup(currentState);

    } catch (error) {
      console.error('Error in startNonBlockingCpuSetup:', error);
      if (error instanceof SetupError) {
        await this.errorHandler.handleError(error);
      }
    }
  }

  /**
   * セットアップ完了チェック
   */
  isSetupComplete(state) {
    const playerReady = state.players.player.active !== null;
    const cpuReady = state.players.cpu.active !== null;
    
    return playerReady && cpuReady;
  }

  /**
   * セットアップ確定処理
   */
  async confirmSetup(state) {
    noop('🔥 SETUP-MANAGER: confirmSetup called');
    let newState = cloneGameState(state);

    // プレイヤーのセットアップ完了チェック
    const playerHasActiveBasic = newState.players.player.active && 
                                 newState.players.player.active.card_type === 'Pokémon' && 
                                 newState.players.player.active.stage === 'BASIC';
    
    if (!playerHasActiveBasic) {
      console.warn('⚠️ Player setup not complete - no Basic Pokemon in active position');
      newState = addLogEntry(newState, {
        type: 'setup_error',
        message: 'バトル場にたねポケモンを配置してください。'
      });
      return newState;
    }

    // プレイヤー確定フラグを設定
    newState.setupSelection.confirmed = true;
    
    // プレイヤー側のサイドカード配布（もし未配布の場合）
    const playerPrizeCount = Array.isArray(newState.players?.player?.prize) ? 
      newState.players.player.prize.length : 0;
    
    if (playerPrizeCount !== 6) {
      // console.log('🎯 Dealing player prize cards');
      newState = await this.dealPrizeCards(newState);
    } else {
      // console.log('🎯 Player prizes already dealt, skipping');
    }

    // 両者準備が完了している場合のみゲーム開始準備フェーズに移行
    const bothHaveActive = !!(newState.players?.player?.active && newState.players?.cpu?.active);
    const cpuReady = newState.cpuSetupReady === true;
    
    if (bothHaveActive && cpuReady) {
      // 両者準備完了：ゲーム開始準備フェーズに移行
      newState.phase = GAME_PHASES.GAME_START_READY;
      newState.prompt.message = '両者の準備が完了しました！サイドカードを配布しています...';
      
      newState = addLogEntry(newState, {
        type: 'both_setup_confirmed',
        message: '両者のセットアップが完了しました。ゲーム開始準備中...'
      });
    } else {
      // プレイヤーのみ確定：サイドカード配布フェーズに移行
      newState.phase = GAME_PHASES.PRIZE_CARD_SETUP;
      newState.prompt.message = 'プレイヤー確定完了。サイドカードを配布しています...';
      
      newState = addLogEntry(newState, {
        type: 'player_setup_confirmed',
        message: 'プレイヤーのセットアップが確定しました。CPUの準備完了を待っています...'
      });
    }

    // 両者準備完了チェック
    this._checkBothPlayersReady();
    
    return newState;
  }

  /**
   * 配列シャッフルユーティリティ
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * ゲーム開始時の表向き公開処理
   */
  async startGameRevealCards(state) {
    noop('🔥 SETUP-MANAGER: startGameRevealCards called');
    let newState = cloneGameState(state);
    
    // 全てのセットアップ用裏向きフラグを削除
    if (newState.players.player.active) {
      delete newState.players.player.active.setupFaceDown;
    }
    if (newState.players.cpu.active) {
      delete newState.players.cpu.active.setupFaceDown;
    }
    
    // ベンチのフラグも削除
    for (let i = 0; i < 5; i++) {
      if (newState.players.player.bench[i]) {
        delete newState.players.player.bench[i].setupFaceDown;
      }
      if (newState.players.cpu.bench[i]) {
        delete newState.players.cpu.bench[i].setupFaceDown;
      }
    }
    
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
   * 手札配布開始の処理（リファクタリング版）
   */
  async handleStartDealCards() {
    try {
      if (this.gameContext.hasGameInstance()) {
        const gameInstance = this.gameContext.getGameInstance();
        if (typeof gameInstance.triggerInitialSetup === 'function') {
          await gameInstance.triggerInitialSetup();
        }
      } else {
        console.error('❌ gameInstance not found in GameContext');
      }
    } catch (error) {
      console.error('Error in handleStartDealCards:', error);
    }
  }

  /**
   * セットアップ状態リセット
   */
  reset() {
    this.mulliganCount = 0;
    this.currentSetupPhase = null;
  }

  /**
   * CPU初期セットアップのPromise-based スケジューリング（リファクタリング版）
   * @returns {Promise} セットアップ完了Promise
   */
  async _scheduleCPUInitialSetup() {
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (this.gameContext.hasGameInstance()) {
      await this.startNonBlockingCpuSetup();
      await this._scheduleCPUFullAutoSetup();
    } else {
      throw new SetupError(
        SetupErrorType.GAME_INSTANCE_NOT_FOUND,
        'gameInstance not available for CPU initial setup'
      );
    }
  }

  /**
   * CPU完全自動セットアップ（リファクタリング版）
   * キューシステム経由で状態更新を安全に実行
   * @returns {Promise} 完全セットアップ完了Promise
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

      // ステップ1: CPUのポケモン配置
      await this.gameContext.enqueueStateUpdate(async (currentState) => {
        if (!currentState.players.cpu.active) {
          const cpuOnlyState = await this.unifiedCpuPokemonSetup(currentState, true);
          const mergedState = cloneGameState(currentState);
          mergedState.players.cpu = cpuOnlyState.players.cpu;
          mergedState.log = cpuOnlyState.log;
          return mergedState;
        }
        return currentState;
      }, 'CPU Pokemon placement');

      // ステップ2: CPUのサイドカード配布
      await this._scheduleCPUPrizeAnimation();

      // ステップ3: CPU準備完了フラグの設定
      await this.gameContext.enqueueStateUpdate(async (currentState) => {
        const cpuPrizeCount = currentState.players.cpu.prize?.length || 0;
        let newState = currentState;

        if (cpuPrizeCount !== 6) {
          newState = await this.dealPrizeCards(newState);
        }

        newState = {
          ...newState,
          cpuSetupReady: true
        };

        newState = addLogEntry(newState, {
          type: 'setup_complete',
          message: 'CPUの準備が完了しました。プレイヤーの確定を待っています。'
        });

        return newState;
      }, 'CPU ready flag setup');

      // 両者準備完了かチェック
      this._checkBothPlayersReady();

    } catch (error) {
      console.error('❌ Error in CPU full auto setup:', error);
      if (error instanceof SetupError) {
        await this.errorHandler.handleError(error);
      }
    }
  }

  /**
   * 両者準備完了チェック（リファクタリング版）
   * window.gameInstanceへの直接アクセスを排除
   * GameContextを使用してゲームインスタンスにアクセス
   */
  _checkBothPlayersReady() {
    try {
      if (!this.gameContext.hasGameInstance()) {
        if (this.debugEnabled) console.log('⚠️ _checkBothPlayersReady: gameInstance not available');
        return;
      }

      const gameInstance = this.gameContext.getGameInstance();
      const s = this.gameContext.getState();
      const bothHaveActive = !!(s?.players?.player?.active && s?.players?.cpu?.active);
      const cpuReady = s?.cpuSetupReady === true;
      const playerConfirmed = s?.setupSelection?.confirmed === true;

      if (this.debugEnabled) {
        console.log(`🔍 _checkBothPlayersReady: bothHaveActive=${bothHaveActive}, cpuReady=${cpuReady}, playerConfirmed=${playerConfirmed}`);
        console.log('🔍 Player active:', s?.players?.player?.active?.name_ja || 'none');
        console.log('🔍 CPU active:', s?.players?.cpu?.active?.name_ja || 'none');
      }

      // プレイヤーがまだポケモンを配置していない場合
      if (!bothHaveActive && cpuReady && !playerConfirmed) {
        let updatedState = cloneGameState(s);
        updatedState.phase = GAME_PHASES.INITIAL_POKEMON_SELECTION;
        updatedState.prompt.message = 'CPUの準備完了。あなたもバトル場にたねポケモンを配置してください。';
        this.gameContext.updateState(updatedState);
        return;
      }

      // ゲーム側のアニメーション完了チェック機能を利用
      if (typeof gameInstance._checkBothPrizeAnimationsComplete === 'function') {
        gameInstance._checkBothPrizeAnimationsComplete();
        return;
      }

      // 両者準備完了（CPU自動完了 + プレイヤー確定済み）の場合
      if (bothHaveActive && cpuReady && playerConfirmed) {
        let updatedState = cloneGameState(s);
        if (updatedState.phase !== GAME_PHASES.GAME_START_READY) {
          updatedState.phase = GAME_PHASES.GAME_START_READY;
          updatedState.prompt.message = '準備完了！「ゲームスタート」を押してバトルを開始してください。';
          updatedState = addLogEntry(updatedState, {
            type: 'both_ready',
            message: '両者の準備が整いました！ゲームスタートボタンが表示されます。'
          });
          this.gameContext.updateState(updatedState);
        }

        // ゲームスタートボタンの提示
        if (gameInstance.actionHUDManager) {
          gameInstance.actionHUDManager.showPhaseButtons('gameStart', {
            startActualGame: () => gameInstance._startActualGame()
          });
        }
      } else if (cpuReady && !playerConfirmed && !bothHaveActive) {
        // CPUのみ準備完了で、プレイヤーがまだポケモン未配置の場合
        let updatedState = cloneGameState(s);
        updatedState.prompt.message = 'CPUの準備完了。あなたもバトル場にたねポケモンを配置してください。';
        this.gameContext.updateState(updatedState);
      } else if (cpuReady && !playerConfirmed && bothHaveActive) {
        // 両者ポケモン配置済みだがプレイヤーが確定していない場合
        let updatedState = cloneGameState(s);
        updatedState.prompt.message = 'CPUの準備完了。あなたのポケモン配置確定を押してください。';
        this.gameContext.updateState(updatedState);
      }
    } catch (e) {
      console.error('⚠️ _checkBothPlayersReady failed:', e);
    }
  }

  /**
   * CPU側サイドアニメーションのPromise-based スケジューリング（リファクタリング版）
   * @returns {Promise} アニメーション完了Promise
   */
  async _scheduleCPUPrizeAnimation() {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (this.gameContext.hasGameInstance()) {
      const gameInstance = this.gameContext.getGameInstance();
      if (typeof gameInstance._animateCPUPrizeCardSetup === 'function') {
        await gameInstance._animateCPUPrizeCardSetup();
      }
    } else {
      throw new SetupError(
        SetupErrorType.GAME_INSTANCE_NOT_FOUND,
        'gameInstance not available for CPU prize animation'
      );
    }
  }

  // ✅ 重複削除: デッキシャッフルアニメーションは112-143行に定義済み
}

// デフォルトのセットアップマネージャーインスタンス
export const setupManager = new SetupManager();
