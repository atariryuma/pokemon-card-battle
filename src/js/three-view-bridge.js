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
     * 初期化
     */
    async init(playmatSlotsData) {
        console.log('🎮 ThreeViewBridge.init() called');
        console.log('  - playmatSlotsData:', playmatSlotsData ? 'available' : 'null/undefined');

        this.container = document.getElementById('three-container');

        if (!this.container) {
            console.warn('⚠️ Three.js container (#three-container) not found');
            return false;
        }

        console.log('  - container found:', this.container);

        try {
            this.gameBoard3D = new GameBoard3D(this.container, {
                playmatTexture: 'assets/playmat/playmat.jpg',
                cardBackTexture: 'assets/ui/card_back.webp',
            });

            console.log('  - GameBoard3D created, calling init...');
            await this.gameBoard3D.init(playmatSlotsData);
            this.isEnabled = true;

            // DOMボードを非表示にする
            document.body.classList.add('three-active');

            console.log('✅ ThreeViewBridge initialized successfully');
            console.log('  - body.three-active:', document.body.classList.contains('three-active'));
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
            console.log('🖱️ Three.js slot click:', data);
            handler({
                owner: data.owner,
                zone: data.zone,
                index: String(data.index),
                cardId: null,
                runtimeId: null,
            });
        });

        this.gameBoard3D.setCardClickHandler((data) => {
            console.log('🖱️ Three.js card click:', data);
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
            console.log('🖱️ Three.js card drop:', data);
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

        // 差分検出
        if (this._stateEquals(this.lastState, state)) return;

        // アクティブポケモン
        await this._renderActive('player', state.players.player.active);
        await this._renderActive('cpu', state.players.cpu.active);

        // ベンチ
        await this._renderBench('player', state.players.player.bench);
        await this._renderBench('cpu', state.players.cpu.bench);

        // 山札
        await this._renderDeck('player', state.players.player.deck);
        await this._renderDeck('cpu', state.players.cpu.deck);

        // サイドカード
        await this._renderPrize('player', state.players.player.prizes);
        await this._renderPrize('cpu', state.players.cpu.prizes);

        // トラッシュ
        await this._renderDiscard('player', state.players.player.discard);
        await this._renderDiscard('cpu', state.players.cpu.discard);

        // 手札
        await this._renderHand('player', state.players.player.hand);
        await this._renderHand('cpu', state.players.cpu.hand);

        this.lastState = this._cloneState(state);
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
            const prizeCardKey = `prize-${owner}-${i}`;

            if (this.gameBoard3D.cards.has(prizeCardKey)) continue;

            const slot = this.gameBoard3D.slots.get(slotKey);
            if (!slot) {
                console.warn(`⚠️ _renderPrize: Slot "${slotKey}" not found for ${owner} prize ${i}`);
                continue;
            }

            const card = await this.gameBoard3D.addCard(prizeCardKey, {
                cardId: prizeCard.id || 'prize',
                frontTexture: null,
                backTexture: 'assets/ui/card_back.webp',
                zone: 'prize',
                owner,
                index: i,
            });

            if (card) {
                const pos = slot.getMesh().position;
                // 重ねる場合は高さをずらす
                const yOffset = 5 + stackLevel * 3;
                card.setPosition(pos.x, yOffset, pos.z);
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
     * 手札をレンダリング
     */
    async _renderHand(owner, hand) {
        if (!hand || hand.length === 0) return;

        const isCpu = owner === 'cpu';

        // 現在の手札カードのキーを収集
        const currentHandKeys = new Set();

        for (let i = 0; i < hand.length; i++) {
            const handCard = hand[i];
            if (!handCard) continue;

            const handCardKey = `hand-${handCard.runtimeId}`;
            currentHandKeys.add(handCardKey);

            // 既にレンダリング済みなら位置更新のみ
            const existingCard = this.gameBoard3D.cards.get(handCardKey);
            if (existingCard) {
                // 位置を更新（カード枚数変更時のため）
                const pos = this.gameBoard3D.getHandCardPosition(owner, i, hand.length);
                existingCard.setPosition(pos.x, pos.y, pos.z);
                // ファン型レイアウト: rotationZはファンの傾き角度
                // CPUの手札は裏向き（Y軸180度回転）
                const rotationY = isCpu ? 180 : 0;
                const fanRotationZ = pos.rotationZ || 0;
                const finalRotationZ = isCpu ? (180 + fanRotationZ) : fanRotationZ;
                existingCard.setRotation(pos.rotationX, rotationY, finalRotationZ);
                existingCard.saveBasePosition();
                continue;
            }

            // 新規カード追加
            const imagePath = isCpu ? null : getCardImagePath(handCard.name_en, handCard);
            const card = await this.gameBoard3D.addCard(handCardKey, {
                cardId: handCard.id,
                runtimeId: handCard.runtimeId,
                frontTexture: imagePath,
                backTexture: 'assets/ui/card_back.webp',
                zone: 'hand',
                owner,
                index: i,
            });

            if (card) {
                const pos = this.gameBoard3D.getHandCardPosition(owner, i, hand.length);
                card.setPosition(pos.x, pos.y, pos.z);
                // ファン型レイアウト: rotationZはファンの傾き角度
                // CPUの手札は裏向き（Y軸180度回転）
                // setRotationは度数を受け取る: (rx, ry, rz)
                const rotationY = isCpu ? 180 : 0;
                const fanRotationZ = pos.rotationZ || 0;
                const finalRotationZ = isCpu ? (180 + fanRotationZ) : fanRotationZ;
                card.setRotation(pos.rotationX, rotationY, finalRotationZ);

                card.saveBasePosition();
            }
        }

        // 手札から消えたカードを削除
        const keysToRemove = [];
        this.gameBoard3D.cards.forEach((card, key) => {
            // Card3DのuserDataはmesh.userDataに格納されている
            const cardOwner = card.getMesh()?.userData?.owner;
            if (key.startsWith(`hand-`) && cardOwner === owner && !currentHandKeys.has(key)) {
                keysToRemove.push(key);
            }
        });
        keysToRemove.forEach(key => this.gameBoard3D.removeCard(key));
    }

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
        const card = this.gameBoard3D.cards.get(runtimeId);
        if (!card) return;

        // アニメーション付きで移動
        const targetSlotKey = `${toZone}-${options.owner || 'player'}-${options.index || 0}`;
        const targetSlot = this.gameBoard3D.slots.get(targetSlotKey);

        if (targetSlot) {
            const pos = targetSlot.getMesh().position;
            // TODO: GSAP でアニメーション
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
                    prizes: state.players.player.prizes?.length || 0,
                    discard: state.players.player.discard?.map(c => c?.runtimeId) || [],
                },
                cpu: {
                    active: state.players.cpu.active,
                    bench: state.players.cpu.bench,
                    hand: state.players.cpu.hand?.map(c => c?.runtimeId) || [],
                    deck: state.players.cpu.deck?.length || 0,
                    prizes: state.players.cpu.prizes?.length || 0,
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
     */
    highlightSlots(zone, owner) {
        if (this.gameBoard3D) {
            this.gameBoard3D.highlightSlotsByZone(zone, owner);
        }
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
