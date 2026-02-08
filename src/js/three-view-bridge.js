/**
 * THREE.JS VIEW BRIDGE
 * 
 * 既存の view.js と Three.js を接続するブリッジ
 * - 既存ゲームロジックからの呼び出しを Three.js に変換
 * - 座標データの変換
 * - 状態同期
 */

import { GameBoard3D } from './three/game-board.js';
import { getCardImagePath } from './data-manager.js';

export class ThreeViewBridge {
    constructor() {
        this.gameBoard3D = null;
        this.isEnabled = false;
        this.container = null;

        // 既存の DOM ビューへのフォールバック
        this.fallbackView = null;

        // 状態キャッシュ
        this.lastState = null;
    }

    /**
     * 後方互換性用: gameBoardプロパティでgameBoard3Dにアクセス可能にする
     */
    get gameBoard() {
        return this.gameBoard3D;
    }

    /**
     * 初期化
     */
    async init(playmatSlotsData) {
        this.container = document.getElementById('three-container');

        if (!this.container) {
            console.warn('⚠️ Three.js container (#three-container) not found');
            return false;
        }

        try {
            this.gameBoard3D = new GameBoard3D(this.container, {
                playmatTexture: 'assets/playmat/playmat.jpg',
                cardBackTexture: 'assets/ui/card_back.webp',
            });

            await this.gameBoard3D.init(playmatSlotsData);
            this.isEnabled = true;
            return true;
        } catch (error) {
            console.error('❌ ThreeViewBridge init failed:', error);
            console.error('  - Error stack:', error.stack);
            return false;
        }
    }

    /**
     * クリックハンドラ設定
     */
    bindCardClick(handler) {
        if (!this.gameBoard3D) return;

        this.gameBoard3D.setSlotClickHandler((data) => {
            handler({
                owner: data.owner,
                zone: data.zone,
                index: String(data.index),
                cardId: null,
                runtimeId: null,
            });
        });

        this.gameBoard3D.setCardClickHandler((data) => {
            handler({
                owner: data.owner,
                zone: data.zone,
                index: String(data.index),
                cardId: data.cardId,
                runtimeId: data.runtimeId,
            });
        });
    }

    /**
     * ドラッグ&ドロップハンドラ設定
     */
    bindDragDrop(handler) {
        if (!this.gameBoard3D) return;

        this.gameBoard3D.setCardDropHandler((data) => {
            handler({
                dragData: {
                    cardId: data.cardId,
                    runtimeId: data.runtimeId,
                    cardType: data.cardType,
                },
                dropTarget: {
                    zone: data.toZone,
                    owner: data.toOwner,
                    index: data.toIndex,
                }
            });
        });
    }

    /**
     * ゲーム状態をレンダリング
     */
    async render(state) {
        if (!this.isEnabled || !this.gameBoard3D) return;
        // interaction managerにgame stateを渡す
        if (this.gameBoard3D.interactionManager) {
            this.gameBoard3D.interactionManager.setGameState(state);
        }


        // 差分検出
        if (this._stateEquals(this.lastState, state)) return;

        // ✅ ステートに存在しなくなったカードをクリーンアップ（重複レンダリング防止）
        this._cleanupStaleCards(state);

        // アクティブポケモン
        await this._renderActive('player', state.players.player.active);
        await this._renderActive('cpu', state.players.cpu.active);

        // ベンチ
        await this._renderBench('player', state.players.player.bench);
        await this._renderBench('cpu', state.players.cpu.bench);

        // 山札
        await this._renderDeck('player', state.players.player.deck);
        await this._renderDeck('cpu', state.players.cpu.deck);

        // サイドカード（配置確定後のみレンダリング）
        // セットアップフェーズ中はまだサイドカードを表示しない
        const setupPhases = ['setup', 'initialPokemonSelection'];
        if (!setupPhases.includes(state.phase)) {
            await this._renderPrize('player', state.players.player.prize);
            await this._renderPrize('cpu', state.players.cpu.prize);
        }

        // トラッシュ
        await this._renderDiscard('player', state.players.player.discard);
        await this._renderDiscard('cpu', state.players.cpu.discard);

        // ✅ 手札は DOM/CSS版に任せる（一般的なTCG方式）
        // ✅ ハイブリッドモード: Three.js版の手札カードを完全に削除（DOM版が担当）
        this._clearHand('player');
        this._clearHand('cpu');

        this.lastState = this._cloneState(state);
    }

