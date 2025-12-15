import { GAME_PHASES } from './phase-manager.js';
import { addLogEntry, updateTurnState } from './state.js';

// ==========================================
// 手札制限システム（10枚上限）
// ==========================================

/**
 * 手札の上限枚数
 */
export const HAND_LIMIT = 10;

/**
 * プレイヤーがカードをドローできるかチェック
 * @param {object} state - ゲーム状態
 * @param {string} player - 'player' または 'cpu'
 * @returns {boolean} ドロー可能かどうか
 */
export function canDrawCard(state, player) {
    const handSize = state.players[player].hand.length;
    return handSize < HAND_LIMIT;
}

/**
 * 手札制限の状況を取得
 * @param {object} state - ゲーム状態 
 * @param {string} player - 'player' または 'cpu'
 * @returns {object} 手札制限状況
 */
export function getHandLimitStatus(state, player) {
    const handSize = state.players[player].hand.length;
    return {
        canDraw: handSize < HAND_LIMIT,
        isNearLimit: handSize >= 8,        // 8-9枚で警告
        isAtLimit: handSize >= HAND_LIMIT, // 10枚で上限
        currentSize: handSize,
        limit: HAND_LIMIT,
        remaining: Math.max(0, HAND_LIMIT - handSize)
    };
}

/**
 * カード獲得可能チェック（ドロー・トレーナーズ効果等）
 * @param {object} state - ゲーム状態
 * @param {string} player - 'player' または 'cpu'
 * @param {number} cardCount - 獲得予定カード数
 * @returns {boolean} 獲得可能かどうか
 */
export function canGainCards(state, player, cardCount = 1) {
    const handSize = state.players[player].hand.length;
    return handSize + cardCount <= HAND_LIMIT;
}

/**
 * Finds a card in a player's hand.
 * @param {object} playerState - The state of the player.
 * @param {string} cardId - The ID of the card to find.
 * @returns {{card: object, index: number} | null}
 */
function findCardInHand(playerState, cardId) {
    // Null安全性チェック
    if (!playerState || !Array.isArray(playerState.hand) || !cardId) {
        return null;
    }

    // runtimeId 優先で一致、互換で master id も許容
    const index = playerState.hand.findIndex(c => c && ((c.runtimeId === cardId) || (c.id === cardId)));
    if (index === -1) {
        return null;
    }
    return { card: playerState.hand[index], index };
}

/**
 * Moves a card from hand to the active position.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} cardId - The ID of the card to move.
 * @returns {object} The new game state.
 */
export function placeCardInActive(state, player, cardId) {
    const playerState = state.players[player];
    const cardInfo = findCardInHand(playerState, cardId);

    if (!cardInfo || playerState.active) {
        return state; // Card not in hand or active spot already filled
    }

    const { card, index } = cardInfo;
    const newHand = [...playerState.hand];
    newHand.splice(index, 1);

    const cardToPlace = { ...card, turnPlayed: state.turn };

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                active: cardToPlace,
            },
        },
    };
}

/**
 * Moves a card from hand to a bench position.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} cardId - The ID of the card to move.
 * @param {number} benchIndex - The index of the bench slot.
 * @returns {object} The new game state.
 */
export function placeCardOnBench(state, player, cardId, benchIndex) {
    // Null安全性チェック
    if (!state || !state.players || !state.players[player]) {
        return state;
    }

    const playerState = state.players[player];
    const cardInfo = findCardInHand(playerState, cardId);

    if (!cardInfo || benchIndex < 0 || benchIndex >= 5 || !Array.isArray(playerState.bench) || playerState.bench[benchIndex]) {
        return state; // Invalid move
    }

    const { card, index } = cardInfo;
    const newHand = [...playerState.hand];
    newHand.splice(index, 1);

    const newBench = [...playerState.bench];
    newBench[benchIndex] = { ...card, turnPlayed: state.turn };

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                bench: newBench,
            },
        },
    };
}

/**
 * Draws a card from the deck to the hand.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @returns {object} The new game state.
 */
