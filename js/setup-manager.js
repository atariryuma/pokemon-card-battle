/**
 * SETUP-MANAGER.JS - セットアップフェーズ専用処理
 * 
 * 初期ポケモン選択、マリガン、サイドカード配置などを管理
 */

// アニメーションは flow に統一（一部レガシーAPIも使用）
import { animateFlow } from './animations/flow.js';
import { animate, animationManager } from './animation-manager.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';
import { gameLogger } from './game-logger.js';

const noop = () => {};

/**
 * セットアップ管理クラス
 */
export class SetupManager {
  constructor() {
    this.mulliganCount = 0;
    this.debugEnabled = false; // デバッグログ制御フラグ
    this.maxMulligans = 3; // 最大マリガン回数
    
    // セットアップ段階の統一管理
    this.setupPhases = ['shuffle', 'initial-deal', 'prize-deal', 'mulligan', 'initial-selection'];
    this.currentSetupPhase = null;
  }
  
  /**
   * 統一セットアップフロー
   */
  async _executeSetupPhase(phaseType, state, options = {}) {
    this.currentSetupPhase = phaseType;
    
    const phaseHandlers = {
      'shuffle': this._handleShufflePhase.bind(this),
      'initial-deal': this._handleInitialDealPhase.bind(this),
      'prize-deal': this._handlePrizeDealPhase.bind(this),
      'mulligan': this._handleMulliganPhase.bind(this),
      'initial-selection': this._handleInitialSelectionPhase.bind(this)
    };
    
    const handler = phaseHandlers[phaseType];
    if (!handler) {
      console.warn(`Unknown setup phase: ${phaseType}`);
      return state;
    }
    
    try {
      const result = await handler(state, options);
      return result;
    } catch (error) {
      console.error(`Setup phase ${phaseType} error:`, error);
      return state;
    } finally {
      this.currentSetupPhase = null;
    }
  }
  
  async _handleShufflePhase(state) {
    await this.animateDeckShuffle();
    return state;
  }
  
  async _handleInitialDealPhase(state) {
    return await this.drawInitialHands(state);
  }
  
  async _handlePrizeDealPhase(state) {
    return await this.dealPrizeCards(state);
  }
  
  async _handleMulliganPhase(state) {
    return await this.handleMulligans(state);
  }
  
  async _handleInitialSelectionPhase(state) {
    let newState = cloneGameState(state);
    newState.phase = GAME_PHASES.INITIAL_POKEMON_SELECTION;
    newState.prompt.message = 'まず手札のたねポケモンをクリックして選択し、次にバトル場またはベンチをクリックして配置してください。';
    
    gameLogger.logPhaseChange('setup', 'initial_pokemon_selection', 'ゲーム');
    
    newState = addLogEntry(newState, {
      type: 'setup_complete', 
      message: 'ゲームセットアップが完了しました'
    });
    
    return newState;
  }