    /**
     * ステートに存在しなくなったカードを削除（重複レンダリング防止）
     */
    _cleanupStaleCards(state) {
        // 現在ステートに存在するカードのruntimeIdを収集
        const validRuntimeIds = new Set();

        // active
        if (state.players.player.active?.runtimeId) {
            validRuntimeIds.add(state.players.player.active.runtimeId);
        }
        if (state.players.cpu.active?.runtimeId) {
            validRuntimeIds.add(state.players.cpu.active.runtimeId);
        }

        // bench
        state.players.player.bench.forEach(card => {
            if (card?.runtimeId) validRuntimeIds.add(card.runtimeId);
        });
        state.players.cpu.bench.forEach(card => {
            if (card?.runtimeId) validRuntimeIds.add(card.runtimeId);
        });

        // prize（配置確定後のみ有効）
        const setupPhases = ['setup', 'initialPokemonSelection'];
        if (!setupPhases.includes(state.phase)) {
            state.players.player.prize?.forEach(card => {
                if (card?.runtimeId) validRuntimeIds.add(card.runtimeId);
            });
            state.players.cpu.prize?.forEach(card => {
                if (card?.runtimeId) validRuntimeIds.add(card.runtimeId);
            });
        }

        // 特殊なキー（deck, discardは単一表示）
        validRuntimeIds.add('deck-player');
        validRuntimeIds.add('deck-cpu');
        validRuntimeIds.add('discard-player');
        validRuntimeIds.add('discard-cpu');

        // Map内のカードで、ステートに存在しないものを削除
        const keysToRemove = [];
        this.gameBoard3D.cards.forEach((card, key) => {
            if (!validRuntimeIds.has(key)) {
                keysToRemove.push(key);
            }
        });

        keysToRemove.forEach(key => {
            this.gameBoard3D.removeCard(key);
        });
    }

    /**
     * 山札をレンダリング（裏向きの山）
     */
    async _renderDeck(owner, deck) {
        if (!deck || deck.length === 0) return;

        const slotKey = `deck-${owner}-0`;
        const deckCardKey = `deck-${owner}`;

        // 既存の山札表示を確認
        if (this.gameBoard3D.cards.has(deckCardKey)) return;

        // デバッグ: スロットの存在確認
        const slot = this.gameBoard3D.slots.get(slotKey);
        if (!slot) {
            console.warn(`⚠️ _renderDeck: Slot "${slotKey}" not found. Available slots:`, Array.from(this.gameBoard3D.slots.keys()));
        }

        // 山札は1枚の裏向きカードとして表示
        const card = await this.gameBoard3D.addCard(deckCardKey, {
            cardId: 'deck',
            frontTexture: null,  // 裏面のみ
            backTexture: 'assets/ui/card_back.webp',
            zone: 'deck',
            owner,
            index: 0,
        });

        if (slot && card) {
            const pos = slot.getMesh().position;
            card.setPosition(pos.x, 5, pos.z);
            card.layFlat();
            card.showBack();  // 裏向き

            if (owner === 'cpu') {
                card.flipForOpponent();
            }

            card.saveBasePosition();
        }
    }

