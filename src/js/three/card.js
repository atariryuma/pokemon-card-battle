/**
 * THREE.JS CARD
 * 
 * 3Dカードオブジェクト（最適化済み）
 * - 共有ジオメトリプール（メモリ効率化）
 * - BoxGeometry で厚みを表現
 * - 前面/背面に異なるテクスチャ
 * - アニメーション対応
 */

import * as THREE from 'three';
import { textureManager } from './texture-manager.js';

// ==========================================
// 共有ジオメトリプール（最適化）
// ==========================================

/**
 * カードジオメトリを共有（同じサイズのカードは同じジオメトリを再利用）
 */
class GeometryPool {
    constructor() {
        this.pool = new Map();
    }

    /**
     * ジオメトリを取得（キャッシュから or 新規作成）
     */
    get(width, height, depth) {
        const key = `${width}_${height}_${depth}`;

        if (!this.pool.has(key)) {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            this.pool.set(key, geometry);
            console.log(`✅ Created shared geometry: ${key}`);
        }

        return this.pool.get(key);
    }

    /**
     * すべてのジオメトリを破棄
     */
    disposeAll() {
        for (const [key, geometry] of this.pool.entries()) {
            geometry.dispose();
            console.log(`🗑️ Geometry disposed: ${key}`);
        }
        this.pool.clear();
    }
}

// シングルトンインスタンス
const geometryPool = new GeometryPool();

// ==========================================
// マテリアルプール（最適化）
// ==========================================

/**
 * エッジマテリアルを共有（カード側面）
 */
