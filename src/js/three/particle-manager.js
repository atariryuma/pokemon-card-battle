/**
 * ADVANCED PARTICLE MANAGER
 * 
 * GPU最適化インスタンシングパーティクルシステム
 * - THREE.InstancedMesh を使用した超高速レンダリング
 * - タイプ別攻撃エフェクト (炎、水、雷、草、等)
 * - ダメージエフェクト (衝撃波、破片)
 * - 環境エフェクト (オーラ、グロー)
 * - オブジェクトプール (メモリ最適化)
 */

import * as THREE from 'three';

/**
 * インスタンシングパーティクルエミッター
 * GPU上で数千のパーティクルを高速レンダリング
 */
class InstancedParticleEmitter {
    constructor(options = {}) {
        this.options = {
            maxParticles: options.maxParticles || 2000,
            particleSize: options.particleSize || 0.3,
            lifetime: options.lifetime || 2.0,
            color: options.color || new THREE.Color(1, 1, 1),
            startVelocity: options.startVelocity || new THREE.Vector3(0, 2, 0),
            velocityRandomness: options.velocityRandomness || 1.0,
            gravity: options.gravity !== undefined ? options.gravity : -9.8,
            fadeIn: options.fadeIn || 0.1,
            fadeOut: options.fadeOut || 0.5,
            emissive: options.emissive || new THREE.Color(0, 0, 0),
            emissiveIntensity: options.emissiveIntensity || 1.0
        };

        // パーティクルデータ配列
        this.particles = [];
        this.unusedParticles = [];

        // InstancedMesh作成
        this._createInstancedMesh();

        this.time = 0;
    }

    _createInstancedMesh() {
        // シンプルなビルボードジオメトリ
        const geometry = new THREE.PlaneGeometry(
            this.options.particleSize,
            this.options.particleSize
        );

        // マテリアル（透明、加算ブレンディング）
        const material = new THREE.MeshBasicMaterial({
            color: this.options.color,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            emissive: this.options.emissive,
            emissiveIntensity: this.options.emissiveIntensity
        });

        // InstancedMesh作成
        this.mesh = new THREE.InstancedMesh(
            geometry,
            material,
            this.options.maxParticles
        );

        // すべてのインスタンスを初期化（非表示）
        const matrix = new THREE.Matrix4();
        matrix.scale(new THREE.Vector3(0, 0, 0)); // 非表示
        for (let i = 0; i < this.options.maxParticles; i++) {
            this.mesh.setMatrixAt(i, matrix);
            this.unusedParticles.push(i);
        }
        this.mesh.instanceMatrix.needsUpdate = true;

        // フラスタムカリング無効化（パーティクルが動くため）
        this.mesh.frustumCulled = false;
    }

    emit(position, count = 1, direction = null) {
        const actualCount = Math.min(count, this.unusedParticles.length);

        for (let i = 0; i < actualCount; i++) {
            const index = this.unusedParticles.pop();
            if (index === undefined) break;

            // ランダムな速度
            const velocity = direction ? direction.clone() : this.options.startVelocity.clone();
            velocity.x += (Math.random() - 0.5) * this.options.velocityRandomness;
            velocity.y += (Math.random() - 0.5) * this.options.velocityRandomness;
            velocity.z += (Math.random() - 0.5) * this.options.velocityRandomness;

            this.particles.push({
                index,
                position: position.clone(),
                velocity,
                age: 0,
                lifetime: this.options.lifetime * (0.8 + Math.random() * 0.4),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 3
            });
        }
    }

    update(deltaTime, camera) {
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);

        this.time += deltaTime;

        // 各パーティクルを更新
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.age += deltaTime;

            // 寿命チェック
            if (particle.age >= particle.lifetime) {
                this.unusedParticles.push(particle.index);
                this.particles.splice(i, 1);

                // 非表示にする
                matrix.scale(new THREE.Vector3(0, 0, 0));
                this.mesh.setMatrixAt(particle.index, matrix);
                continue;
            }

            // 物理更新
            particle.velocity.y += this.options.gravity * deltaTime;
            particle.position.add(
                particle.velocity.clone().multiplyScalar(deltaTime)
            );
            particle.rotation += particle.rotationSpeed * deltaTime;

            // フェード計算
            const lifeRatio = particle.age / particle.lifetime;
            let alpha = 1.0;

            if (lifeRatio < this.options.fadeIn) {
                alpha = lifeRatio / this.options.fadeIn;
            } else if (lifeRatio > (1 - this.options.fadeOut)) {
                alpha = (1 - lifeRatio) / this.options.fadeOut;
            }

            // ビルボード：常にカメラを向く
            if (camera) {
                quaternion.copy(camera.quaternion);
            }