    /**
     * サイドカードをレンダリング（裏向き）
     * プレイマットには3スロットしかないので、6枚のサイドカードを2枚ずつ重ねる
     * 2枚目のカードは少しずらして配置（プレイマット風）
     */
    async _renderPrize(owner, prizes) {
        if (!prizes || prizes.length === 0) return;

        // 最大3スロット、各スロットに2枚まで重ねる
        const maxSlots = 3;
        for (let i = 0; i < Math.min(prizes.length, 6); i++) {
            const prizeCard = prizes[i];
            if (!prizeCard) continue;

            // スロットインデックス（0-2）とスタックオフセット（0-1）を計算
            const slotIndex = i % maxSlots;
            const stackLevel = Math.floor(i / maxSlots);

            const slotKey = `prize-${owner}-${slotIndex}`;
            // ✅ ゲームエンジンの実際のruntimeIdを使用（クリック可能にするため）
            const prizeCardKey = prizeCard.runtimeId || `prize-${owner}-${i}`;

            if (this.gameBoard3D.cards.has(prizeCardKey)) continue;

            const slot = this.gameBoard3D.slots.get(slotKey);
            if (!slot) {
                console.warn(`⚠️ _renderPrize: Slot "${slotKey}" not found for ${owner} prize ${i}`);
                continue;
            }

            const card = await this.gameBoard3D.addCard(prizeCardKey, {
                cardId: prizeCard.id || 'prize',
                runtimeId: prizeCardKey,  // ✅ 正しいruntimeIdを設定
                frontTexture: null,
                backTexture: 'assets/ui/card_back.webp',
                zone: 'prize',
                owner,
                index: i,
            });

            if (card) {
                const pos = slot.getMesh().position;
                // ✅ 重ねる場合は高さ + X/Z方向にずらす（プレイマット風）
                const yOffset = 5 + stackLevel * 3;
                // ✅ 下のカード（stackLevel 0）を左下にずらす、上のカード（stackLevel 1）は中央
                // (1 - stackLevel) で stackLevel 0 のときだけオフセットが適用される
                const baseOffset = 8;
                const isBottomCard = stackLevel === 0;
                // プレイヤー側: 左下にずらす（X-, Z+）、CPU側: 右上にずらす（X+, Z-）
                const xOffset = isBottomCard ? (owner === 'player' ? -baseOffset : baseOffset) : 0;
                const zOffset = isBottomCard ? (owner === 'player' ? baseOffset : -baseOffset) : 0;

                card.setPosition(pos.x + xOffset, yOffset, pos.z + zOffset);
                card.layFlat();
                card.showBack();

                if (owner === 'cpu') {
                    card.flipForOpponent();
                }

                card.saveBasePosition();
            }
        }
    }

    /**
     * トラッシュをレンダリング
     */
    async _renderDiscard(owner, discard) {
        if (!discard || discard.length === 0) return;

        // トラッシュの一番上のカードのみ表示
        const topCard = discard[discard.length - 1];
        if (!topCard) return;

        const slotKey = `discard-${owner}-0`;
        const discardCardKey = `discard-${owner}`;

        // デバッグ: スロットの存在確認
        const slotCheck = this.gameBoard3D.slots.get(slotKey);
        if (!slotCheck) {
            console.warn(`⚠️ _renderDiscard: Slot "${slotKey}" not found for ${owner}`);
        }

        // 既存のトラッシュカードを削除して更新
        if (this.gameBoard3D.cards.has(discardCardKey)) {
            this.gameBoard3D.removeCard(discardCardKey);
        }

        const imagePath = getCardImagePath(topCard.name_en, topCard);
        const card = await this.gameBoard3D.addCard(discardCardKey, {
            cardId: topCard.id,
            frontTexture: imagePath,
            zone: 'discard',
            owner,
            index: 0,
        });

        const slot = this.gameBoard3D.slots.get(slotKey);
        if (slot && card) {
            const pos = slot.getMesh().position;
            card.setPosition(pos.x, 5, pos.z);
            card.layFlat();

            if (owner === 'cpu') {
                card.flipForOpponent();
            }

            card.saveBasePosition();
        }
    }

    /**
     * 手札を完全にクリア（ハイブリッド方式用）
     */
    _clearHand(owner) {
        const keysToRemove = [];
        this.gameBoard3D.cards.forEach((card, runtimeId) => {
            // ✅ Promiseの場合はまだロード中なのでスキップ
            if (card instanceof Promise) return;
            // Card3Dオブジェクトでない場合もスキップ
            if (!card.getMesh) return;

            const cardOwner = card.getMesh()?.userData?.owner;
            const cardZone = card.getMesh()?.userData?.zone;
            // 同じownerで、zoneが'hand'のカードを削除
            if (cardOwner === owner && cardZone === 'hand') {
                keysToRemove.push(runtimeId);
            }
        });
        keysToRemove.forEach(runtimeId => this.gameBoard3D.removeCard(runtimeId));
    }

