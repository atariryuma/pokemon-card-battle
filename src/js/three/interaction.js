/**
 * THREE.JS INTERACTION HANDLER
 *
 * Raycaster を使用した正確な3Dインタラクション
 * - マウス座標 → 3D空間へのレイ変換
 * - オブジェクト交差判定
 * - クリック/ホバー/ドラッグ&ドロップ イベント処理
 */

import * as THREE from 'three';

export class InteractionHandler {
    constructor(scene, camera, canvas) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // ゲーム状態への参照（ターンチェック用）
        this.gameState = null;

        // インタラクティブオブジェクトのリスト
        this.interactiveObjects = [];

        // コールバック
        this.onClickCallback = null;
        this.onHoverCallback = null;
        this.onDragStartCallback = null;
        this.onDragEndCallback = null;
        this.onDropCallback = null;

        // 現在ホバー中のオブジェクト
        this.hoveredObject = null;

        // ドラッグ状態
        this.isDragging = false;
        this.draggedObject = null;
        this.dragStartPosition = new THREE.Vector3();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y=0平面
        // クリックイベントのデバウンス（重複防止）
        this.clickDebounceTime = 300; // 300ms
        this.lastClickTime = 0;


        // イベントバインド
        this._boundHandleClick = this._handleClick.bind(this);
        this._boundHandleMouseMove = this._handleMouseMove.bind(this);
        this._boundHandleMouseDown = this._handleMouseDown.bind(this);
        this._boundHandleMouseUp = this._handleMouseUp.bind(this);
        this._boundHandleMouseLeave = this._handleMouseLeave.bind(this);