export function drawCard(state, player) {
    const playerState = state.players[player];

    // デッキ枚数チェック
    if (playerState.deck.length === 0) {
        let newState = {
            ...state,
            phase: GAME_PHASES.GAME_OVER,
            winner: player === 'player' ? 'cpu' : 'player',
            gameEndReason: 'deck_out',
        };
        newState = addLogEntry(newState, { message: `${player === 'player' ? 'あなた' : '相手'}の山札がなくなった！` });
        return newState;
    }

    // 手札上限チェック（HAND_LIMIT = 10枚）
    if (!canDrawCard(state, player)) {
        let newState = addLogEntry(state, {
            message: `${player === 'player' ? 'あなた' : '相手'}の手札が上限（${HAND_LIMIT}枚）に達しているため、ドローできません。`
        });
        return newState;
    }

    const newDeck = [...playerState.deck];
    const drawnCard = newDeck.shift(); // Take the top card
    const newHand = [...playerState.hand, drawnCard];

    let newState = {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                deck: newDeck,
                hand: newHand,
            },
        },
    };

    // turnStateを更新してドロー済みフラグを立てる
    newState = updateTurnState(newState, { hasDrawn: true });
    newState = addLogEntry(newState, { message: `${player === 'player' ? 'あなた' : '相手'}はカードを1枚引いた。` });
    return newState;
}

/**
 * Finds a pokemon on a player's board (active or bench).
 * @param {object} playerState - The state of the player.
 * @param {string} pokemonId - The ID of the pokemon to find.
 * @returns {{pokemon: object, zone: string, index: number} | null}
 */
function findPokemonById(playerState, pokemonId) {
    // Null安全性チェック
    if (!playerState || !pokemonId) {
        return null;
    }

    // runtimeId 優先
    if (playerState.active && (playerState.active.runtimeId === pokemonId || playerState.active.id === pokemonId)) {
        return { pokemon: playerState.active, zone: 'active', index: 0 };
    }

    // bench配列の存在確認
    if (!Array.isArray(playerState.bench)) {
        return null;
    }

    const benchIndex = playerState.bench.findIndex(p => p && (p.runtimeId === pokemonId || p.id === pokemonId));
    if (benchIndex !== -1) {
        return { pokemon: playerState.bench[benchIndex], zone: 'bench', index: benchIndex };
    }
    return null;
}

/**
 * Attaches an energy card from hand to a pokemon.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} energyId - The ID of the energy card in hand.
 * @param {string} pokemonId - The ID of the target pokemon on the board.
 * @returns {object} The new game state.
 */
export function attachEnergy(state, player, energyId, pokemonId) {
    const playerState = state.players[player];

    // Check if energy can be attached (turnState経由でチェック)
    if (state.turnState?.energyAttached > 0) {
        let newState = addLogEntry(state, { message: `${player === 'player' ? 'あなた' : '相手'}はすでにこのターンにエネルギーを付けている。` });
        return newState;
    }

    const energyInfo = findCardInHand(playerState, energyId);
    if (!energyInfo) {
        // This should ideally not happen if UI prevents it
        return state;
    }

    const targetInfo = findPokemonById(playerState, pokemonId);
    if (!targetInfo) {
        // This should ideally not happen if UI prevents it
        return state;
    }

    // Remove energy from hand
    const newHand = [...playerState.hand];
    newHand.splice(energyInfo.index, 1);

    // Add energy to pokemon (Immutability原則: 新しいオブジェクトを作成)
    const updatedPokemon = {
        ...targetInfo.pokemon,
        attached_energy: [...(targetInfo.pokemon.attached_energy || []), energyInfo.card],
    };

    let newActive = playerState.active;
    let newBench = [...playerState.bench];

    if (targetInfo.zone === 'active') {
        newActive = updatedPokemon;
    } else {
        newBench[targetInfo.index] = updatedPokemon;
    }

    // 状態を更新（turnStateヘルパーを使用）
    let newState = {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                active: newActive,
                bench: newBench,
            },
        },
    };

    // turnStateを更新してエネルギー付与を記録
    newState = updateTurnState(newState, { energyAttached: 1 });
    newState = addLogEntry(newState, { message: `${player === 'player' ? 'あなた' : '相手'}は${targetInfo.pokemon.name_ja}に${energyInfo.card.name_ja}を付けた。` });
    return newState;
}

/**
 * Evolves a pokemon on the board.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} evolutionCardId - The ID of the evolution card in hand.
 * @param {string} targetPokemonId - The ID of the pokemon on the board to evolve.
 * @returns {object} The new game state.
 */