    /**
     * @deprecated ハイブリッドモード: 手札はDOM版で管理されるため、このメソッドは使用されません
     * _clearHand()のみが使用されます（Three.js版手札の削除用）
     */

    /**
     * アクティブポケモンをレンダリング
     */
    async _renderActive(owner, activeCard) {
        if (!activeCard) return;

        const slotKey = `active-${owner}-0`;
        const existingCard = this.gameBoard3D.cards.get(activeCard.runtimeId);

        if (!existingCard) {
            // カードを追加
            const imagePath = getCardImagePath(activeCard.name_en, activeCard);
            const card = await this.gameBoard3D.addCard(activeCard.runtimeId, {
                cardId: activeCard.id,
                frontTexture: imagePath,
                zone: 'active',
                owner,
                index: 0,
            });

            // 位置設定（スロットの位置を使用）
            const slot = this.gameBoard3D.slots.get(slotKey);
            if (slot) {
                const pos = slot.getMesh().position;
                card.setPosition(pos.x, 5, pos.z);
                card.layFlat();

                if (owner === 'cpu') {
                    card.flipForOpponent();
                }

                card.saveBasePosition();
            }
        }
    }

    /**
     * ベンチをレンダリング
     */
    async _renderBench(owner, bench) {
        for (let i = 0; i < bench.length; i++) {
            const benchCard = bench[i];
            if (!benchCard) continue;

            const slotKey = `bench-${owner}-${i}`;
            const existingCard = this.gameBoard3D.cards.get(benchCard.runtimeId);

            if (!existingCard) {
                const imagePath = getCardImagePath(benchCard.name_en, benchCard);
                const card = await this.gameBoard3D.addCard(benchCard.runtimeId, {
                    cardId: benchCard.id,
                    frontTexture: imagePath,
                    zone: 'bench',
                    owner,
                    index: i,
                });

                const slot = this.gameBoard3D.slots.get(slotKey);
                if (slot) {
                    const pos = slot.getMesh().position;
                    card.setPosition(pos.x, 5, pos.z);
                    card.layFlat();

                    if (owner === 'cpu') {
                        card.flipForOpponent();
                    }

                    card.saveBasePosition();
                }
            }
        }
    }

    /**
     * カードを移動
     */
    async moveCard(runtimeId, fromZone, toZone, options = {}) {
        let card = this.gameBoard3D.cards.get(runtimeId);
        if (!card) return;

        // ✅ Promiseの場合は完了を待つ
        if (card instanceof Promise) {
            try {
                card = await card;
            } catch {
                return;
            }
        }
        // Card3Dオブジェクトでない場合はスキップ
        if (!card || !card.setPosition) return;

        // アニメーション付きで移動
        const targetSlotKey = `${toZone}-${options.owner || 'player'}-${options.index || 0}`;
        const targetSlot = this.gameBoard3D.slots.get(targetSlotKey);

        if (targetSlot) {
            const pos = targetSlot.getMesh().position;
            // ✅ 現在の実装: 即座に位置設定（必要に応じて将来GSAPで滑らかなアニメーション追加可能）
            card.setPosition(pos.x, 5, pos.z);
            card.saveBasePosition();
        }
    }

    /**
     * カードを削除
     */
    removeCard(runtimeId) {
        if (this.gameBoard3D) {
            this.gameBoard3D.removeCard(runtimeId);
        }
    }

    /**
     * 状態の簡易比較
     */
    _stateEquals(a, b) {
        if (!a || !b) return false;
        return JSON.stringify(a) === JSON.stringify(b);
    }

    /**
     * 状態のクローン
     */
    _cloneState(state) {
        return JSON.parse(JSON.stringify({
            players: {
                player: {
                    active: state.players.player.active,
                    bench: state.players.player.bench,
                    hand: state.players.player.hand?.map(c => c?.runtimeId) || [],
                    deck: state.players.player.deck?.length || 0,
                    prize: state.players.player.prize?.length || 0,
                    discard: state.players.player.discard?.map(c => c?.runtimeId) || [],
                },
                cpu: {
                    active: state.players.cpu.active,
                    bench: state.players.cpu.bench,
                    hand: state.players.cpu.hand?.map(c => c?.runtimeId) || [],
                    deck: state.players.cpu.deck?.length || 0,
                    prize: state.players.cpu.prize?.length || 0,
                    discard: state.players.cpu.discard?.map(c => c?.runtimeId) || [],
                }
            }
        }));
    }