        this._bindEvents();
    }

    /**
     * ゲーム状態を設定（ターンチェック用）
     */
    setGameState(gameState) {
        this.gameState = gameState;
    }

    /**
     * イベントリスナーをバインド
     */
    _bindEvents() {
        this.canvas.addEventListener('click', this._boundHandleClick, true);
        this.canvas.addEventListener('mousemove', this._boundHandleMouseMove, true);
        this.canvas.addEventListener('mousedown', this._boundHandleMouseDown, true);
        this.canvas.addEventListener('mouseup', this._boundHandleMouseUp, true);
        this.canvas.addEventListener('mouseleave', this._boundHandleMouseLeave, true);
    }

    /**
     * マウス座標を正規化（-1 ～ 1）
     */
    _normalizeMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /**
     * レイキャストで交差オブジェクトを取得
     */
    _getIntersects() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // ✅ recursive=falseに変更: 登録オブジェクトは直接メッシュなので子階層を辿る必要がない
        return this.raycaster.intersectObjects(this.interactiveObjects, false);
    }


    /**
     * クリックハンドラ
     */
    _handleClick(event) {
        // ✅ デバッグ: クリックイベント検出
        console.log('🖱️ Three.js Click:', {
            target: event.target.tagName,
            canvas: this.canvas.tagName,
            isCanvas: event.target === this.canvas
        });

        // デバウンス処理: 短時間での重複クリックを防止
        const now = Date.now();
        if (now - this.lastClickTime < this.clickDebounceTime) {
            console.log('⏱️ Click debounced');
            return;
        }
        this.lastClickTime = now;

        this._normalizeMousePosition(event);
        const intersects = this._getIntersects();

        // ✅ 詳細デバッグ: 登録されているオブジェクトの情報
        console.log('🎯 Raycaster intersects:', {
            count: intersects.length,
            interactiveObjectsCount: this.interactiveObjects.length,
            mouse: { x: this.mouse.x.toFixed(2), y: this.mouse.y.toFixed(2) }
        });

        // ✅ 追加デバッグ: 登録されているオブジェクトの詳細をログ
        if (this.interactiveObjects.length > 0 && intersects.length === 0) {
            console.log('🔍 Interactive objects registered:');
            this.interactiveObjects.slice(0, 5).forEach((obj, i) => {
                console.log(`  [${i}] type=${obj.userData?.type}, zone=${obj.userData?.zone}, owner=${obj.userData?.owner}, pos=(${obj.position?.x?.toFixed(1)}, ${obj.position?.y?.toFixed(1)}, ${obj.position?.z?.toFixed(1)}), visible=${obj.visible}`);
            });
            if (this.interactiveObjects.length > 5) {
                console.log(`  ... and ${this.interactiveObjects.length - 5} more`);
            }
            // カメラとレイの情報
            console.log('📷 Camera:', {
                pos: `(${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)})`,
                type: this.camera.type
            });
            console.log('🔦 Ray origin:', this.raycaster.ray.origin);
            console.log('🔦 Ray direction:', this.raycaster.ray.direction);
        }

        if (intersects.length > 0) {
            const firstHit = intersects[0];
            const object = this._findInteractiveParent(firstHit.object);

            console.log('✅ Hit object:', {
                type: object?.userData?.type,
                zone: object?.userData?.zone,
                owner: object?.userData?.owner,
                distance: firstHit.distance.toFixed(2)
            });

            if (object && this.onClickCallback) {
                const userData = object.userData || {};
                this.onClickCallback({
                    object,
                    userData,
                    point: firstHit.point,
                    event
                });
            }
        } else {
            console.log('❌ No intersects found');
        }
    }

    /**
     * マウス移動ハンドラ（ホバー検出）
     */
    _handleMouseMove(event) {
        this._normalizeMousePosition(event);
        const intersects = this._getIntersects();

        if (intersects.length > 0) {
            const firstHit = intersects[0];
            const object = this._findInteractiveParent(firstHit.object);

            if (object !== this.hoveredObject) {
                // 前のオブジェクトからホバー解除
                if (this.hoveredObject && this.onHoverCallback) {
                    console.log('👋 Hover leave:', this.hoveredObject.userData?.type);
                    this.onHoverCallback({
                        object: this.hoveredObject,
                        isHovered: false,
                        userData: this.hoveredObject.userData || {}
                    });
                }

                // 新しいオブジェクトにホバー
                this.hoveredObject = object;
                if (object && this.onHoverCallback) {
                    console.log('👉 Hover enter:', object.userData);
                    this.onHoverCallback({
                        object,
                        isHovered: true,
                        userData: object.userData || {}
                    });
                }
            }
        } else {
            // 何もホバーしていない
            if (this.hoveredObject && this.onHoverCallback) {
                console.log('🚪 Hover exit (no object)');
                this.onHoverCallback({
                    object: this.hoveredObject,
                    isHovered: false,
                    userData: this.hoveredObject.userData || {}
                });
                this.hoveredObject = null;
            }
        }

        // ドラッグ中の処理
        if (this.isDragging && this.draggedObject) {
            this._updateDragPosition(event);
        }
    }

    /**
     * マウスダウンハンドラ（ドラッグ開始）
     * ✅ ドラッグ機能を無効化：クリックのみ使用
     */
    _handleMouseDown(event) {
        // ✅ ドラッグ機能は完全に無効化
        return;
    }

    /**
     * マウスアップハンドラ（ドラッグ終了/ドロップ）
     * ✅ ドラッグ機能を無効化：クリックのみ使用
     */
    _handleMouseUp(event) {
        // ✅ ドラッグ機能は完全に無効化
        return;
    }

    /**
     * マウスリーブハンドラ（キャンバスから出た時）
     */
    _handleMouseLeave(event) {
        // ✅ ホバー状態をクリア
        if (this.hoveredObject && this.onHoverCallback) {
            this.onHoverCallback({
                object: this.hoveredObject,
                isHovered: false,
                userData: this.hoveredObject.userData || {}
            });
            this.hoveredObject = null;
        }
    }

    /**
     * ドラッグ中の位置更新
     */
    _updateDragPosition(event) {
        if (!this.draggedObject) return;

        this._normalizeMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // ドラッグ平面との交点を計算
        const intersection = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
            // カードを浮かせる
            this.draggedObject.position.x = intersection.x;
            this.draggedObject.position.z = intersection.z;
            this.draggedObject.position.y = this.dragStartPosition.y + 30; // ドラッグ中は浮かせる
        }
    }

    /**
     * インタラクティブな親オブジェクトを探す
     */
    _findInteractiveParent(object) {
        let current = object;
        while (current) {
            if (current.userData && current.userData.isInteractive) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * インタラクティブオブジェクトを登録
     */
    register(object) {
        if (!this.interactiveObjects.includes(object)) {
            this.interactiveObjects.push(object);
            object.userData = object.userData || {};
            object.userData.isInteractive = true;
        }
    }

    /**
     * インタラクティブオブジェクトを解除
     */
    unregister(object) {
        const index = this.interactiveObjects.indexOf(object);
        if (index !== -1) {
            this.interactiveObjects.splice(index, 1);
        }
    }

    /**
     * クリックコールバック設定
     */
    onClick(callback) {
        this.onClickCallback = callback;
    }

    /**
     * ホバーコールバック設定
     */
    onHover(callback) {
        this.onHoverCallback = callback;
    }

    /**
     * ドラッグ開始コールバック設定
     */
    onDragStart(callback) {
        this.onDragStartCallback = callback;
    }

    /**
     * ドラッグ終了コールバック設定
     */
    onDragEnd(callback) {
        this.onDragEndCallback = callback;
    }

    /**
     * ドロップコールバック設定
     */
    onDrop(callback) {
        this.onDropCallback = callback;
    }

    /**
     * クリーンアップ
     */
    dispose() {
        this.canvas.removeEventListener('click', this._boundHandleClick);
        this.canvas.removeEventListener('mousemove', this._boundHandleMouseMove);
        this.canvas.removeEventListener('mousedown', this._boundHandleMouseDown);
        this.canvas.removeEventListener('mouseup', this._boundHandleMouseUp);
        this.canvas.removeEventListener('mouseleave', this._boundHandleMouseLeave);

        this.interactiveObjects = [];
        this.onClickCallback = null;
        this.onHoverCallback = null;
        this.onDragStartCallback = null;
        this.onDragEndCallback = null;
        this.onDropCallback = null;
        this.isDragging = false;
        this.draggedObject = null;
        this.hoveredObject = null;
    }
}

export default InteractionHandler;
