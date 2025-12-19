/**
 * THREE.JS PLAYMAT
 * 
 * プレイマット（ゲームボード）の3D表現
 * - テクスチャ付きの Plane
 * - 座標系のマッピング
 */

import * as THREE from 'three';

export class Playmat {
    constructor(scene, textureUrl) {
        this.scene = scene;
        this.textureUrl = textureUrl;
        this.mesh = null;

        // プレイマットサイズ（Three.js単位）
        this.size = 600;  // 調整可能

        this._create();
    }

    /**
     * プレイマット作成
     */
    async _create() {
        const loader = new THREE.TextureLoader();

        try {
            const texture = await new Promise((resolve, reject) => {
                loader.load(
                    this.textureUrl,
                    resolve,
                    undefined,
                    reject
                );
            });

            // テクスチャ設定
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 16;

            // マテリアル
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.FrontSide,
            });

            // ジオメトリ（正方形の Plane）
            const geometry = new THREE.PlaneGeometry(this.size, this.size);

            // メッシュ作成
            this.mesh = new THREE.Mesh(geometry, material);

            // 水平に配置（Y軸回りに90度回転して地面に）
            this.mesh.rotation.x = -Math.PI / 2;
            this.mesh.position.y = 0;

            // レイキャスト用のユーザーデータ
            this.mesh.userData = {
                type: 'playmat',
                isInteractive: false,  // プレイマット自体はクリック対象外
            };

            this.scene.add(this.mesh);
        } catch (error) {
            console.error('❌ Failed to load playmat texture:', error);
            // フォールバック：単色プレイマット
            this._createFallback();
        }
    }

    /**
     * フォールバック（テクスチャ読み込み失敗時）
     */
    _createFallback() {
        const material = new THREE.MeshStandardMaterial({
            color: 0x2d4a2d,  // 緑系のマット色
            side: THREE.FrontSide,
        });

        const geometry = new THREE.PlaneGeometry(this.size, this.size);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;

        this.scene.add(this.mesh);
        console.log('🎴 Playmat fallback created (no texture)');
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
            if (this.mesh.material.map) {
                this.mesh.material.map.dispose();
            }
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}

export default Playmat;
