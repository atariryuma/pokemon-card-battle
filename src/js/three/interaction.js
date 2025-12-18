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

        // イベントバインド
        this._boundHandleClick = this._handleClick.bind(this);
        this._boundHandleMouseMove = this._handleMouseMove.bind(this);
        this._boundHandleMouseDown = this._handleMouseDown.bind(this);
        this._boundHandleMouseUp = this._handleMouseUp.bind(this);

        this._bindEvents();
    }

    /**
     * イベントリスナーをバインド
     */
    _bindEvents() {
        this.canvas.addEventListener('click', this._boundHandleClick, true);
        this.canvas.addEventListener('mousemove', this._boundHandleMouseMove, true);
        this.canvas.addEventListener('mousedown', this._boundHandleMouseDown, true);
        this.canvas.addEventListener('mouseup', this._boundHandleMouseUp, true);
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
        return this.raycaster.intersectObjects(this.interactiveObjects, true);
    }

    /**
     * クリックハンドラ
     */
    _handleClick(event) {
        this._normalizeMousePosition(event);
        const intersects = this._getIntersects();

        if (intersects.length > 0) {
            const firstHit = intersects[0];
            const object = this._findInteractiveParent(firstHit.object);

            if (object && this.onClickCallback) {
                const userData = object.userData || {};
                this.onClickCallback({
                    object,
                    userData,
                    point: firstHit.point,
                    event
                });
            }
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
                    this.onHoverCallback({
                        object: this.hoveredObject,
                        isHovered: false
                    });
                }

                // 新しいオブジェクトにホバー
                this.hoveredObject = object;
                if (object && this.onHoverCallback) {
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
                this.onHoverCallback({
                    object: this.hoveredObject,
                    isHovered: false
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
     */
    _handleMouseDown(event) {
        if (event.button !== 0) return; // 左クリックのみ

        this._normalizeMousePosition(event);
        const intersects = this._getIntersects();

        if (intersects.length > 0) {
            const firstHit = intersects[0];
            const object = this._findInteractiveParent(firstHit.object);

            // ドラッグ可能なオブジェクト（カード）のみ
            if (object && object.userData?.type === 'card' && object.userData?.isDraggable !== false) {
                this.isDragging = true;
                this.draggedObject = object;
                this.dragStartPosition.copy(object.position);

                // ドラッグ平面をオブジェクトの高さに設定
                this.dragPlane.constant = -object.position.y;

                if (this.onDragStartCallback) {
                    this.onDragStartCallback({
                        object,
                        userData: object.userData,
                        startPosition: this.dragStartPosition.clone()
                    });
                }

                this.canvas.style.cursor = 'grabbing';
            }
        }
    }

    /**
     * マウスアップハンドラ（ドラッグ終了/ドロップ）
     */
    _handleMouseUp(event) {
        if (!this.isDragging || !this.draggedObject) return;

        this._normalizeMousePosition(event);

        // ドロップ先を検出（スロットを優先）
        const intersects = this._getIntersects();
        let dropTarget = null;

        for (const hit of intersects) {
            const obj = this._findInteractiveParent(hit.object);
            if (obj && obj !== this.draggedObject && obj.userData?.type === 'slot') {
                dropTarget = obj;
                break;
            }
        }

        if (this.onDropCallback) {
            this.onDropCallback({
                draggedObject: this.draggedObject,
                dragData: this.draggedObject.userData,
                dropTarget,
                dropTargetData: dropTarget?.userData || null,
                startPosition: this.dragStartPosition.clone()
            });
        }

        // ドラッグ終了コールバック
        if (this.onDragEndCallback) {
            this.onDragEndCallback({
                object: this.draggedObject,
                userData: this.draggedObject.userData,
                dropped: !!dropTarget
            });
        }

        // 状態リセット
        this.isDragging = false;
        this.draggedObject = null;
        this.canvas.style.cursor = 'default';
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

        this.interactiveObjects = [];
        this.onClickCallback = null;
        this.onHoverCallback = null;
        this.onDragStartCallback = null;
        this.onDragEndCallback = null;
        this.onDropCallback = null;
        this.isDragging = false;
        this.draggedObject = null;
    }
}

export default InteractionHandler;
