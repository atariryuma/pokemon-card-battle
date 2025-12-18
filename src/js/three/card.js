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

        // 呼吸アニメーション用
        this.breathingEnabled = false;
        this.breathingPhase = Math.random() * Math.PI * 2; // ランダムな初期位相
        this.breathingSpeed = 0.8 + Math.random() * 0.4;   // 0.8〜1.2の速度バリエーション
        this.breathingAmplitude = 3;  // 上下の振幅

        // エフェクト用
        this.isSelected = false;
        this.isHighlighted = false;
        this.glowColor = null;
        this.glowMesh = null;

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
            this.mesh.userData.baseX = this.mesh.position.x;
            this.mesh.userData.baseZ = this.mesh.position.z;
        }
    }

    /**
     * 呼吸アニメーションを有効化
     */
    enableBreathing(enabled = true) {
        this.breathingEnabled = enabled;
    }

    /**
     * 呼吸アニメーションを更新（毎フレーム呼び出し）
     * @param {number} time - 経過時間（秒）
     */
    updateBreathing(time) {
        if (!this.breathingEnabled || !this.mesh) return;

        const baseY = this.mesh.userData.baseY || 0;

        // サイン波で自然な上下動
        const breathOffset = Math.sin(time * this.breathingSpeed + this.breathingPhase) * this.breathingAmplitude;

        this.mesh.position.y = baseY + breathOffset;
    }

    /**
     * 選択状態を設定（パルスグロー効果）
     */
    setSelected(selected) {
        this.isSelected = selected;
        if (selected) {
            this._createGlowEffect(0x4dd0fd, 1.15); // 青いグロー
        } else {
            this._removeGlowEffect();
        }
    }

    /**
     * ハイライト状態を設定（配置可能スロット用）
     */
    setHighlighted(highlighted) {
        this.isHighlighted = highlighted;
        if (highlighted) {
            this._createGlowEffect(0x22c55e, 1.08); // 緑のグロー
        } else if (!this.isSelected) {
            this._removeGlowEffect();
        }
    }

    /**
     * タイプ別グロー効果を設定
     */
    setTypeGlow(type) {
        const typeColors = {
            fire: 0xff6b35,
            water: 0x4fc3f7,
            grass: 0x66bb6a,
            lightning: 0xffeb3b,
            psychic: 0x9c27b0,
            fighting: 0xff8844,
            darkness: 0x424242,
            metal: 0x607d8b,
            fairy: 0xffaaff,
            dragon: 0x4444ff,
            colorless: 0x9e9e9e,
        };
        const color = typeColors[type?.toLowerCase()] || 0xffffff;
        this._createGlowEffect(color, 1.1);
        this.glowColor = color;
    }

    /**
     * グロー効果を作成
     */
    _createGlowEffect(color, scale) {
        this._removeGlowEffect();

        if (!this.mesh) return;

        // グロー用のメッシュを作成（少し大きいカード）
        const { width, height, depth } = this.options;
        const glowGeometry = new THREE.BoxGeometry(
            width * scale,
            height * scale,
            depth * 2
        );
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide,
        });

        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glowMesh.position.copy(this.mesh.position);
        this.glowMesh.rotation.copy(this.mesh.rotation);

        // 親に追加（シーンに直接）
        if (this.mesh.parent) {
            this.mesh.parent.add(this.glowMesh);
        }
    }

    /**
     * グロー効果を削除
     */
    _removeGlowEffect() {
        if (this.glowMesh) {
            if (this.glowMesh.parent) {
                this.glowMesh.parent.remove(this.glowMesh);
            }
            this.glowMesh.geometry.dispose();
            this.glowMesh.material.dispose();
            this.glowMesh = null;
        }
        this.glowColor = null;
    }

    /**
     * グロー効果を更新（パルス用）
     * @param {number} time - 経過時間（秒）
     */
    updateGlow(time) {
        if (!this.glowMesh || !this.mesh) return;

        // パルス効果（選択時のみ）
        if (this.isSelected) {
            const pulse = 0.2 + Math.sin(time * 3) * 0.1;
            this.glowMesh.material.opacity = pulse;
        }

        // 位置と回転を同期
        this.glowMesh.position.copy(this.mesh.position);
        this.glowMesh.rotation.copy(this.mesh.rotation);
    }

    // ==========================================
    // 戦闘アニメーション
    // ==========================================

    /**
     * 攻撃アニメーション（前方に移動して戻る）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateAttack(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startZ = this.mesh.position.z;
            const startScale = this.mesh.scale.x;
            const attackDistance = 40;
            const startTime = performance.now();

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング（前進→戻り）
                let factor;
                if (progress < 0.3) {
                    factor = progress / 0.3;
                } else if (progress < 0.6) {
                    factor = 1;
                } else {
                    factor = 1 - (progress - 0.6) / 0.4;
                }

                this.mesh.position.z = startZ - attackDistance * factor;
                const scale = startScale + 0.1 * factor;
                this.mesh.scale.set(scale, scale, scale);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.position.z = startZ;
                    this.mesh.scale.set(startScale, startScale, startScale);
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * ダメージシェイクアニメーション
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @param {number} intensity - シェイク強度
     * @returns {Promise}
     */
    animateDamageShake(duration = 500, intensity = 8) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startX = this.mesh.position.x;
            const startTime = performance.now();

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // 減衰するシェイク
                const decay = 1 - progress;
                const shake = Math.sin(progress * Math.PI * 10) * intensity * decay;
                this.mesh.position.x = startX + shake;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.position.x = startX;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * ノックアウトアニメーション（回転しながら消える）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateKnockout(duration = 800) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startScale = this.mesh.scale.x;
            const startRotation = this.mesh.rotation.z;
            const startTime = performance.now();

            // マテリアルの透明度を有効化
            this.mesh.material.forEach(m => {
                m.transparent = true;
            });

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング（加速）
                const eased = progress * progress;

                // スケールダウン、回転、フェードアウト
                const scale = startScale * (1 - eased * 0.5);
                this.mesh.scale.set(scale, scale, scale);
                this.mesh.rotation.z = startRotation + eased * Math.PI * 0.5;

                this.mesh.material.forEach(m => {
                    m.opacity = 1 - eased;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * HP減少フラッシュ（赤く点滅）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateHPFlash(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const originalColors = this.mesh.material.map(m => m.color.getHex());

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // 赤く点滅
                const flash = Math.sin(progress * Math.PI * 4);
                const red = flash > 0 ? 1 : 0.5;

                this.mesh.material.forEach((m, i) => {
                    if (i === 4 || i === 5) { // 前面と背面のみ
                        m.color.setRGB(red, 0.3, 0.3);
                    }
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // 元の色に戻す
                    this.mesh.material.forEach((m, i) => {
                        m.color.setHex(originalColors[i]);
                    });
                    resolve();
                }
            };

            animate();
        });
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
        this._removeGlowEffect();
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
