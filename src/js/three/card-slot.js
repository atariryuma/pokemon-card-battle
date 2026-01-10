/**
 * THREE.JS CARD SLOT
 * 
 * カード配置スロット（透明な Plane）
 * - クリック可能な領域
 * - ホバー時のハイライト
 */

import * as THREE from 'three';

export class CardSlot {
    constructor(options = {}) {
        this.options = {
            width: 60,
            height: 84,
            zone: 'bench',
            owner: 'player',
            index: 0,
            ...options
        };

        this.mesh = null;
        this.isHighlighted = false;
    }

    /**
     * スロットを作成
     */
    create() {
        const { width, height, zone, owner, index } = this.options;

        // ジオメトリ
        const geometry = new THREE.PlaneGeometry(width, height);

        // マテリアル（半透明、ホバー時に可視化）
        // ✅ デバッグ: 不透明度を上げて視覚的に確認可能にする
        this.normalMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.3,  // 0.1 → 0.3（視認性向上）
            side: THREE.DoubleSide,
        });

        this.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd44,
            transparent: true,
            opacity: 0.6,  // 0.4 → 0.6（視認性向上）
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.Mesh(geometry, this.normalMaterial);

        // 水平に配置
        this.mesh.rotation.x = -Math.PI / 2;

        // ユーザーデータ
        this.mesh.userData = {
            type: 'slot',
            zone,
            owner,
            index,
            isInteractive: true,
        };

        return this.mesh;
    }

    /**
     * 位置設定
     */
    setPosition(x, y, z) {
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
        }
    }

    /**
     * 相手側に向ける（Z軸で180度回転）
     */
    flipForOpponent() {
        if (this.mesh) {
            this.mesh.rotation.z = Math.PI;
        }
    }

    /**
     * ハイライト切り替え
     */
    setHighlighted(highlighted) {
        if (this.mesh) {
            this.isHighlighted = highlighted;
            this.mesh.material = highlighted
                ? this.highlightMaterial
                : this.normalMaterial;
        }
    }

    /**
     * ホバー効果
     */
    setHovered(isHovered) {
        if (this.mesh) {
            // ✅ デバッグ: ホバー状態をログ
            console.log(`🎯 CardSlot.setHovered: ${isHovered}`, this.options);

            // ✅ ハイライト中はホバー効果をスキップ
            if (this.isHighlighted) {
                return;
            }

            // ✅ normalMaterialの不透明度のみ変更（視認性向上版）
            const opacity = isHovered ? 0.5 : 0.3;  // 0.3/0.1 → 0.5/0.3
            this.normalMaterial.opacity = opacity;

            // ✅ 現在のマテリアルがnormalMaterialの場合のみ更新
            if (this.mesh.material === this.normalMaterial) {
                this.mesh.material.needsUpdate = true;
            }
        }
    }

    /**
     * メッシュ取得
     */
    getMesh() {
        return this.mesh;
    }

    /**
     * クリーンアップ
     */
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.normalMaterial.dispose();
            this.highlightMaterial.dispose();
        }
    }
}

export default CardSlot;
