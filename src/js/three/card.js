/**
 * THREE.JS CARD
 * 
 * 3Dカードオブジェクト
 * - BoxGeometry で厚みを表現
 * - 前面/背面に異なるテクスチャ
 * - アニメーション対応
 */

import * as THREE from 'three';

// テクスチャキャッシュ
const textureCache = new Map();
const loader = new THREE.TextureLoader();

/**
 * テクスチャを非同期でロード（キャッシュ対応）
 */
async function loadTexture(url) {
    if (textureCache.has(url)) {
        return textureCache.get(url);
    }

    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                textureCache.set(url, texture);
                resolve(texture);
            },
            undefined,
            reject
        );
    });
}

export class Card3D {
    constructor(options = {}) {
        this.options = {
            width: 60,           // カード幅
            height: 84,          // カード高さ（トレーディングカード比率）
            depth: 1,            // カード厚み
            frontTexture: null,  // 前面テクスチャURL
            backTexture: 'assets/images/card_back.png',  // 裏面テクスチャURL
            ...options
        };

        this.mesh = null;
        this.isFlipped = false;  // 裏向きかどうか

        // ユーザーデータ（クリック時の識別用）
        this.userData = {
            type: 'card',
            cardId: options.cardId || null,
            runtimeId: options.runtimeId || null,
            zone: options.zone || null,
            owner: options.owner || null,
            index: options.index || 0,
            isInteractive: true,
        };
    }

    /**
     * カードメッシュを作成
     */
    async create() {
        const { width, height, depth, frontTexture, backTexture } = this.options;

        // ジオメトリ
        const geometry = new THREE.BoxGeometry(width, height, depth);

        // テクスチャをロード
        let frontTex = null;
        let backTex = null;

        try {
            if (frontTexture) {
                frontTex = await loadTexture(frontTexture);
            }
            backTex = await loadTexture(backTexture);
        } catch (error) {
            console.warn('Card texture load failed:', error);
        }

        // マテリアル配列（6面）
        // BoxGeometry の面順序: +X, -X, +Y, -Y, +Z, -Z
        // カードの場合: 左, 右, 上, 下, 前面, 背面
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,  // カードエッジ色
        });

        const frontMaterial = new THREE.MeshStandardMaterial({
            map: frontTex,
            color: frontTex ? 0xffffff : 0x4a4a4a,
        });

        const backMaterial = new THREE.MeshStandardMaterial({
            map: backTex,
            color: backTex ? 0xffffff : 0x2a4a2a,
        });

        const materials = [
            edgeMaterial,   // 右 (+X)
            edgeMaterial,   // 左 (-X)
            edgeMaterial,   // 上 (+Y)
            edgeMaterial,   // 下 (-Y)
            frontMaterial,  // 前面 (+Z) - カード表
            backMaterial,   // 背面 (-Z) - カード裏
        ];

        this.mesh = new THREE.Mesh(geometry, materials);

        // ユーザーデータを設定
        this.mesh.userData = this.userData;

        // 初期位置
        this.mesh.position.set(0, 0, 0);

        return this.mesh;
    }

    /**
     * カードを配置
     */
    setPosition(x, y, z) {
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
        }
    }

    /**
     * カードを回転（度数）
     */
    setRotation(rx, ry, rz) {
        if (this.mesh) {
            this.mesh.rotation.set(
                THREE.MathUtils.degToRad(rx),
                THREE.MathUtils.degToRad(ry),
                THREE.MathUtils.degToRad(rz)
            );
        }
    }

    /**
     * カードを水平に寝かせる（プレイマット上）
     */
    layFlat() {
        if (this.mesh) {
            // X軸で-90度回転して水平に
            this.mesh.rotation.x = -Math.PI / 2;
        }
    }

    /**
     * 相手側に向ける（180度回転）
     */
    flipForOpponent() {
        if (this.mesh) {
            this.mesh.rotation.z = Math.PI;
        }
    }

    /**
     * カードを裏向きにする
     */
    showBack() {
        if (this.mesh) {
            this.isFlipped = true;
            // Y軸で180度回転して裏面を表示
            this.mesh.rotation.y = Math.PI;
        }
    }

    /**
     * カードを表向きにする
     */
    showFront() {
        if (this.mesh) {
            this.isFlipped = false;
            this.mesh.rotation.y = 0;
        }
    }

    /**
     * ホバー効果
     */
    setHovered(isHovered) {
        if (this.mesh) {
            const scale = isHovered ? 1.1 : 1.0;
            this.mesh.scale.set(scale, scale, scale);

            // 少し浮かせる
            const liftY = isHovered ? 10 : 0;
            this.mesh.position.y = this.mesh.userData.baseY + liftY;
        }
    }

    /**
     * ベース位置を保存
     */
    saveBasePosition() {
        if (this.mesh) {
            this.mesh.userData.baseY = this.mesh.position.y;
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
            this.mesh.material.forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        }
    }
}

export default Card3D;