            // 回転を追加
            const rotQuat = new THREE.Quaternion();
            rotQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), particle.rotation);
            quaternion.multiply(rotQuat);

            // スケール（フェード）
            const s = alpha;
            scale.set(s, s, s);

            // マトリックス作成
            position.copy(particle.position);
            matrix.compose(position, quaternion, scale);
            this.mesh.setMatrixAt(particle.index, matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    getMesh() {
        return this.mesh;
    }

    clear() {
        // すべてのパーティクルをリセット
        const matrix = new THREE.Matrix4();
        matrix.scale(new THREE.Vector3(0, 0, 0));

        for (const particle of this.particles) {
            this.mesh.setMatrixAt(particle.index, matrix);
            this.unusedParticles.push(particle.index);
        }

        this.particles = [];
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.clear();
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}

/**
 * パーティクルマネージャー
 * 複数のエミッターを管理
 */
class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.emitters = new Map();
        this.activeEffects = [];

        // タイプ別エフェクト設定
        this.typeConfigs = {
            fire: {
                color: new THREE.Color(1.0, 0.3, 0.0),
                emissive: new THREE.Color(1.0, 0.5, 0.0),
                emissiveIntensity: 2.0,
                startVelocity: new THREE.Vector3(0, 3, 0),
                velocityRandomness: 2.0,
                particleSize: 0.4,
                lifetime: 1.5,
                gravity: 2.0
            },
            water: {
                color: new THREE.Color(0.0, 0.5, 1.0),
                emissive: new THREE.Color(0.3, 0.7, 1.0),
                emissiveIntensity: 1.5,
                startVelocity: new THREE.Vector3(0, 2, 0),
                velocityRandomness: 1.5,
                particleSize: 0.3,
                lifetime: 2.0,
                gravity: -5.0
            },
            lightning: {
                color: new THREE.Color(1.0, 1.0, 0.5),
                emissive: new THREE.Color(1.0, 1.0, 0.0),
                emissiveIntensity: 3.0,
                startVelocity: new THREE.Vector3(0, 4, 0),
                velocityRandomness: 3.0,
                particleSize: 0.5,
                lifetime: 0.8,
                gravity: 0
            },
            grass: {
                color: new THREE.Color(0.2, 1.0, 0.2),
                emissive: new THREE.Color(0.5, 1.0, 0.3),
                emissiveIntensity: 1.8,
                startVelocity: new THREE.Vector3(0, 2.5, 0),
                velocityRandomness: 1.8,
                particleSize: 0.35,
                lifetime: 1.8,
                gravity: -3.0
            },
            psychic: {
                color: new THREE.Color(0.8, 0.2, 0.8),
                emissive: new THREE.Color(1.0, 0.0, 1.0),
                emissiveIntensity: 2.5,
                startVelocity: new THREE.Vector3(0, 1.5, 0),
                velocityRandomness: 2.5,
                particleSize: 0.4,
                lifetime: 2.5,
                gravity: -1.0
            },
            fighting: {
                color: new THREE.Color(0.8, 0.3, 0.1),
                emissive: new THREE.Color(1.0, 0.4, 0.0),
                emissiveIntensity: 2.0,
                startVelocity: new THREE.Vector3(0, 3, 0),
                velocityRandomness: 2.0,
                particleSize: 0.35,
                lifetime: 1.2,
                gravity: -8.0
            },
            dark: {
                color: new THREE.Color(0.2, 0.1, 0.3),
                emissive: new THREE.Color(0.4, 0.2, 0.6),
                emissiveIntensity: 2.0,
                startVelocity: new THREE.Vector3(0, 1, 0),
                velocityRandomness: 2.0,
                particleSize: 0.5,
                lifetime: 2.0,
                gravity: 0
            },
            metal: {
                color: new THREE.Color(0.7, 0.7, 0.8),
                emissive: new THREE.Color(0.9, 0.9, 1.0),
                emissiveIntensity: 1.5,
                startVelocity: new THREE.Vector3(0, 2, 0),
                velocityRandomness: 1.5,
                particleSize: 0.25,
                lifetime: 1.5,
                gravity: -10.0
            },
            dragon: {
                color: new THREE.Color(0.5, 0.2, 0.8),
                emissive: new THREE.Color(0.8, 0.3, 1.0),
                emissiveIntensity: 2.5,
                startVelocity: new THREE.Vector3(0, 4, 0),
                velocityRandomness: 2.5,
                particleSize: 0.6,
                lifetime: 2.0,
                gravity: -2.0
            },
            fairy: {
                color: new THREE.Color(1.0, 0.7, 0.9),
                emissive: new THREE.Color(1.0, 0.8, 1.0),
                emissiveIntensity: 2.0,
                startVelocity: new THREE.Vector3(0, 1.5, 0),
                velocityRandomness: 2.0,
                particleSize: 0.3,
                lifetime: 2.5,
                gravity: -1.0
            },
            normal: {
                color: new THREE.Color(0.8, 0.8, 0.8),
                emissive: new THREE.Color(1.0, 1.0, 1.0),
                emissiveIntensity: 1.0,
                startVelocity: new THREE.Vector3(0, 2, 0),
                velocityRandomness: 1.5,
                particleSize: 0.3,
                lifetime: 1.5,
                gravity: -5.0
            }
        };
    }

    // タイプ別攻撃エフェクトを生成
    createTypeAttackEffect(type, position, target) {
        const config = this.typeConfigs[type.toLowerCase()] || this.typeConfigs.normal;

        // エミッター作成
        const emitter = new InstancedParticleEmitter({
            maxParticles: 500,
            ...config
        });

        this.scene.add(emitter.getMesh());

        // 方向ベクトル計算
        let direction = null;
        if (target) {
            direction = new THREE.Vector3()
                .subVectors(target, position)
                .normalize()
                .multiplyScalar(3);
        }

        // パーティクルを放出
        emitter.emit(position, 100, direction);

        this.activeEffects.push({
            emitter,
            duration: config.lifetime + 0.5,
            time: 0
        });
    }

    // ダメージエフェクト
    createDamageEffect(position, intensity = 1.0) {
        const emitter = new InstancedParticleEmitter({
            maxParticles: 300,
            color: new THREE.Color(1.0, 0.2, 0.0),
            emissive: new THREE.Color(1.0, 0.5, 0.0),
            emissiveIntensity: 3.0,
            startVelocity: new THREE.Vector3(0, 3, 0),
            velocityRandomness: 4.0 * intensity,
            particleSize: 0.4,
            lifetime: 1.0,
            gravity: -5.0
        });

        this.scene.add(emitter.getMesh());
        emitter.emit(position, Math.floor(50 * intensity));

        this.activeEffects.push({
            emitter,
            duration: 1.5,
            time: 0
        });
    }

    // 進化エフェクト
    createEvolveEffect(position) {
        const emitter = new InstancedParticleEmitter({
            maxParticles: 800,
            color: new THREE.Color(0.2, 0.8, 1.0),
            emissive: new THREE.Color(0.5, 1.0, 1.0),
            emissiveIntensity: 3.0,
            startVelocity: new THREE.Vector3(0, 2, 0),
            velocityRandomness: 2.0,
            particleSize: 0.3,
            lifetime: 3.0,
            gravity: -2.0,
            fadeIn: 0.2,
            fadeOut: 0.8
        });

        this.scene.add(emitter.getMesh());

        // 螺旋状に放出
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dir = new THREE.Vector3(
                Math.cos(angle) * 2,
                3,
                Math.sin(angle) * 2
            );
            emitter.emit(position, 30, dir);
        }

        this.activeEffects.push({
            emitter,
            duration: 3.5,
            time: 0
        });
    }

    // 勝利エフェクト
    createVictoryEffect(position) {
        const emitter = new InstancedParticleEmitter({
            maxParticles: 1000,
            color: new THREE.Color(1.0, 0.8, 0.0),
            emissive: new THREE.Color(1.0, 1.0, 0.5),
            emissiveIntensity: 4.0,
            startVelocity: new THREE.Vector3(0, 5, 0),
            velocityRandomness: 3.0,
            particleSize: 0.5,
            lifetime: 3.0,
            gravity: -3.0,
            fadeIn: 0.1,
            fadeOut: 0.7
        });

        this.scene.add(emitter.getMesh());

        // 爆発的に放出
        emitter.emit(position, 200);

        this.activeEffects.push({
            emitter,
            duration: 3.5,
            time: 0
        });
    }

    // 毎フレーム更新
    update(deltaTime, camera) {
        // 各エフェクトを更新
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.time += deltaTime;

            // エミッター更新
            effect.emitter.update(deltaTime, camera);

            // 期限切れのエフェクトを削除
            if (effect.time >= effect.duration) {
                this.scene.remove(effect.emitter.getMesh());
                effect.emitter.dispose();
                this.activeEffects.splice(i, 1);
            }
        }
    }

    // すべてのエフェクトをクリア
    clear() {
        for (const effect of this.activeEffects) {
            this.scene.remove(effect.emitter.getMesh());
            effect.emitter.dispose();
        }
        this.activeEffects = [];
    }

    // クリーンアップ
    dispose() {
        this.clear();
        this.emitters.clear();
    }
}

export default ParticleManager;