export function evolvePokemon(state, player, evolutionCardId, targetPokemonId) {
  const playerState = state.players[player];
  const evolutionCardInfo = findCardInHand(playerState, evolutionCardId);
  if (!evolutionCardInfo) return state; // Evolution card not in hand

  const targetPokemonInfo = findPokemonById(playerState, targetPokemonId);
  if (!targetPokemonInfo) return state; // Target pokemon not on board

  const { card: evolutionCard, index: handIndex } = evolutionCardInfo;
  const { pokemon: targetPokemon, zone, index: boardIndex } = targetPokemonInfo;

  // --- Evolution validation ---
  // 1. Check if the evolution card's 'evolves_from' matches the target's name
  if (evolutionCard.evolves_from !== targetPokemon.name_en) {
    console.warn(`Evolution failed: ${evolutionCard.name_en} does not evolve from ${targetPokemon.name_en}`);
    return state;
  }

  // 2. Check if the target pokemon was played this turn
  if (targetPokemon.turnPlayed === state.turn) {
    console.warn(`Evolution failed: Cannot evolve a Pokémon that was played this turn.`);
    return state;
  }
  
  // 3. Check first turn rule (no evolutions on the first turn of the game for either player)
  if (state.turn === 1) {
      console.warn(`Evolution failed: Cannot evolve on the first turn of the game.`);
      return state;
  }

  // --- Perform evolution ---
  const newHand = [...playerState.hand];
  newHand.splice(handIndex, 1);

  const evolvedPokemon = {
    ...evolutionCard,
    damage: targetPokemon.damage || 0,
    attached_energy: [...(targetPokemon.attached_energy || [])],
    turnPlayed: targetPokemon.turnPlayed, // Keep original turn played
  };

  let newActive = playerState.active;
  let newBench = [...playerState.bench];

  if (zone === 'active') {
    newActive = evolvedPokemon;
  } else {
    newBench[boardIndex] = evolvedPokemon;
  }

  let newState = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        hand: newHand,
        active: newActive,
        bench: newBench,
      },
    },
  };

  newState = addLogEntry(newState, { message: `${player === 'player' ? 'あなた' : '相手'}は${targetPokemon.name_ja}を${evolutionCard.name_ja}に進化させた！` });
  return newState;
}

/**
 * Swaps the active pokemon with a bench pokemon after paying retreat cost.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} fromActiveId - ID of the current active pokemon.
 * @param {number} toBenchIndex - Bench index to promote to active.
 * @returns {object} Updated game state after retreat.
 */
export function retreat(state, player, fromActiveId, toBenchIndex) {
    const playerState = state.players[player];
    const active = playerState.active;
    const benchPokemon = playerState.bench[toBenchIndex];

    if (!active || active.id !== fromActiveId || !benchPokemon) {
        return { newState: state, discardedEnergy: [] };
    }

    const retreatCost = active.retreat_cost || 0;
    const attached = [...(active.attached_energy || [])];
    if (attached.length < retreatCost) {
        let newState = addLogEntry(state, { message: `${player === 'player' ? 'あなた' : '相手'}は${active.name_ja}をにがすためのエネルギーが足りない。` });
        return { newState: newState, discardedEnergy: [] };
    }

    const energyToDiscard = attached.slice(0, retreatCost);
    const remainingEnergy = attached.slice(retreatCost);

    const newBench = [...playerState.bench];
    newBench[toBenchIndex] = { ...active, attached_energy: remainingEnergy };

    let newState = {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                active: benchPokemon,
                bench: newBench,
                discard: [...playerState.discard, ...energyToDiscard]
            }
        }
    };
    newState = addLogEntry(newState, { message: `${player === 'player' ? 'あなた' : '相手'}は${active.name_ja}をにがし、${benchPokemon.name_ja}をバトル場に出した。` });
    return { newState: newState, discardedEnergy: energyToDiscard };
}

/**
 * Checks if a pokemon has enough energy for a given attack.
 * @param {object} pokemon - The pokemon object.
 * @param {object} attack - The attack object.
 * @returns {boolean}
 */