const sharedMaterials = {
    edge: new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.1
    })
};

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
        this.breathingAmplitude = 2.5;  // 上下の振幅（業界標準：より微妙に）

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
     * マテリアル配列を安全に取得
     * @returns {THREE.Material[]}
     */
    _getMaterials() {
        if (!this.mesh) return [];
        return Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
    }

    /**
     * カードメッシュを作成（最適化済み）
     */
    async create() {
        const { width, height, depth, frontTexture, backTexture } = this.options;

        // 共有ジオメトリを使用（メモリ効率化）
        const geometry = geometryPool.get(width, height, depth);

        // テクスチャマネージャーでロード（最適化）
        let frontTex = null;
        let backTex = null;

        try {
            if (frontTexture) {
                frontTex = await textureManager.loadOptimized(frontTexture, {
                    anisotropy: 4,
                    encoding: THREE.sRGBEncoding
                });
            }
            backTex = await textureManager.loadOptimized(backTexture, {
                anisotropy: 4,
                encoding: THREE.sRGBEncoding
            });
        } catch (error) {
            console.warn('Card texture load failed:', error);
        }

        // マテリアル作成（前面/背面のみ個別、エッジは共有）
        const frontMaterial = new THREE.MeshStandardMaterial({
            map: frontTex,
            color: frontTex ? 0xffffff : 0x4a4a4a,
            roughness: 0.6,
            metalness: 0.1
        });

        const backMaterial = new THREE.MeshStandardMaterial({
            map: backTex,
            color: backTex ? 0xffffff : 0x2a4a2a,
            roughness: 0.6,
            metalness: 0.1
        });

        // マテリアル配列（エッジは共有マテリアル使用）
        const materials = [
            sharedMaterials.edge,   // 右 (+X)
            sharedMaterials.edge,   // 左 (-X)
            sharedMaterials.edge,   // 上 (+Y)
            sharedMaterials.edge,   // 下 (-Y)
            frontMaterial,          // 前面 (+Z) - カード表
            backMaterial,           // 背面 (-Z) - カード裏
        ];

        this.mesh = new THREE.Mesh(geometry, materials);

        // ユーザーデータを設定
        this.mesh.userData = this.userData;
        this.mesh.userData.hoverLiftY = 0;

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
     * カードを裏向きにする（即座）
     */
    showBack() {
        if (this.mesh) {
            this.isFlipped = true;
            // Y軸で180度回転して裏面を表示
            this.mesh.rotation.y = Math.PI;
        }
    }

    /**
     * カードを表向きにする（即座）
     */
    showFront() {
        if (this.mesh) {
            this.isFlipped = false;
            this.mesh.rotation.y = 0;
        }
    }

    /**
     * カードをアニメーション付きでフリップ（裏→表 または 表→裏）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise} アニメーション完了時に解決
     */
    async flip(duration = 600) {
        if (!this.mesh) return Promise.resolve();

        const startRotation = this.mesh.rotation.y;
        const targetRotation = this.isFlipped ? 0 : Math.PI;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング関数（ease-in-out）
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                this.mesh.rotation.y = startRotation + (targetRotation - startRotation) * eased;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.rotation.y = targetRotation;
                    this.isFlipped = !this.isFlipped;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * ホバー効果
     */
    setHovered(isHovered) {
        if (this.mesh) {
            const scale = isHovered ? 1.2 : 1.0;  // 業界標準：20%拡大
            this.mesh.scale.set(scale, scale, scale);

            // ✅ ホバー時のY軸オフセットをuserDataに保存（呼吸アニメーションと共存）
            this.mesh.userData.hoverLiftY = isHovered ? 20 : 0;  // 業界標準：20px上昇

            // ✅ ホバー時は呼吸を停止（業界標準のベストプラクティス）
            this.breathingEnabled = !isHovered;
        }
    }

    /**
     * ベース位置を保存（呼吸アニメーション・ホバー効果用）
     */
    saveBasePosition() {
        if (this.mesh) {
            this.mesh.userData.baseY = this.mesh.position.y;
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
        // ✅ ホバー時は setHovered() で breathingEnabled が false になる（業界標準）
        if (!this.breathingEnabled || !this.mesh) return;

        const baseY = this.mesh.userData.baseY || 0;

        // サイン波で自然な上下動
        const breathOffset = Math.sin(time * this.breathingSpeed + this.breathingPhase) * this.breathingAmplitude;

        // ✅ ホバー時のリフトオフセットを追加（ホバー効果と共存）
        const hoverLiftY = this.mesh.userData.hoverLiftY || 0;
        this.mesh.position.y = baseY + breathOffset + hoverLiftY;
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
            const materials = this._getMaterials();
            materials.forEach(m => {
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

                materials.forEach(m => {
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
            const materials = this._getMaterials();
            const originalColors = materials.map(m => m.color.getHex());

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // 赤く点滅
                const flash = Math.sin(progress * Math.PI * 4);
                const red = flash > 0 ? 1 : 0.5;

                materials.forEach((m, i) => {
                    if (i === 4 || i === 5) { // 前面と背面のみ
                        m.color.setRGB(red, 0.3, 0.3);
                    }
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // 元の色に戻す
                    materials.forEach((m, i) => {
                        m.color.setHex(originalColors[i]);
                    });
                    resolve();
                }
            };

            animate();
        });
    }

    // ==========================================
    // カード配布・移動アニメーション
    // ==========================================

    /**
     * カード配布アニメーション（上から落ちてくる）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateDealCard(duration = 600) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const targetY = this.mesh.position.y;
            const startY = targetY + 100;
            const startRotation = THREE.MathUtils.degToRad(10);
            const startTime = performance.now();

            // 初期状態
            this.mesh.position.y = startY;
            this.mesh.rotation.z += startRotation;

            // 透明度設定
            this._getMaterials().forEach(m => {
                m.transparent = true;
                m.opacity = 0;
            });

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング（ease-out）
                const eased = 1 - Math.pow(1 - progress, 3);

                this.mesh.position.y = startY + (targetY - startY) * eased;
                this.mesh.rotation.z = startRotation * (1 - eased);
                this._getMaterials().forEach(m => {
                    m.opacity = eased;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.position.y = targetY;
                    this.mesh.rotation.z = 0;
                    this._getMaterials().forEach(m => {
                        m.opacity = 1;
                    });
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * カードドローアニメーション（拡大しながら回転して登場）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateDrawCard(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const targetScale = this.mesh.scale.x;
            const startScale = targetScale * 1.5;
            const startRotation = THREE.MathUtils.degToRad(15);

            // 初期状態
            this.mesh.scale.set(startScale, startScale, startScale);
            this.mesh.rotation.z = startRotation;
            this._getMaterials().forEach(m => {
                m.transparent = true;
                m.opacity = 0;
            });

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング
                const eased = 1 - Math.pow(1 - progress, 2);

                const scale = startScale + (targetScale - startScale) * eased;
                this.mesh.scale.set(scale, scale, scale);
                this.mesh.rotation.z = startRotation * (1 - eased);
                this._getMaterials().forEach(m => {
                    m.opacity = eased;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.scale.set(targetScale, targetScale, targetScale);
                    this.mesh.rotation.z = 0;
                    this._getMaterials().forEach(m => {
                        m.opacity = 1;
                    });
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * カードプレイアニメーション（スケールポップ）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animatePlayCard(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const baseScale = this.mesh.scale.x;

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // バウンスイージング
                let scale;
                if (progress < 0.5) {
                    scale = baseScale + (0.1 * (progress / 0.5));
                } else {
                    scale = baseScale + (0.1 * (1 - (progress - 0.5) / 0.5));
                }
                this.mesh.scale.set(scale, scale, scale);

                // 軽い回転
                this.mesh.rotation.z = Math.sin(progress * Math.PI) * THREE.MathUtils.degToRad(5);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.scale.set(baseScale, baseScale, baseScale);
                    this.mesh.rotation.z = 0;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * カードをアクティブ位置に移動するアニメーション
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateToActive(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const baseScale = this.mesh.scale.x;
            const baseY = this.mesh.position.y;

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // 中盤で拡大、浮上
                let scale, yOffset;
                if (progress < 0.5) {
                    const p = progress / 0.5;
                    scale = baseScale + 0.1 * p;
                    yOffset = -20 * p;
                } else {
                    const p = (progress - 0.5) / 0.5;
                    scale = baseScale + 0.1 * (1 - p);
                    yOffset = -20 * (1 - p);
                }

                this.mesh.scale.set(scale, scale, scale);
                this.mesh.position.y = baseY + yOffset;

                // 透明度の揺らぎ
                const opacity = 0.8 + 0.2 * Math.abs(Math.sin(progress * Math.PI));
                this._getMaterials().forEach(m => {
                    m.transparent = true;
                    m.opacity = opacity;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.scale.set(baseScale, baseScale, baseScale);
                    this.mesh.position.y = baseY;
                    this._getMaterials().forEach(m => {
                        m.opacity = 1;
                    });
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * カードをベンチに移動するアニメーション
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateToBench(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const baseScale = this.mesh.scale.x;
            const baseY = this.mesh.position.y;

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // 縮小しながら下降
                let scale, yOffset;
                if (progress < 0.5) {
                    const p = progress / 0.5;
                    scale = baseScale * (1 - 0.1 * p);
                    yOffset = -10 * p;
                } else {
                    const p = (progress - 0.5) / 0.5;
                    scale = baseScale * (0.9 + 0.1 * p);
                    yOffset = -10 * (1 - p);
                }

                this.mesh.scale.set(scale, scale, scale);
                this.mesh.position.y = baseY + yOffset;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.mesh.scale.set(baseScale, baseScale, baseScale);
                    this.mesh.position.y = baseY;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * 進化アニメーション（グロー + 新カード出現）
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateEvolution(duration = 800) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const baseScale = this.mesh.scale.x;

            // グロー効果を作成
            this._createGlowEffect(0xffffff, 1.3);

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // グロー強度
                if (this.glowMesh) {
                    const glowIntensity = Math.sin(progress * Math.PI);
                    this.glowMesh.material.opacity = glowIntensity * 0.6;
                }

                // スケールと回転
                if (progress < 0.5) {
                    // 前半：縮小しながら回転
                    const p = progress / 0.5;
                    const scale = baseScale * (1 - 0.2 * p);
                    this.mesh.scale.set(scale, scale, scale);
                    this.mesh.rotation.z = THREE.MathUtils.degToRad(-5 * p);
                } else {
                    // 後半：拡大して戻る
                    const p = (progress - 0.5) / 0.5;
                    const scale = baseScale * (0.8 + 0.2 * p);
                    this.mesh.scale.set(scale, scale, scale);
                    this.mesh.rotation.z = THREE.MathUtils.degToRad(-5 * (1 - p));
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this._removeGlowEffect();
                    this.mesh.scale.set(baseScale, baseScale, baseScale);
                    this.mesh.rotation.z = 0;
                    resolve();
                }
            };

            animate();
        });
    }

    // ==========================================
    // エネルギー・エフェクトアニメーション
    // ==========================================

    /**
     * エネルギーアタッチアニメーション
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateEnergyAttach(duration = 600) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const baseScale = this.mesh.scale.x;

            // 一時的なグロー
            this._createGlowEffect(0xf59e0b, 1.1);

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // グローのパルス
                if (this.glowMesh) {
                    const pulse = Math.sin(progress * Math.PI * 2) * 0.3 + 0.4;
                    this.glowMesh.material.opacity = pulse;
                }

                // スケール変化
                const scale = baseScale * (1 + Math.sin(progress * Math.PI) * 0.02);
                this.mesh.scale.set(scale, scale, scale);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this._removeGlowEffect();
                    this.mesh.scale.set(baseScale, baseScale, baseScale);
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * 回復グローアニメーション
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animateHealGlow(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();

            // 緑のグロー
            this._createGlowEffect(0x22c55e, 1.15);

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                if (this.glowMesh) {
                    const intensity = Math.sin(progress * Math.PI);
                    this.glowMesh.material.opacity = intensity * 0.5;
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this._removeGlowEffect();
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * サイドカード取得アニメーション
     * @param {number} duration - アニメーション時間（ミリ秒）
     * @returns {Promise}
     */
    animatePrizeTake(duration = 400) {
        return new Promise((resolve) => {
            if (!this.mesh) {
                resolve();
                return;
            }

            const startTime = performance.now();
            const baseScale = this.mesh.scale.x;

            // 金色のグロー
            this._createGlowEffect(0xfcd34d, 1.2);

            this._getMaterials().forEach(m => {
                m.transparent = true;
            });

            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // スケールアップ、回転、フェードアウト
                const scale = baseScale * (1 + progress * 0.1);
                this.mesh.scale.set(scale, scale, scale);
                this.mesh.rotation.z = THREE.MathUtils.degToRad(5 * progress);

                const opacity = 1 - progress;
                this._getMaterials().forEach(m => {
                    m.opacity = opacity;
                });

                if (this.glowMesh) {
                    this.glowMesh.material.opacity = (1 - progress) * 0.6;
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this._removeGlowEffect();
                    resolve();
                }
            };

            animate();
        });
    }

    // ==========================================
    // 特殊状態アニメーション
    // ==========================================

    /**
     * 毒状態アニメーション（紫のグロー + 色相変化）
     * @param {boolean} enable - 有効/無効
     */
    setConditionPoison(enable) {
        if (enable) {
            this._createGlowEffect(0x9c27b0, 1.08);
            this._conditionPoison = true;
        } else {
            if (this._conditionPoison) {
                this._removeGlowEffect();
                this._conditionPoison = false;
            }
        }
    }

    /**
     * やけど状態アニメーション（オレンジのグロー + スケールパルス）
     * @param {boolean} enable - 有効/無効
     */
    setConditionBurn(enable) {
        if (enable) {
            this._createGlowEffect(0xff5722, 1.1);
            this._conditionBurn = true;
        } else {
            if (this._conditionBurn) {
                this._removeGlowEffect();
                this._conditionBurn = false;
            }
        }
    }

    /**
     * 眠り状態アニメーション
     * @param {boolean} enable - 有効/無効
     */
    setConditionSleep(enable) {
        this._conditionSleep = enable;
    }

    /**
     * まひ状態アニメーション
     * @param {boolean} enable - 有効/無効
     */
    setConditionParalyze(enable) {
        if (enable) {
            this._createGlowEffect(0xffeb3b, 1.05);
            this._conditionParalyze = true;
        } else {
            if (this._conditionParalyze) {
                this._removeGlowEffect();
                this._conditionParalyze = false;
            }
        }
    }

    /**
     * 混乱状態アニメーション
     * @param {boolean} enable - 有効/無効
     */
    setConditionConfuse(enable) {
        this._conditionConfuse = enable;
    }

    /**
     * 特殊状態アニメーションを更新（毎フレーム呼び出し）
     * @param {number} time - 経過時間（秒）
     */
    updateConditionAnimations(time) {
        if (!this.mesh) return;

        // 眠り：ゆっくり上下
        if (this._conditionSleep) {
            const sleepOffset = Math.sin(time * 0.5) * 3;
            const baseY = this.mesh.userData.baseY || 0;
            this.mesh.position.y = baseY + sleepOffset;

            // 透明度も揺らす
            const opacity = 0.6 + Math.sin(time * 0.5) * 0.4;
            this._getMaterials().forEach(m => {
                m.transparent = true;
                m.opacity = opacity;
            });
        }

        // 混乱：回転揺らぎ
        if (this._conditionConfuse) {
            const rotationZ = Math.sin(time * 1.2) * THREE.MathUtils.degToRad(3);
            this.mesh.rotation.z = rotationZ;
        }

        // やけど：スケールパルス
        if (this._conditionBurn && this.glowMesh) {
            const pulse = 0.3 + Math.sin(time * 4) * 0.15;
            this.glowMesh.material.opacity = pulse;

            const scale = 1 + Math.sin(time * 4) * 0.02;
            this.mesh.scale.set(scale, scale, scale);
        }

        // 毒：色相シフト（グロー強度変化）
        if (this._conditionPoison && this.glowMesh) {
            const pulse = 0.2 + Math.sin(time * 2) * 0.15;
            this.glowMesh.material.opacity = pulse;
        }

        // まひ：フラッシュ
        if (this._conditionParalyze && this.glowMesh) {
            const flash = Math.floor(time * 5) % 2 === 0 ? 0.4 : 0.1;
            this.glowMesh.material.opacity = flash;
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
        this._removeGlowEffect();
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this._getMaterials().forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        }
    }
}

export default Card3D;