    /**
     * Three.js が有効かどうか
     */
    isActive() {
        return this.isEnabled;
    }

    /**
     * 指定ゾーン・オーナーのスロットをハイライト
     * @param {string} zone
     * @param {string} owner
     * @param {number|null} index
     * @param {{onlyEmpty?: boolean, onlyOccupied?: boolean}} options
     */
    highlightSlotsByZone(zone, owner, index = null, options = {}) {
        if (this.gameBoard3D) {
            this.gameBoard3D.highlightSlotsByZone(zone, owner, index, options);
        }
    }

    /**
     * 互換API: index/filterなしでゾーン全体をハイライト
     */
    highlightSlots(zone, owner) {
        this.highlightSlotsByZone(zone, owner);
    }

    /**
     * 全スロットのハイライトを解除
     */
    clearHighlights() {
        if (this.gameBoard3D) {
            this.gameBoard3D.clearAllHighlights();
        }
    }

    /**
     * カードの選択状態を設定
     */
    setCardSelected(runtimeId, selected) {
        if (this.gameBoard3D) {
            // 手札カードのキー形式に対応
            const handKey = `hand-${runtimeId}`;
            if (this.gameBoard3D.cards.has(handKey)) {
                this.gameBoard3D.setCardSelected(handKey, selected);
            } else if (this.gameBoard3D.cards.has(runtimeId)) {
                this.gameBoard3D.setCardSelected(runtimeId, selected);
            }
        }
    }

    /**
     * カードのハイライト状態を設定
     */
    setCardHighlighted(runtimeId, highlighted) {
        if (this.gameBoard3D) {
            const handKey = `hand-${runtimeId}`;
            if (this.gameBoard3D.cards.has(handKey)) {
                this.gameBoard3D.setCardHighlighted(handKey, highlighted);
            } else if (this.gameBoard3D.cards.has(runtimeId)) {
                this.gameBoard3D.setCardHighlighted(runtimeId, highlighted);
            }
        }
    }

    /**
     * 全カードの選択状態を解除
     */
    clearAllCardSelections() {
        if (this.gameBoard3D) {
            this.gameBoard3D.clearAllCardSelections();
        }
    }

    /**
     * 全カードのハイライトを解除
     */
    clearAllCardHighlights() {
        if (this.gameBoard3D) {
            this.gameBoard3D.clearAllCardHighlights();
        }
    }

    /**
     * ゲーム開始時のアニメーション
     */
    async onGameStart() {
        if (!this.gameBoard3D) return;

        // カメラアニメーションなどをトリガーできる場所
        console.log('🎬 ThreeViewBridge: onGameStart triggered');

        // 将来的にカメラワークを追加する場合:
        // await this.gameBoard3D.cameraController.animateToStartView();
    }

    // ==========================================
    // 戦闘アニメーションAPI
    // ==========================================

    /**
     * 攻撃アニメーション
     */
    async animateAttack(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardAttack(runtimeId, duration);
    }

