/**
 * CAMERA DIRECTOR
 * 
 * シネマティックカメラシステム
 * - カメラアニメーション (ズーム、パン、回転)
 * - フォーカスシステム
 * - カメラシェイク
 * - カットシーンモード
 */

import * as THREE from 'three';
import { gsap } from 'gsap';

export class CameraDirector {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;

        // 元のカメラ位置を保存
        this.basePosition = camera.position.clone();
        this.baseRotation = camera.rotation.clone();
        this.baseFOV = camera.fov;

        // アニメーション状態
        this.isAnimating = false;
        this.currentTween = null;

        // カメラシェイク用
        this.shakeIntensity = 0;
        this.shakeDecay = 0.95;
    }

    /**
     * カメラを特定の位置にズーム
     */
    zoomTo(target, duration = 1.0, options = {}) {
        if (this.currentTween) {
            this.currentTween.kill();
        }

        this.isAnimating = true;

        const targetPos = target.clone();
        const distance = options.distance || 100;

        // ターゲットに向かう方向ベクトル
        const direction = new THREE.Vector3()
            .subVectors(this.camera.position, targetPos)
            .normalize();

        const newPosition = targetPos.clone().add(direction.multiplyScalar(distance));

        this.currentTween = gsap.to(this.camera.position, {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z,
            duration: duration,
            ease: options.ease || 'power2.inOut',
            onUpdate: () => {
                this.camera.lookAt(targetPos);
            },
            onComplete: () => {
                this.isAnimating = false;
                if (options.onComplete) options.onComplete();
            }
        });

        return this.currentTween;
    }

    /**
     * カメラを元の位置に戻す
     */
    resetCamera(duration = 1.0) {
        if (this.currentTween) {
            this.currentTween.kill();
        }

        this.isAnimating = true;

        this.currentTween = gsap.to(this.camera.position, {
            x: this.basePosition.x,
            y: this.basePosition.y,
            z: this.basePosition.z,
            duration: duration,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.camera.lookAt(0, 0, 0);
            },
            onComplete: () => {
                this.isAnimating = false;
            }
        });

        // FOVもリセット
        gsap.to(this.camera, {
            fov: this.baseFOV,
            duration: duration,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            }
        });

        return this.currentTween;
    }

    /**
     * FOVアニメーション (ドリーズーム効果)
     */
    animateFOV(targetFOV, duration = 0.5) {
        return gsap.to(this.camera, {
            fov: targetFOV,
            duration: duration,
            ease: 'power2.out',
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            },
            onComplete: () => {
                // 元に戻す
                gsap.to(this.camera, {
                    fov: this.baseFOV,
                    duration: duration,
                    delay: 0.2,
                    ease: 'power2.in',
                    onUpdate: () => {
                        this.camera.updateProjectionMatrix();
                    }
                });
            }
        });
    }

    /**
     * カメラシェイク開始
     */
    shake(intensity = 1.0, duration = 0.5) {
        this.shakeIntensity = intensity;

        gsap.to(this, {
            shakeIntensity: 0,
            duration: duration,
            ease: 'power2.out'
        });
    }

    /**
     * カメラシェイク更新 (毎フレーム呼び出し)
     */
    updateShake() {
        if (this.shakeIntensity > 0.01) {
            const offsetX = (Math.random() - 0.5) * this.shakeIntensity * 5;
            const offsetY = (Math.random() - 0.5) * this.shakeIntensity * 5;
            const offsetZ = (Math.random() - 0.5) * this.shakeIntensity * 5;

            this.camera.position.x = this.basePosition.x + offsetX;
            this.camera.position.y = this.basePosition.y + offsetY;
            this.camera.position.z = this.basePosition.z + offsetZ;

            this.shakeIntensity *= this.shakeDecay;
        } else if (this.shakeIntensity > 0) {
            // シェイク終了 - 元の位置に戻す
            this.camera.position.copy(this.basePosition);
            this.shakeIntensity = 0;
        }
    }

    /**
     * カードにフォーカス (攻撃時など)
     */
    focusOnCard(cardPosition, duration = 0.8) {
        const offsetDistance = 80; // カードからの距離
        const targetPos = cardPosition.clone();
        targetPos.z += offsetDistance;
        targetPos.y += 20;

        return this.zoomTo(cardPosition, duration, {
            distance: offsetDistance,
            ease: 'power2.inOut'
        });
    }

    /**
     * 攻撃シーケンス用カメラワーク
     */
    attackSequence(attackerPos, defenderPos) {
        const timeline = gsap.timeline();

        // 1. 攻撃側にフォーカス
        timeline.add(() => {
            this.focusOnCard(attackerPos, 0.4);
        });

        // 2. FOVズーム (インパクト)
        timeline.add(() => {
            this.animateFOV(this.baseFOV - 10, 0.3);
        }, '+=0.4');

        // 3. 防御側にパン
        timeline.add(() => {
            this.focusOnCard(defenderPos, 0.5);
        }, '+=0.5');

        // 4. シェイク (ダメージインパクト)
        timeline.add(() => {
            this.shake(2.0, 0.4);
        }, '+=0.3');

        // 5. カメラリセット
        timeline.add(() => {
            this.resetCamera(0.8);
        }, '+=0.8');

        return timeline;
    }

    /**
     * 進化シーケンス用カメラワーク
     */
    evolveSequence(cardPosition) {
        const timeline = gsap.timeline();

        // カードにズーム
        timeline.add(() => {
            this.focusOnCard(cardPosition, 0.6);
        });

        // 回転アニメーション
        timeline.to(this.camera.position, {
            x: `+=${30}`,
            duration: 2.0,
            ease: 'power1.inOut'
        }, '+=0.2');

        // リセット
        timeline.add(() => {
            this.resetCamera(1.0);
        }, '+=0.5');

        return timeline;
    }

    /**
     * 勝利シ ーケンス用カメラワーク
     */
    victorySequence() {
        const timeline = gsap.timeline();

        // ドラマチックなズームアウト
        timeline.to(this.camera.position, {
            y: `+=${50}`,
            z: `+=${50}`,
            duration: 2.0,
            ease: 'power2.out'
        });

        // ゆっくり回転
        timeline.to(this.camera.rotation, {
            y: `+=${Math.PI / 8}`,
            duration: 3.0,
            ease: 'sine.inOut'
        }, '-=1.5');

        return timeline;
    }

    /**
     * 毎フレーム更新
     */
    update() {
        this.updateShake();
    }

    /**
     * すべてのアニメーションを停止
     */
    stopAll() {
        if (this.currentTween) {
            this.currentTween.kill();
        }
        gsap.killTweensOf(this.camera);
        gsap.killTweensOf(this.camera.position);
        gsap.killTweensOf(this.camera.rotation);
        this.isAnimating = false;
        this.shakeIntensity = 0;
    }

    /**
     * クリーンアップ
     */
    dispose() {
        this.stopAll();
    }
}

export default CameraDirector;
