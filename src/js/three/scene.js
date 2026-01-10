/**
 * THREE.JS SCENE MANAGER
 *
 * ポケモンカードゲーム用の3Dシーン管理（唯一の3Dレンダラー）
 * - Scene、Camera、Renderer の設定
 * - カメラ角度・距離の一元管理
 * - DOM (#game-board) はイベント処理のみ、視覚的3DはThree.js
 */

import * as THREE from 'three';
import ParticleManager from './particle-manager.js';
import { CameraDirector } from './camera-director.js';
import { PerformanceMonitor } from './performance-monitor.js';

export class ThreeScene {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;

        // 新システム
        this.particleManager = null;
        this.cameraDirector = null;
        this.performanceMonitor = new PerformanceMonitor();

        // 設定値 - カードゲーム俯瞰ビュー
        // ベストプラクティス: FOV 35-45度、プレイヤー側60%:相手側40%の比率
        // 参考: https://www.osd.net/blog/web-development/3d-board-game-in-a-browser-using-webgl-and-three-js-part-1/
        // 参考: https://gdkeys.com/the-card-games-ui-design-of-fairtravel-battle/
        this.config = {
            cameraAngle: 40,        // 45 -> 40 (Slightly shallower angle to flatten the board perspective)
            cameraDistance: 820,    // 800 -> 820
            cameraOffsetZ: -180,    // 80 -> -180 (Negative shifts lookAt point "down" the board, moving board "up" in viewport)
            playmatSize: 679,
            fov: 48,                // 50 -> 48
        };

        this._init();
    }

    /**
     * シーン初期化
     */
    _init() {
        this._createScene();
        this._createCamera();
        this._createRenderer();
        this._createLighting();
        this._handleResize();

        // 新システムを初期化
        this.particleManager = new ParticleManager(this.scene);
        this.cameraDirector = new CameraDirector(this.camera, this.scene);

        console.log('✨ Three.js Scene initialized with advanced effects');
    }

    /**
     * シーン作成
     */
    _createScene() {
        this.scene = new THREE.Scene();

        // グラデーション背景（深い青から紫へ）
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#1a1a2e');      // 深い紫
        gradient.addColorStop(0.5, '#16213e');    // 深い青
        gradient.addColorStop(1, '#0f0f23');      // 暗い紫
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        const backgroundTexture = new THREE.CanvasTexture(canvas);
        this.scene.background = backgroundTexture;

        // テーブル表面を作成（大きな平面）
        this._createTableSurface();
    }

    /**
     * テーブル表面を作成
     */
    _createTableSurface() {
        // テーブル用のジオメトリ（プレイマットより大きい）
        const tableGeometry = new THREE.PlaneGeometry(1200, 1200);

        // 木目調のテーブル色
        const tableMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d2d3a,           // ダークグレー（ゲームマット色）
            roughness: 0.8,
            metalness: 0.1,
        });

        const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
        tableMesh.rotation.x = -Math.PI / 2;  // 水平に置く
        tableMesh.position.y = -2;             // プレイマットより少し下
        tableMesh.receiveShadow = true;

        this.scene.add(tableMesh);
    }

    /**
     * カメラ作成（俯瞰ビュー）
     * 角度と距離はthis.configで一元管理
     */
    _createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(
            this.config.fov,
            aspect,
            0.1,
            2000
        );

        // カメラ位置：設定角度で見下ろす
        const radians = THREE.MathUtils.degToRad(this.config.cameraAngle);
        const distance = this.config.cameraDistance;
        const offsetZ = this.config.cameraOffsetZ || 0;

        // Y軸（高さ）とZ軸（奥行き）を計算
        this.camera.position.set(
            0,                              // X: 中央
            Math.sin(radians) * distance,   // Y: 高さ
            Math.cos(radians) * distance    // Z: 奥行き（プレイヤー側に近い）
        );

        // プレイマットを奥にスライドするため、視点中心をオフセット
        // 負の値で奥側を見る → プレイマットが画面上部に移動し、手前にスペースができる
        this.camera.lookAt(0, 0, offsetZ);
    }

    /**
     * レンダラー作成（最適化済み）
     */
    _createRenderer() {
        // 最適化されたレンダラー設定
        this.renderer = new THREE.WebGLRenderer({
            antialias: window.devicePixelRatio < 2, // 高DPRではアンチエイリアスOFF
            alpha: false, // 背景透過不要（パフォーマンス向上）
            powerPreference: 'high-performance', // GPU優先
            stencil: false, // ステンシルバッファ不要
            depth: true,
            logarithmicDepthBuffer: false // 不要ならOFF
        });

        this.renderer.setSize(
            this.container.clientWidth,
            this.container.clientHeight
        );

        // DPR制限（2以上は不要、メモリとパフォーマンスのバランス）
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // シャドウ設定最適化
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false; // 静的シャドウ（手動更新）

        // DOM に追加
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.pointerEvents = 'auto';
        this.renderer.domElement.id = 'three-canvas';

        this.container.appendChild(this.renderer.domElement);

        console.log('✅ Renderer optimized: DPR=' + this.renderer.getPixelRatio());
    }

    /**
     * ライティング設定
     */
    _createLighting() {
        // 環境光（全体を均一に照らす）
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // ディレクショナルライト（影を作る）
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 500, 200);
        this.scene.add(directionalLight);
    }

    /**
     * リサイズハンドラ
     */
    _handleResize() {
        const resizeObserver = new ResizeObserver(() => {
            if (!this.container) return;

            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(width, height);
        });

        resizeObserver.observe(this.container);
    }

    /**
     * オブジェクトをシーンに追加
     */
    add(object) {
        this.scene.add(object);
    }

    /**
     * オブジェクトをシーンから削除
     */
    remove(object) {
        this.scene.remove(object);
    }

    /**
     * アニメーション更新コールバックを設定
     */
    setUpdateCallback(callback) {
        this.updateCallback = callback;
    }

    /**
     * アニメーションループ開始
     */
    start() {
        const startTime = performance.now();
        let lastTime = startTime;

        const animate = () => {
            this.animationId = requestAnimationFrame(animate);

            const currentTime = performance.now();
            const deltaTime = (currentTime - lastTime) / 1000; // 秒単位
            lastTime = currentTime;

            // 経過時間（秒）
            const time = (currentTime - startTime) / 1000;

            // パーティクルシステム更新
            if (this.particleManager) {
                this.particleManager.update(deltaTime, this.camera);
            }

            // カメラディレクター更新
            if (this.cameraDirector) {
                this.cameraDirector.update();
            }

            // パフォーマンスモニター更新
            if (this.performanceMonitor) {
                this.performanceMonitor.update(this.renderer);
            }

            // 更新コールバックを呼び出し
            if (this.updateCallback) {
                this.updateCallback(time);
            }

            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    /**
     * アニメーションループ停止
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * クリーンアップ
     */
    dispose() {
        this.stop();

        // 新システムのクリーンアップ
        if (this.particleManager) {
            this.particleManager.dispose();
        }
        if (this.cameraDirector) {
            this.cameraDirector.dispose();
        }

        // シーン内のすべてのオブジェクトを破棄
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);

        console.log('🧹 Three.js Scene disposed');
    }

    /**
     * シーンへのアクセサ
     */
    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    getRenderer() {
        return this.renderer;
    }

    getCanvas() {
        return this.renderer.domElement;
    }

    // 新システムへのアクセサ
    getParticleManager() {
        return this.particleManager;
    }

    getCameraDirector() {
        return this.cameraDirector;
    }

    getPerformanceMonitor() {
        return this.performanceMonitor;
    }
}

export default ThreeScene;