export function hasEnoughEnergy(pokemon, attack) {
    // Null安全性チェック
    if (!pokemon || !attack || !Array.isArray(attack.cost)) {
        return false;
    }

    const attached = (pokemon.attached_energy || []).map(e => e && e.energy_type).filter(Boolean);
    const cost = [...attack.cost];

    for (let i = attached.length - 1; i >= 0; i--) {
        const energyType = attached[i];
        const costIndex = cost.findIndex(c => c === energyType || c === 'Colorless');
        if (costIndex !== -1) {
            cost.splice(costIndex, 1);
            attached.splice(i, 1); // Each energy can only be used once
        }
    }
    // Check remaining cost against remaining colorless energy
    const colorlessEnergyCount = attached.filter(e => e === 'Colorless').length;
    const colorlessCostCount = cost.filter(c => c === 'Colorless').length;

    return cost.length === 0 || (cost.every(c => c === 'Colorless') && attached.length >= cost.length);
}

/**
 * Performs an attack, calculates damage, and applies it.
 * @param {object} state - The current game state.
 * @param {string} attackingPlayerId - 'player' or 'cpu'.
 * @param {number} attackIndex - The index of the attack to use.
 * @returns {object} The new game state.
 */
export function performAttack(state, attackingPlayerId, attackIndex) {
    const defendingPlayerId = attackingPlayerId === 'player' ? 'cpu' : 'player';
    const attackerState = state.players[attackingPlayerId];
    const defenderState = state.players[defendingPlayerId];

    const attacker = attackerState.active;
    const defender = defenderState.active;

    if (!attacker || !defender) {
        // These should ideally not happen if UI prevents it
        return state;
    }

    const attack = attacker.attacks[attackIndex];
    if (!attack) {
        // These should ideally not happen if UI prevents it
        return state;
    }

    if (!hasEnoughEnergy(attacker, attack)) {
        let newState = addLogEntry(state, { message: `${attacker.name_ja}は${attack.name_ja}に必要なエネルギーが足りない。` });
        return newState;
    }

    // --- Damage Calculation ---
    let baseDamage = attack.damage || 0;
    
    // 弱点計算
    if (defender.weakness && attacker.types) {
        let weakness = null;
        if (typeof defender.weakness === 'object' && defender.weakness.type) {
            // weakness is an object
            if (attacker.types.includes(defender.weakness.type)) {
                weakness = defender.weakness;
            }
        } else if (Array.isArray(defender.weakness)) {
            // weakness is an array (fallback)
            weakness = defender.weakness.find(w => 
                attacker.types.includes(w.type)
            );
        }
        
        if (weakness) {
            if (weakness.value === '×2') {
                baseDamage *= 2;
            } else if (weakness.value.startsWith('+')) {
                baseDamage += parseInt(weakness.value.substring(1)) || 20;
            }
        }
    }
    
    // 抵抗力計算
    if (defender.resistance && attacker.types) {
        let resistance = null;
        if (typeof defender.resistance === 'object' && defender.resistance.type) {
            // resistance is an object
            if (attacker.types.includes(defender.resistance.type)) {
                resistance = defender.resistance;
            }
        } else if (Array.isArray(defender.resistance)) {
            // resistance is an array (fallback)
            resistance = defender.resistance.find(r => 
                attacker.types.includes(r.type)
            );
        }
        
        if (resistance) {
            const resistValue = parseInt(resistance.value) || -20;
            baseDamage = Math.max(0, baseDamage + resistValue);
        }
    }
    
    const finalDamage = Math.max(0, baseDamage);
    const previousDamage = defender.damage || 0;
    const newDamage = previousDamage + finalDamage;

    // ダメージ計算結果のメッセージ
    let damageMessage = `${attacker.name_ja}の${attack.name_ja}！${defender.name_ja}に${finalDamage}ダメージ！`;
    if (finalDamage > (attack.damage || 0)) {
        damageMessage += ' (弱点)';
    } else if (finalDamage < (attack.damage || 0)) {
        damageMessage += ' (抵抗力)';
    }
    
    let newState = addLogEntry(state, { message: damageMessage });

    const updatedDefender = {
        ...defender,
        damage: newDamage,
    };

    newState = {
        ...newState, // Use newState from previous addLogEntry
        players: {
            ...newState.players,
            [defendingPlayerId]: {
                ...defenderState,
                active: updatedDefender,
            },
        },
    };
    return newState;
}

/**
 * Moves a pokemon from the bench to the active spot.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {number} benchIndex - The index of the pokemon on the bench.
 * @returns {object} The new game state.
 */
export function promoteToActive(state, player, benchIndex) {
    const playerState = state.players[player];
    const newActive = playerState.bench[benchIndex];

    if (!newActive || playerState.active) {
        return state; // Can't promote if there's already an active or the source is empty
    }

    const newBench = [...playerState.bench];
    newBench[benchIndex] = null; // Empty the bench slot

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                active: newActive,
                bench: newBench,
            },
        },
    };
}

