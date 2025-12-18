/**
 * THREE.JS GAME BOARD MANAGER
 * 
 * ゲームボード全体の管理
 * - プレイマット、スロット、カードの統合
 * - 既存の座標データとの連携
 * - 既存ゲームロジック（game.js）との接続
 */

import { ThreeScene } from './scene.js';
import { Playmat } from './playmat.js';
import { CardSlot } from './card-slot.js';
import { Card3D } from './card.js';
import { InteractionHandler } from './interaction.js';

export class GameBoard3D {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            playmatTexture: 'assets/images/playmat.png',
            cardBackTexture: 'assets/images/card_back.png',
            ...options
        };

        // Three.js コンポーネント
        this.threeScene = null;
        this.playmat = null;
        this.interaction = null;

        // ゲームオブジェクト
        this.slots = new Map();        // zone-owner-index → CardSlot
        this.cards = new Map();        // runtimeId → Card3D

        // コールバック
        this.onSlotClick = null;
        this.onCardClick = null;
        this.onCardDrop = null;

        // 既存の座標データ
        this.playmatSlotsData = null;

        // 設定（ピクセル→3D変換用）
        this.playmatPixelSize = 679;
        this.playmat3DSize = 600;
    }

    /**
     * 初期化
     */
    async init(playmatSlotsData) {
        this.playmatSlotsData = playmatSlotsData;

        // シーン作成
        this.threeScene = new ThreeScene(this.container);

        // プレイマット作成
        this.playmat = new Playmat(
            this.threeScene.getScene(),
            this.options.playmatTexture
        );

        // インタラクションハンドラ
        this.interaction = new InteractionHandler(
            this.threeScene.getScene(),
            this.threeScene.getCamera(),
            this.threeScene.getCanvas()
        );

        // インタラクションハンドラ設定
        this.interaction.onClick((data) => this._handleClick(data));
        this.interaction.onHover((data) => this._handleHover(data));
        this.interaction.onDragStart((data) => this._handleDragStart(data));
        this.interaction.onDragEnd((data) => this._handleDragEnd(data));
        this.interaction.onDrop((data) => this._handleDrop(data));

        // スロット作成
        this._createSlots();

        // アニメーション更新コールバック設定
        this.threeScene.setUpdateCallback((time) => {
            this.updateAnimations(time);
        });

        // アニメーションループ開始
        this.threeScene.start();

        console.log('🎮 GameBoard3D initialized');
    }

    /**
     * スロット作成（slots_named配列から）
     */
    _createSlots() {
        if (!this.playmatSlotsData || !this.playmatSlotsData.slots_named) {
            console.warn('No playmat slot data available, using fallback positions');
            this._createFallbackSlots();
            return;
        }

        const slotsNamed = this.playmatSlotsData.slots_named;
        const imageSize = this.playmatSlotsData.image_size || { width: 679, height: 679 };
        this.playmatPixelSize = imageSize.width;

        slotsNamed.forEach(slot => {
            const { name, bbox, size } = slot;
            const coords = {
                x: bbox.x_min,
                y: bbox.y_min,
                width: size.width,
                height: size.height
            };

            const parsed = this._parseSlotName(name);
            if (!parsed.zone) return;

            this._createSingleSlot(parsed.owner, parsed.zone, parsed.index, coords);
        });

        console.log(`📍 Created ${this.slots.size} slots from playmat data`);
        console.log('📍 Slot keys:', Array.from(this.slots.keys()));
    }

    /**
     * スロット名をパース
     * 実際の命名規則:
     * - bottom_bench_* / active_bottom = player
     * - top_bench_* / active_top = cpu
     * - bottom_right_deck = player山札, top_left_deck = cpu山札
     * - bottom_right_trash = playerトラッシュ, top_left_trash = cpuトラッシュ
     * - side_left_* = playerサイド, side_right_* = cpuサイド
     */
    _parseSlotName(name) {
        // ベンチ
        if (name.includes('bench')) {
            const isPlayer = name.includes('bottom');
            const match = name.match(/bench_(\d+)/);
            return {
                owner: isPlayer ? 'player' : 'cpu',
                zone: 'bench',
                index: match ? parseInt(match[1]) - 1 : 0
            };
        }

        // アクティブ
        if (name.includes('active')) {
            const isPlayer = name.includes('bottom');
            return {
                owner: isPlayer ? 'player' : 'cpu',
                zone: 'active',
                index: 0
            };
        }

        // サイドカード (side_left = player, side_right = cpu)
        if (name.startsWith('side_')) {
            const isPlayer = name.includes('left');
            const match = name.match(/side_(?:left|right)_(\d+)/);
            return {
                owner: isPlayer ? 'player' : 'cpu',
                zone: 'prize',
                index: match ? parseInt(match[1]) - 1 : 0
            };
        }

        // 山札 (bottom_right_deck = player, top_left_deck = cpu)
        if (name.includes('deck')) {
            const isPlayer = name.includes('bottom');
            return {
                owner: isPlayer ? 'player' : 'cpu',
                zone: 'deck',
                index: 0
            };
        }

        // トラッシュ (bottom_right_trash = player, top_left_trash = cpu)
        if (name.includes('trash')) {
            const isPlayer = name.includes('bottom');
            return {
                owner: isPlayer ? 'player' : 'cpu',
                zone: 'discard',
                index: 0
            };
        }

        // スタジアム
        if (name.includes('stadium')) {
            return { owner: 'shared', zone: 'stadium', index: 0 };
        }

        return { owner: null, zone: null, index: 0 };
    }

    /**
     * 単一スロットを作成
     */
    _createSingleSlot(owner, zone, index, coords) {
        if (!owner) return;
        // shared zones（stadium）も作成する
        if (owner === 'shared') {
            owner = 'shared';
        }

        const slot = new CardSlot({
            width: this._pixelTo3D(coords.width),
            height: this._pixelTo3D(coords.height),
            zone,
            owner,
            index,
        });

        const mesh = slot.create();

        // 位置設定
        const pos = this._pixelCoordsTo3D(coords.x, coords.y, coords.width, coords.height);
        slot.setPosition(pos.x, 1, pos.z);

        // 相手側は180度回転
        if (owner === 'cpu') {
            slot.flipForOpponent();
        }

        // シーンに追加
        this.threeScene.add(mesh);
        this.interaction.register(mesh);

        // マップに保存
        const slotKey = `${zone}-${owner}-${index}`;
        this.slots.set(slotKey, slot);
    }

    /**
     * フォールバック: デフォルト位置でスロット作成
     */
    _createFallbackSlots() {
        console.log('📍 Creating fallback slots at default positions');
        // プレイヤーベンチ (5スロット)
        for (let i = 0; i < 5; i++) {
            const x = -200 + i * 80;
            this._createSingleSlot('player', 'bench', i, { x, y: 200, width: 60, height: 84 });
        }
        // プレイヤーアクティブ
        this._createSingleSlot('player', 'active', 0, { x: 0, y: 100, width: 60, height: 84 });
        // CPUベンチ
        for (let i = 0; i < 5; i++) {
            const x = -200 + i * 80;
            this._createSingleSlot('cpu', 'bench', i, { x, y: -200, width: 60, height: 84 });
        }
        // CPUアクティブ
        this._createSingleSlot('cpu', 'active', 0, { x: 0, y: -100, width: 60, height: 84 });
    }

    /**
     * スロットキーをパース
     */
    _parseSlotKey(key) {
        // "bottom-bench-1" → { zone: "bench", index: 0 }
        // "active-bottom" → { zone: "active", index: 0 }
        // "side-left-1" → { zone: "prize", index: 0 }

        if (key.includes('bench')) {
            const match = key.match(/bench-(\d+)/);
            return { zone: 'bench', index: match ? parseInt(match[1]) - 1 : 0 };
        }
        if (key.includes('active')) {
            return { zone: 'active', index: 0 };
        }
        if (key.includes('side')) {
            const match = key.match(/side-(?:left|right)-(\d+)/);
            return { zone: 'prize', index: match ? parseInt(match[1]) - 1 : 0 };
        }
        if (key.includes('deck')) {
            return { zone: 'deck', index: 0 };
        }
        if (key.includes('trash')) {
            return { zone: 'discard', index: 0 };
        }

        return { zone: null, index: 0 };
    }

    /**
     * ピクセル座標を3D座標に変換
     */
    _pixelCoordsTo3D(x, y, width, height) {
        // 中心座標を計算
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // プレイマット中央を原点 (0,0) とした座標に変換
        const ratio = this.playmat3DSize / this.playmatPixelSize;
        const offsetX = (centerX - this.playmatPixelSize / 2) * ratio;
        const offsetZ = (centerY - this.playmatPixelSize / 2) * ratio;

        return { x: offsetX, z: offsetZ };
    }

    /**
     * ピクセルサイズを3Dサイズに変換
     */
    _pixelTo3D(pixels) {
        return pixels * (this.playmat3DSize / this.playmatPixelSize);
    }

    /**
     * クリックハンドラ
     */
    _handleClick(data) {
        const { userData } = data;

        if (userData.type === 'slot' && this.onSlotClick) {
            this.onSlotClick({
                zone: userData.zone,
                owner: userData.owner,
                index: userData.index,
            });
        }

        if (userData.type === 'card' && this.onCardClick) {
            this.onCardClick({
                cardId: userData.cardId,
                runtimeId: userData.runtimeId,
                zone: userData.zone,
                owner: userData.owner,
                index: userData.index,
            });
        }
    }

    /**
     * ホバーハンドラ
     */
    _handleHover(data) {
        const { object, isHovered, userData } = data;

        if (userData?.type === 'slot') {
            const slotKey = `${userData.zone}-${userData.owner}-${userData.index}`;
            const slot = this.slots.get(slotKey);
            if (slot) {
                slot.setHovered(isHovered);
            }
        }

        if (userData?.type === 'card') {
            const card = this.cards.get(userData.runtimeId);
            if (card) {
                card.setHovered(isHovered);
            }
        }
    }

    /**
     * ドラッグ開始ハンドラ
     */
    _handleDragStart(data) {
        const { userData } = data;
        if (userData?.type === 'card') {
            // プレイヤーの手札のみドラッグ可能
            if (userData.owner === 'player' && userData.zone === 'hand') {
                // ドラッグ可能なスロットをハイライト
                this.highlightSlotsByZone('active', 'player');
                this.highlightSlotsByZone('bench', 'player');
            }
        }
    }

    /**
     * ドラッグ終了ハンドラ
     */
    _handleDragEnd(data) {
        const { object, dropped } = data;

        // ハイライト解除
        this.clearAllHighlights();

        // ドロップされなかった場合は元の位置に戻す
        if (!dropped && object) {
            const card = this.cards.get(object.userData?.runtimeId);
            if (card) {
                const baseY = card.getMesh()?.userData?.baseY || 0;
                card.setPosition(
                    data.startPosition?.x || object.position.x,
                    baseY,
                    data.startPosition?.z || object.position.z
                );
            }
        }
    }

    /**
     * ドロップハンドラ
     */
    _handleDrop(data) {
        const { dragData, dropTargetData, startPosition } = data;

        if (this.onCardDrop && dropTargetData) {
            this.onCardDrop({
                cardId: dragData.cardId,
                runtimeId: dragData.runtimeId,
                cardType: dragData.cardType,
                fromZone: dragData.zone,
                fromOwner: dragData.owner,
                toZone: dropTargetData.zone,
                toOwner: dropTargetData.owner,
                toIndex: dropTargetData.index,
                startPosition: startPosition
            });
        }
    }

    /**
     * スロットクリックコールバック設定
     */
    setSlotClickHandler(callback) {
        this.onSlotClick = callback;
    }

    /**
     * カードクリックコールバック設定
     */
    setCardClickHandler(callback) {
        this.onCardClick = callback;
    }

    /**
     * カードドロップコールバック設定
     */
    setCardDropHandler(callback) {
        this.onCardDrop = callback;
    }

    /**
     * 指定ゾーン・オーナーのスロットをハイライト
     */
    highlightSlotsByZone(zone, owner) {
        this.slots.forEach((slot, key) => {
            if (key.startsWith(`${zone}-${owner}`)) {
                slot.setHighlighted(true);
            }
        });
    }

    /**
     * 全スロットのハイライトを解除
     */
    clearAllHighlights() {
        this.slots.forEach(slot => slot.setHighlighted(false));
    }

    /**
     * 手札カードの位置を計算（ファン型レイアウト）
     * 参考: https://github.com/richardschneider/cardsJS (David Gouveiのファンアルゴリズム)
     * 参考: https://github.com/ycarowr/UiCard
     *
     * @param {string} owner - 'player' or 'cpu'
     * @param {number} index - カードのインデックス
     * @param {number} totalCards - 手札の総枚数
     * @returns {{x: number, y: number, z: number, rotationX: number, rotationZ: number}}
     */
    getHandCardPosition(owner, index, totalCards) {
        const isPlayer = owner === 'player';

        // ファン型レイアウトの設定
        // プレイマットサイズ600の半分=300が端
        // カメラを引いたので、手札間隔を広げて見やすく
        const fanConfig = {
            radius: 450,            // ファンの円の半径（広めに）
            maxAngle: 50,           // 最大展開角度（度）- カード間隔を広く
            baseZ: isPlayer ? 380 : -380,  // 手札エリアのZ位置
            baseY: 15,              // 手札の高さ
            cardTilt: isPlayer ? -45 : 45, // カードの前後傾き（度）
        };

        // 中央を0とした正規化インデックス（-0.5 〜 0.5）
        const normalizedIndex = totalCards > 1
            ? (index / (totalCards - 1)) - 0.5
            : 0;

        // ファンの角度計算（中央が0度、端が±maxAngle/2）
        const fanAngle = normalizedIndex * fanConfig.maxAngle;
        const fanAngleRad = fanAngle * (Math.PI / 180);

        // ファンの円に沿った位置計算
        // X: 円周上のX座標
        // Z: アーク状の曲がり（中央が手前、端が少し奥）
        const x = Math.sin(fanAngleRad) * fanConfig.radius;
        const arcOffset = (1 - Math.cos(fanAngleRad)) * fanConfig.radius * 0.1;
        const z = fanConfig.baseZ + (isPlayer ? arcOffset : -arcOffset);

        // Y: アーク状の高さ（中央が高く、端が低い）
        const heightVariation = Math.cos(fanAngleRad * 2) * 8;
        const y = fanConfig.baseY + heightVariation;

        // カードの回転（Z軸 = ファンの傾き）
        const rotationZ = isPlayer ? -fanAngle : fanAngle;

        return {
            x,
            y,
            z,
            rotationX: fanConfig.cardTilt,
            rotationZ
        };
    }

    /**
     * カードを追加
     */
    async addCard(runtimeId, options) {
        const card = new Card3D({
            runtimeId,
            backTexture: this.options.cardBackTexture,
            ...options
        });

        const mesh = await card.create();

        // 手札以外のカードはプレイマット上に水平に配置
        // 手札カードは呼び出し側で setRotation() で回転を設定する
        if (options.zone !== 'hand') {
            card.layFlat();
        }

        // 手札カードは呼吸アニメーションを有効化
        if (options.zone === 'hand') {
            card.enableBreathing(true);
        }

        this.threeScene.add(mesh);
        this.interaction.register(mesh);
        this.cards.set(runtimeId, card);

        // saveBasePosition は呼び出し側で位置設定後に呼ぶ
        return card;
    }

    /**
     * カードを削除
     */
    removeCard(runtimeId) {
        const card = this.cards.get(runtimeId);
        if (card) {
            this.interaction.unregister(card.getMesh());
            this.threeScene.remove(card.getMesh());
            card.dispose();
            this.cards.delete(runtimeId);
        }
    }

    /**
     * アニメーション更新（毎フレーム呼び出し）
     * @param {number} time - 経過時間（秒）
     */
    updateAnimations(time) {
        // すべてのカードのアニメーションを更新
        this.cards.forEach(card => {
            card.updateBreathing(time);
            card.updateGlow(time);
        });
    }

    /**
     * カードの選択状態を設定
     */
    setCardSelected(runtimeId, selected) {
        const card = this.cards.get(runtimeId);
        if (card) {
            card.setSelected(selected);
        }
    }

    /**
     * カードのハイライト状態を設定
     */
    setCardHighlighted(runtimeId, highlighted) {
        const card = this.cards.get(runtimeId);
        if (card) {
            card.setHighlighted(highlighted);
        }
    }

    /**
     * 全カードの選択状態を解除
     */
    clearAllCardSelections() {
        this.cards.forEach(card => card.setSelected(false));
    }

    /**
     * 全カードのハイライトを解除
     */
    clearAllCardHighlights() {
        this.cards.forEach(card => card.setHighlighted(false));
    }

    // ==========================================
    // 戦闘アニメーションAPI
    // ==========================================

    /**
     * カードの攻撃アニメーション
     */
    async animateCardAttack(runtimeId, duration = 400) {
        const card = this.cards.get(runtimeId);
        if (card) {
            await card.animateAttack(duration);
        }
    }

    /**
     * カードのダメージシェイクアニメーション
     */
    async animateCardDamage(runtimeId, duration = 500, intensity = 8) {
        const card = this.cards.get(runtimeId);
        if (card) {
            await card.animateDamageShake(duration, intensity);
        }
    }

    /**
     * カードのノックアウトアニメーション
     */
    async animateCardKnockout(runtimeId, duration = 800) {
        const card = this.cards.get(runtimeId);
        if (card) {
            await card.animateKnockout(duration);
        }
    }

    /**
     * カードのHPフラッシュアニメーション
     */
    async animateCardHPFlash(runtimeId, duration = 400) {
        const card = this.cards.get(runtimeId);
        if (card) {
            await card.animateHPFlash(duration);
        }
    }

    /**
     * 画面シェイク効果
     */
    animateScreenShake(duration = 400, intensity = 5) {
        const camera = this.threeScene.getCamera();
        if (!camera) return Promise.resolve();

        return new Promise((resolve) => {
            const startX = camera.position.x;
            const startY = camera.position.y;
            const startTime = performance.now();

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const decay = 1 - progress;
                const shakeX = Math.sin(progress * Math.PI * 12) * intensity * decay;
                const shakeY = Math.cos(progress * Math.PI * 10) * intensity * decay * 0.5;

                camera.position.x = startX + shakeX;
                camera.position.y = startY + shakeY;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    camera.position.x = startX;
                    camera.position.y = startY;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * クリーンアップ
     */
    dispose() {
        this.slots.forEach(slot => slot.dispose());
        this.cards.forEach(card => card.dispose());
        this.interaction.dispose();
        this.playmat.dispose();
        this.threeScene.dispose();
    }
}

export default GameBoard3D;