  /**
   * ゲーム初期化とセットアップ開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async initializeGame(state) {
    let newState = cloneGameState(state);

    // 統一セットアップフローで順次実行
    for (const phase of this.setupPhases) {
      newState = await this._executeSetupPhase(phase, newState);
    }

    return newState;
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
      // シャッフルエフェクト（3回震わせる）
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        deckElement.style.transform = `translateX(${Math.random() * 6 - 3}px) translateY(${Math.random() * 6 - 3}px)`;
        shakeCount++;

        if (shakeCount >= 6) {
          clearInterval(shakeInterval);
          deckElement.style.transform = '';
          resolve();
        }
      }, 100);
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
   * 初期ドローアニメーション
   */
  async animateInitialDraw() {
    const playerHand = document.getElementById('player-hand');
    const cpuHand = document.getElementById('cpu-hand');

    if (playerHand) {
      const playerCards = Array.from(playerHand.querySelectorAll('.relative'));
      if (playerCards.length > 0) {
        await animate.handDeal(playerCards, 'player');
      }
    }

    if (cpuHand) {
      const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
      if (cpuCards.length > 0) {
        await animate.handDeal(cpuCards, 'cpu');
      }
    }
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
      
      if (this.mulliganCount <= this.maxMulligans) {
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
        await animationManager.animateHandEntry(cards);
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
   * 初期ポケモン選択の処理
   */
  async handlePokemonSelection(state, playerId, cardId, targetZone, targetIndex = 0) {
    
    // 状態の有効性チェック
    if (!state.players || !state.players[playerId]) {
      console.error(`❌ Invalid state: player ${playerId} not found`);
      return state;
    }
    
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];
    
    // 手札が空でないことを確認
    if (!playerState.hand || playerState.hand.length === 0) {
      console.warn(`⚠️ Player ${playerId} has no cards in hand`);
      return state;
    }
    
    // 安全な手札コピーを作成
    const handCopy = [...playerState.hand];

    // 手札からカードを見つける（runtimeId 優先、互換で master id）
    const cardIndex = handCopy.findIndex(card => (card.runtimeId === cardId) || (card.id === cardId));
    if (cardIndex === -1) {
      console.warn(`⚠️ Card ${cardId} not found in ${playerId} hand`);
      return state;
    }

    const card = handCopy[cardIndex];

    // たねポケモンかチェック
    if (card.card_type !== 'Pokémon' || card.stage !== 'BASIC') {
      console.warn(`⚠️ Invalid card type: ${card.card_type}, stage: ${card.stage}. Only Basic Pokemon allowed.`);
      return state; // 状態を変更せずに戻す
    }

    // 配置先の有効性をチェック
    let canPlace = false;
    
    if (targetZone === 'active') {
      if (playerState.active === null) {
        canPlace = true;
      } else {
        console.warn(`⚠️ Active slot already occupied by ${playerState.active.name_ja}`);
      }
    } else if (targetZone === 'bench') {
      if (targetIndex >= 0 && targetIndex < 5 && playerState.bench[targetIndex] === null) {
        canPlace = true;
      } else {
        const occupiedBy = playerState.bench[targetIndex]?.name_ja || 'Invalid index';
        console.warn(`⚠️ Bench slot ${targetIndex} is occupied by ${occupiedBy} or invalid`);
      }
    }

    if (!canPlace) {
      return state; // 状態を変更せずに戻す
    }

    // ここで初めて手札からカードを削除
    // 同じカードが複数枚ある場合でも1枚だけを取り除くため、
    // インデックスを基に手札を更新する
    handCopy.splice(cardIndex, 1);
    playerState.hand = handCopy;

    // 配置処理（セットアップ中は裏向き）
    const cardWithSetupFlag = { ...card, setupFaceDown: true };
    
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
    
    // プレイヤーがアクティブポケモンを配置した場合、CPUが準備完了していれば再チェック
    if (targetZone === 'active' && canPlace) {
      // console.log('🔄 Player placed active Pokemon, checking if CPU is ready');
      // 少し遅延してから状態チェック（状態更新が反映されるのを待つ）
      setTimeout(() => {
        if (window.gameInstance && window.gameInstance.state.cpuSetupReady) {
          // console.log('🔄 CPU is ready, triggering both players ready check');
          this._checkBothPlayersReady();
        }
      }, 100);
    }
    
    return newState;
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
   * 非ブロッキングCPUセットアップ（1枚ずつ順次実行）
   */
  async startNonBlockingCpuSetup() {
    noop('🤖 startNonBlockingCpuSetup: Method called');
    
    if (!window.gameInstance || !window.gameInstance.state) {
      console.warn('⚠️ startNonBlockingCpuSetup: Game instance not available');
      return;
    }

    // 現在の状態を取得
    let currentState = window.gameInstance.state;
    
    // CPUがすでにアクティブポケモンを持っている場合はスキップ
    if (currentState.players.cpu.active) {
      return;
    }

    const cpuState = currentState.players.cpu;
    const basicPokemon = cpuState.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    if (basicPokemon.length === 0) {
      console.warn('⚠️ CPU has no Basic Pokemon for setup');
      return;
    }

    // 1枚ずつ順次配置
    let placementIndex = 0;
    const placementInterval = setInterval(async () => {
      // 最新の状態を取得
      currentState = window.gameInstance.state;
      
      if (placementIndex >= basicPokemon.length) {
        clearInterval(placementInterval);
        return;
      }

      const pokemon = basicPokemon[placementIndex];

      try {
        let newState;
        let animationDetails = null; // アニメーション情報を保持する変数
        
        if (placementIndex === 0) {
          // 最初のポケモンはアクティブに配置
          // 初期位置（CPU手札）をキャプチャ
          const cpuHand = document.getElementById('cpu-hand');
          const srcEl = cpuHand ? cpuHand.querySelector(`[data-runtime-id="${pokemon.runtimeId || pokemon.id}"]`) || cpuHand.querySelector(`[data-card-id="${pokemon.id}"]`) : null;
          const initialSourceRect = srcEl ? srcEl.getBoundingClientRect() : null;
          newState = Logic.placeCardInActive(currentState, 'cpu', pokemon.id);
          if (newState.players.cpu.active) {
            newState.players.cpu.active.setupFaceDown = true;
            // アニメーション情報を保存
            animationDetails = {
              playerId: 'cpu',
              cardId: pokemon.id,
              sourceZone: 'hand',
              targetZone: 'active',
              targetIndex: 0,
              options: { isSetupPhase: true, card: pokemon, initialSourceRect }
            };
          }
        } else {
          // 2番目以降はベンチに配置
          const benchIndex = placementIndex - 1;
          if (benchIndex < 5) {
            const cpuHand = document.getElementById('cpu-hand');
            const srcEl = cpuHand ? cpuHand.querySelector(`[data-runtime-id="${pokemon.runtimeId || pokemon.id}"]`) || cpuHand.querySelector(`[data-card-id="${pokemon.id}"]`) : null;
            const initialSourceRect = srcEl ? srcEl.getBoundingClientRect() : null;
            newState = Logic.placeCardOnBench(currentState, 'cpu', pokemon.id, benchIndex);
            if (newState.players.cpu.bench[benchIndex]) {
              newState.players.cpu.bench[benchIndex].setupFaceDown = true;
              // アニメーション情報を保存
              animationDetails = {
                playerId: 'cpu',
                cardId: pokemon.id,
                sourceZone: 'hand',
                targetZone: 'bench',
                targetIndex: benchIndex,
                options: { isSetupPhase: true, card: pokemon, initialSourceRect }
              };
            }
          }
        }

        // 状態を更新
        if (newState && newState !== currentState) {
          window.gameInstance._updateState(newState);
          // DOM更新を待つ
          await new Promise(resolve => requestAnimationFrame(resolve));
        }

        // アニメーションを実行
        if (animationDetails) {
          // シンプルAPI（実座標クローン移動）
          if (animationDetails.targetZone === 'active') {
            await animateFlow.handToActive('cpu', animationDetails.cardId, { isSetupPhase: true, initialSourceRect: animationDetails.options.initialSourceRect });
          } else if (animationDetails.targetZone === 'bench') {
            await animateFlow.handToBench('cpu', animationDetails.cardId, animationDetails.targetIndex, { isSetupPhase: true, initialSourceRect: animationDetails.options.initialSourceRect });
          }
        }

      } catch (error) {
        console.error(`❌ Error placing CPU card ${placementIndex + 1}:`, error);
      }

      placementIndex++;
    }, 1200); // 1.2秒間隔で1枚ずつ配置
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
   * ポケモン配置確定後のサイドカード配布処理
   */
  async confirmPokemonSetupAndProceedToPrizes(state) {
    let newState = cloneGameState(state);
    
    // フェーズをサイドカード配布に変更
    newState.phase = GAME_PHASES.PRIZE_CARD_SETUP;
    
    // サイドカード配布
    newState = await this.setupPrizeCards(newState);
    
    // ゲーム開始準備完了フェーズに移行
    newState.phase = GAME_PHASES.GAME_START_READY;
    
    newState = addLogEntry(newState, {
      type: 'prize_setup_complete',
      message: 'サイドカードが配布されました。ゲーム開始の準備が整いました！'
    });
    
    return newState;
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
   * 手札配布開始の処理
   */
  async handleStartDealCards() {
    // console.log('🃏 handleStartDealCards called');
    // No need to update modal content here, as it's handled by the new message system
    // Just trigger the initial setup
    if (window.gameInstance) {
      // console.log('✅ Calling triggerInitialSetup on gameInstance');
      await window.gameInstance.triggerInitialSetup();
    } else {
      console.error('❌ window.gameInstance not found');
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
   * CPU初期セットアップのPromise-based スケジューリング
   * @returns {Promise} セットアップ完了Promise
   */
  async _scheduleCPUInitialSetup() {
    // console.log('🤖 _scheduleCPUInitialSetup: Starting CPU initial setup scheduling');
    // 1.5秒待機してからCPU設定実行（UX改善のため）
    // console.log('🤖 _scheduleCPUInitialSetup: Waiting 1.5 seconds before CPU setup...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (window.gameInstance) {
      // console.log('🤖 _scheduleCPUInitialSetup: Executing CPU initial setup via Promise chain');
      await this.startNonBlockingCpuSetup();
      // console.log('✅ _scheduleCPUInitialSetup: CPU initial setup completed successfully');
      
      // CPU セットアップ完了後、自動でフルセットアップを実行
      // console.log('🤖 _scheduleCPUInitialSetup: Starting CPU full auto setup...');
      await this._scheduleCPUFullAutoSetup();
    } else {
      console.error('❌ _scheduleCPUInitialSetup: gameInstance not available for CPU initial setup');
      throw new Error('gameInstance not available for CPU initial setup');
    }
  }

  /**
   * CPU完全自動セットアップ（ポケモン配置からサイド配布まで）
   * @returns {Promise} 完全セットアップ完了Promise
   */
  async _scheduleCPUFullAutoSetup() {
    try {
      // console.log('🤖 _scheduleCPUFullAutoSetup: Starting CPU full auto setup');
      
      // 少し間を空けてから実行（UX改善）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!window.gameInstance) {
        throw new Error('gameInstance not available for CPU full auto setup');
      }

      // CPU の状態を確認してポケモンが配置されていない場合は配置
      let currentState = window.gameInstance.state;
      // console.log('🤖 _scheduleCPUFullAutoSetup: Current CPU active:', currentState.players?.cpu?.active?.name_ja || 'none');
      
      if (!currentState.players.cpu.active) {
        // console.log('🤖 _scheduleCPUFullAutoSetup: CPU needs Pokemon setup');
        const cpuOnlyState = await this.unifiedCpuPokemonSetup(currentState, true);

        // 👇 プレイヤーが同時に操作しても配置が消えないよう、直前の状態とマージする
        const latestState = cloneGameState(window.gameInstance.state);
        latestState.players.cpu = cpuOnlyState.players.cpu;
        latestState.log = cpuOnlyState.log;
        currentState = latestState;

        window.gameInstance._updateState(currentState);
      } else {
        // console.log('🤖 _scheduleCPUFullAutoSetup: CPU already has active Pokemon, skipping placement');
      }

      // CPUのサイドカード配布を実行
      // console.log('🤖 _scheduleCPUFullAutoSetup: Starting CPU prize card setup');
      await this._scheduleCPUPrizeAnimation();
      
      // CPUの準備完了フラグのみ設定し、フェーズは変更しない
      // console.log('🤖 _scheduleCPUFullAutoSetup: Setting CPU ready flag');
      currentState = window.gameInstance.state;
      
      // サイドカード配布処理（もしまだ配布されていない場合）
      const cpuPrizeCount = Array.isArray(currentState.players?.cpu?.prize) ? 
        currentState.players.cpu.prize.length : 0;
      // console.log('🤖 _scheduleCPUFullAutoSetup: CPU prize count:', cpuPrizeCount);
      
      if (cpuPrizeCount !== 6) {
        // console.log('🤖 _scheduleCPUFullAutoSetup: Dealing CPU prize cards');
        currentState = await this.dealPrizeCards(currentState);
      } else {
        // console.log('🤖 _scheduleCPUFullAutoSetup: CPU prizes already dealt');
      }
      
      // CPU準備完了フラグを設定（フェーズは変更しない）
      currentState.cpuSetupReady = true;
      currentState = addLogEntry(currentState, {
        type: 'setup_complete',
        message: 'CPUの準備が完了しました。プレイヤーの確定を待っています。'
      });
      
      // console.log('🤖 CPU setup ready, keeping phase as:', currentState.phase);
      
      window.gameInstance._updateState(currentState);
      // console.log('✅ _scheduleCPUFullAutoSetup: CPU full auto setup completed');
      
      // 両者準備完了かチェック
      this._checkBothPlayersReady();
      
    } catch (error) {
      console.error('❌ Error in CPU full auto setup:', error);
    }
  }

  /**
   * 両者準備完了チェック（ゲーム側UI連携）
   * - CPU/プレイヤー双方の準備が揃ったらゲームスタートUIを出す
   * - ゲーム側のアニメーション完了チェックに委譲
   */
  _checkBothPlayersReady() {
    try {
      if (!window.gameInstance) {
        // console.log('⚠️ _checkBothPlayersReady: gameInstance not available');
        return;
      }

      const s = window.gameInstance.state;
      const bothHaveActive = !!(s?.players?.player?.active && s?.players?.cpu?.active);
      const cpuReady = s?.cpuSetupReady === true;
      const playerConfirmed = s?.setupSelection?.confirmed === true;

      if (this.debugEnabled) console.log(`🔍 _checkBothPlayersReady: bothHaveActive=${bothHaveActive}, cpuReady=${cpuReady}, playerConfirmed=${playerConfirmed}`);
      if (this.debugEnabled) console.log('🔍 Player active:', s?.players?.player?.active?.name_ja || 'none');
      if (this.debugEnabled) console.log('🔍 CPU active:', s?.players?.cpu?.active?.name_ja || 'none');

      // プレイヤーがまだポケモンを配置していない場合は、game.jsの処理に委譲しない
      if (!bothHaveActive && cpuReady && !playerConfirmed) {
        // console.log('⏳ CPU ready but player has no active Pokemon yet, showing setup message');
        let updatedState = window.gameInstance.state;
        // フェーズをINITIAL_POKEMON_SELECTIONに戻す
        updatedState.phase = GAME_PHASES.INITIAL_POKEMON_SELECTION;
        updatedState.prompt.message = 'CPUの準備完了。あなたもバトル場にたねポケモンを配置してください。';
        window.gameInstance._updateState(updatedState);
        return;
      }

      // ゲーム側に用意された「サイド配布アニメーション完了」チェック機能を利用
      if (typeof window.gameInstance._checkBothPrizeAnimationsComplete === 'function') {
        // console.log('🔍 Using gameInstance._checkBothPrizeAnimationsComplete');
        window.gameInstance._checkBothPrizeAnimationsComplete();
        return;
      }

      // 両者準備完了（CPU自動完了 + プレイヤー確定済み）の場合
      if (bothHaveActive && cpuReady && playerConfirmed) {
        // console.log('🎉 Both players ready for game start');
        
        // ゲーム開始準備完了状態に設定
        let updatedState = window.gameInstance.state;
        if (updatedState.phase !== GAME_PHASES.GAME_START_READY) {
          updatedState.phase = GAME_PHASES.GAME_START_READY;
          updatedState.prompt.message = '準備完了！「ゲームスタート」を押してバトルを開始してください。';
          updatedState = addLogEntry(updatedState, {
            type: 'both_ready',
            message: '両者の準備が整いました！ゲームスタートボタンが表示されます。'
          });
          window.gameInstance._updateState(updatedState);
        }
        
        // ゲームスタートボタンの提示
        window.gameInstance.actionHUDManager?.showPhaseButtons('gameStart', {
          startActualGame: () => window.gameInstance._startActualGame()
        });
      } else if (cpuReady && !playerConfirmed && !bothHaveActive) {
        // CPUのみ準備完了で、プレイヤーがまだポケモン未配置の場合
        // console.log('⏳ CPU ready, player needs to place Pokemon');
        let updatedState = window.gameInstance.state;
        // フェーズはINITIAL_POKEMON_SELECTIONのままにする
        updatedState.prompt.message = 'CPUの準備完了。あなたもバトル場にたねポケモンを配置してください。';
        window.gameInstance._updateState(updatedState);
      } else if (cpuReady && !playerConfirmed && bothHaveActive) {
        // 両者ポケモン配置済みだがプレイヤーが確定していない場合
        // console.log('⏳ Both have Pokemon, waiting for player confirmation');
        let updatedState = window.gameInstance.state;
        updatedState.prompt.message = 'CPUの準備完了。あなたのポケモン配置確定を押してください。';
        window.gameInstance._updateState(updatedState);
      } else {
        // console.log('⏳ Still waiting for setup completion');
      }
    } catch (e) {
      console.error('⚠️ _checkBothPlayersReady failed:', e);
    }
  }

  /**
   * CPU側サイドアニメーションのPromise-based スケジューリング
   * @returns {Promise} アニメーション完了Promise
   */
  async _scheduleCPUPrizeAnimation() {
    noop('🤖 _scheduleCPUPrizeAnimation: Starting CPU prize animation scheduling');
    
    // 1秒待機してからアニメーション実行（UX改善のため）
    noop('🤖 _scheduleCPUPrizeAnimation: Waiting 1 second before animation...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (window.gameInstance) {
      noop('🤖 _scheduleCPUPrizeAnimation: Executing CPU prize animation via Promise chain');
      await window.gameInstance._animateCPUPrizeCardSetup();
      noop('✅ _scheduleCPUPrizeAnimation: CPU prize animation completed successfully');
    } else {
      console.error('❌ _scheduleCPUPrizeAnimation: gameInstance not available for CPU prize animation');
      throw new Error('gameInstance not available for CPU prize animation');
    }
  }

  /**
   * デッキシャッフルアニメーション
   */
  async animateDeckShuffle() {
    noop('🔀 Animating deck shuffle...');
    
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
      // シャッフルエフェクト（3回震わせる）
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        deckElement.style.transform = `translateX(${Math.random() * 6 - 3}px) translateY(${Math.random() * 6 - 3}px)`;
        shakeCount++;

        if (shakeCount >= 6) {
          clearInterval(shakeInterval);
          deckElement.style.transform = '';
          resolve();
        }
      }, 100);
    });
  }
}

// デフォルトのセットアップマネージャーインスタンス
export const setupManager = new SetupManager();