/**
 * Checks for a knockout on a player's active pokemon.
 * @param {object} state - The current game state.
 * @param {string} defendingPlayerId - The player to check for a KO.
 * @returns {object} The new state, potentially with the KO processed.
 */
export function checkForKnockout(state, defendingPlayerId) {
    const defenderState = state.players[defendingPlayerId];
    const defender = defenderState.active;

    if (!defender || !defender.damage || defender.damage < defender.hp) {
        // No KO, no log needed for simplicity
        return state;
    }

    // It's a KO!
    let newState = addLogEntry(state, { message: `${defender.name_ja}がきぜつした！` });
    const attackingPlayerId = defendingPlayerId === 'player' ? 'cpu' : 'player';
    const attackerState = newState.players[attackingPlayerId];

    // Move KO'd pokemon and its cards to discard
    const newDiscard = [...defenderState.discard, defender, ...(defender.attached_energy || [])];

    // Check if defending player has bench pokemon
    const hasBenchPokemon = defenderState.bench.some(p => p !== null);

    // Prize calculation
    const prizeCount = defender.rule_box === 'ex' || defender.rule_box === 'V' || defender.rule_box === 'VMAX' ? 2 : 1;

    // Remove KO'd pokemon from active spot and add to discard
    newState = {
        ...newState,
        players: {
            ...newState.players,
            [defendingPlayerId]: {
                ...defenderState,
                active: null, // Clear active spot
                discard: newDiscard,
            },
            [attackingPlayerId]: {
                ...attackerState,
                prizeRemaining: attackerState.prizeRemaining - prizeCount,
                prizesToTake: (attackerState.prizesToTake || 0) + prizeCount,
            },
        },
    };

    // Set up prize selection phase first
    newState.phase = GAME_PHASES.PRIZE_SELECTION;
    newState.playerToAct = attackingPlayerId;
    newState.prompt = {
        message: `${attackingPlayerId === 'player' ? 'あなた' : '相手'}はサイドカードを${prizeCount}枚選んでください。`
    };

    // Store knockout context for later processing
    newState.knockoutContext = {
        defendingPlayerId,
        hasBenchPokemon,
        prizeCount
    };

    newState = addLogEntry(newState, { 
        message: `${attackingPlayerId === 'player' ? 'あなた' : '相手'}はサイドを${prizeCount}枚とることができます！` 
    });
    
    return newState;
}

/**
 * Moves a prize card to the player's hand.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {number} prizeIndex - The index of the prize card to take.
 * @returns {object} The new game state.
 */
export function takePrizeCard(state, player, prizeIndex) {
    const playerState = state.players[player];
    if (playerState.prizesToTake === 0 || !playerState.prize[prizeIndex]) {
        return state; // No prize to take or prize already taken
    }

    const newPrizeList = [...playerState.prize];
    const prizeCard = newPrizeList[prizeIndex];
    newPrizeList[prizeIndex] = null; // Remove prize from board

    const newHand = [...playerState.hand, prizeCard];

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                prize: newPrizeList,
                prizesToTake: playerState.prizesToTake - 1,
            },
        },
    };
}

/**
 * Checks for all win conditions.
 * @param {object} state - The current game state.
 * @returns {object} The new state, potentially with a winner.
 */
export function checkForWinner(state) {
    let newState = state; // Start with current state

    // Check prize card condition
    if (state.players.player.prizeRemaining <= 0) {
        newState = addLogEntry(newState, { message: '🏆 あなたの勝利！サイドを全て取りきった！' });
        return { ...newState, phase: GAME_PHASES.GAME_OVER, winner: 'player', gameEndReason: 'prizes' };
    }
    if (state.players.cpu.prizeRemaining <= 0) {
        newState = addLogEntry(newState, { message: '🏆 相手の勝利！サイドを全て取りきった！' });
        return { ...newState, phase: GAME_PHASES.GAME_OVER, winner: 'cpu', gameEndReason: 'prizes' };
    }

    // Check if a player has no pokemon left in play (active or bench)
    const isPlayerOutOfPokemon = !state.players.player.active && state.players.player.bench.every(p => p === null);
    const isCpuOutOfPokemon = !state.players.cpu.active && state.players.cpu.bench.every(p => p === null);

    if (isPlayerOutOfPokemon) {
        newState = addLogEntry(newState, { message: '🏆 相手の勝利！あなたがポケモンを出せなくなった！' });
        return { ...newState, phase: GAME_PHASES.GAME_OVER, winner: 'cpu', gameEndReason: 'no_pokemon' };
    }
    if (isCpuOutOfPokemon) {
        newState = addLogEntry(newState, { message: '🏆 あなたの勝利！相手がポケモンを出せなくなった！' });
        return { ...newState, phase: GAME_PHASES.GAME_OVER, winner: 'player', gameEndReason: 'no_pokemon' };
    }

    // No winner yet, no log needed for simplicity
    return newState;
}