    /**
     * ダメージアニメーション
     */
    async animateDamage(runtimeId, duration = 500, intensity = 8) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardDamage(runtimeId, duration, intensity);
    }

    /**
     * ノックアウトアニメーション
     */
    async animateKnockout(runtimeId, duration = 800) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardKnockout(runtimeId, duration);
    }

    /**
     * HPフラッシュアニメーション
     */
    async animateHPFlash(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardHPFlash(runtimeId, duration);
    }

    /**
     * 画面シェイク効果
     */
    async animateScreenShake(duration = 400, intensity = 5) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateScreenShake(duration, intensity);
    }

    /**
     * 画面フラッシュ効果
     */
    async animateScreenFlash(duration = 300, color = 0xffffff) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateScreenFlash(duration, color);
    }

    // ==========================================
    // カード配布・移動アニメーションAPI
    // ==========================================

    /**
     * カード配布アニメーション
     */
    async animateDealCard(runtimeId, duration = 600) {
        if (!this.gameBoard3D) return;
        const handKey = `hand-${runtimeId}`;
        if (this.gameBoard3D.cards.has(handKey)) {
            await this.gameBoard3D.animateCardDeal(handKey, duration);
        } else if (this.gameBoard3D.cards.has(runtimeId)) {
            await this.gameBoard3D.animateCardDeal(runtimeId, duration);
        }
    }

    /**
     * カードドローアニメーション
     */
    async animateDrawCard(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        const handKey = `hand-${runtimeId}`;
        if (this.gameBoard3D.cards.has(handKey)) {
            await this.gameBoard3D.animateCardDraw(handKey, duration);
        } else if (this.gameBoard3D.cards.has(runtimeId)) {
            await this.gameBoard3D.animateCardDraw(runtimeId, duration);
        }
    }

    /**
     * カードプレイアニメーション
     */
    async animatePlayCard(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        const handKey = `hand-${runtimeId}`;
        if (this.gameBoard3D.cards.has(handKey)) {
            await this.gameBoard3D.animateCardPlay(handKey, duration);
        } else if (this.gameBoard3D.cards.has(runtimeId)) {
            await this.gameBoard3D.animateCardPlay(runtimeId, duration);
        }
    }

    /**
     * カードをアクティブに移動するアニメーション
     */
    async animateCardToActive(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardToActive(runtimeId, duration);
    }

    /**
     * カードをベンチに移動するアニメーション
     */
    async animateCardToBench(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardToBench(runtimeId, duration);
    }

    /**
     * ベンチ→アクティブ昇格アニメーション
     */
    async animateBenchToActive(pokemonId, benchIndex, duration = 500) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateBenchToActive(pokemonId, benchIndex, duration);
    }

    /**
     * 進化アニメーション
     */
    async animateEvolution(runtimeId, duration = 800) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardEvolution(runtimeId, duration);
    }

    /**
     * カードフリップアニメーション
     */
    async flipCard(runtimeId, duration = 600) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.flipCard(runtimeId, duration);
    }

    /**
     * エネルギーアタッチアニメーション
     */
    async animateEnergyAttach(runtimeId, duration = 600) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardEnergyAttach(runtimeId, duration);
    }

    /**
     * 回復グローアニメーション
     */
    async animateHeal(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        await this.gameBoard3D.animateCardHeal(runtimeId, duration);
    }

    /**
     * サイドカード取得アニメーション
     */
    async animatePrizeTake(runtimeId, duration = 400) {
        if (!this.gameBoard3D) return;
        const prizeKey = `prize-${runtimeId}`;
        if (this.gameBoard3D.cards.has(prizeKey)) {
            await this.gameBoard3D.animateCardPrizeTake(prizeKey, duration);
        } else if (this.gameBoard3D.cards.has(runtimeId)) {
            await this.gameBoard3D.animateCardPrizeTake(runtimeId, duration);
        }
    }

    // ==========================================
    // 特殊状態API
    // ==========================================

    /**
     * カードの特殊状態を設定
     */
    setCardCondition(runtimeId, condition, enabled) {
        if (!this.gameBoard3D) return;
        this.gameBoard3D.setCardCondition(runtimeId, condition, enabled);
    }

    /**
     * タイプ別グロー効果を設定
     */
    setCardTypeGlow(runtimeId, type) {
        if (!this.gameBoard3D) return;
        this.gameBoard3D.setCardTypeGlow(runtimeId, type);
    }

    /**
     * タイプ別グロー効果を解除
     */
    clearCardTypeGlow(runtimeId) {
        if (!this.gameBoard3D) return;
        this.gameBoard3D.clearCardTypeGlow(runtimeId);
    }

    /**
     * クリーンアップ
     */
    dispose() {
        if (this.gameBoard3D) {
            this.gameBoard3D.dispose();
        }
        this.isEnabled = false;
    }
}

// シングルトンエクスポート
export const threeViewBridge = new ThreeViewBridge();

export default threeViewBridge;