/**
 * Processes new active pokemon selection after knockout and prize selection.
 * @param {object} state - The current game state.
 * @returns {object} The new state after processing new active selection.
 */
export function processNewActiveAfterKnockout(state) {
    if (!state.knockoutContext) {
        return state;
    }

    const { defendingPlayerId, hasBenchPokemon } = state.knockoutContext;
    let newState = { ...state };

    if (!hasBenchPokemon) {
        // No bench pokemon, game might be over
        newState = checkForWinner(newState);
        newState = clearKnockoutContext(newState);
        return newState;
    }

    // Set up new active selection phase
    newState.phase = GAME_PHASES.AWAITING_NEW_ACTIVE;
    newState.playerToAct = defendingPlayerId;
    newState.prompt = {
        message: defendingPlayerId === 'player' 
            ? 'あなたのバトルポケモンがきぜつしました。ベンチから新しいポケモンを選んでください。'
            : 'CPUが新しいバトルポケモンを選んでいます...'
    };

    // Store the knockout context for CPU auto-selection if needed
    if (defendingPlayerId === 'cpu') {
        // Mark that CPU needs to auto-select
        newState.needsCpuAutoSelect = true;
    }

    return newState;
}

/**
 * Clears knockout context and related flags
 * @param {object} state - The current game state.
 * @returns {object} The new state with knockout context cleared.
 */
export function clearKnockoutContext(state) {
    return {
        ...state,
        knockoutContext: null,
        attackCausedKnockout: false,
        knockoutAttacker: null,
        needsCpuAutoSelect: false,
        playerToAct: null
    };
}

/**
 * Auto-selects a new active pokemon for CPU after knockout.
 * @param {object} state - The current game state.
 * @returns {object} The new state with CPU's new active pokemon selected.
 */
export function cpuAutoSelectNewActive(state) {
    const cpuState = state.players.cpu;
    const availableBench = cpuState.bench.filter(p => p !== null);
    
    if (availableBench.length === 0) {
        // No pokemon available, game over
        return checkForWinner(state);
    }

    // Select the first available bench pokemon
    const newActiveIndex = cpuState.bench.findIndex(p => p !== null);
    const newActive = cpuState.bench[newActiveIndex];
    const newBench = [...cpuState.bench];
    newBench[newActiveIndex] = null;

    let newState = {
        ...state,
        players: {
            ...state.players,
            cpu: {
                ...cpuState,
                active: newActive,
                bench: newBench,
            }
        },
        needsCpuAutoSelect: false,
        playerToAct: null
    };

    newState = addLogEntry(newState, { 
        message: `相手は${newActive.name_ja}をバトル場に出しました。` 
    });

    // Check for winner after new active selection
    newState = checkForWinner(newState);
    
    return newState;
}

/**
 * 指定されたポケモンが、特定のエネルギータイプをワザのために使えるか判定する
 * @param {Object} pokemon - ポケモンカードオブジェクト
 * @param {string} energyType - エネルギータイプ (e.g., "Grass", "Fire")
 * @returns {boolean} - エネルギーが有効な場合はtrue
 */
export function canUseEnergy(pokemon, energyType) {
    if (!pokemon || !pokemon.attacks || !energyType) {
        return false;
    }

    // ポケモンの全てのワザをチェック
    for (const attack of pokemon.attacks) {
        if (attack.cost) {
            // ワザのコストに、指定されたエネルギータイプか「Colorless」が含まれているかチェック
            if (attack.cost.includes(energyType) || attack.cost.includes('Colorless')) {
                return true; // 一つでも有効なワザがあればtrue
            }
        }
    }

    return false; // どのワザにも使えなければfalse
}