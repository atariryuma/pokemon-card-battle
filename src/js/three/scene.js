/**
 * THREE.JS SCENE MANAGER
 *
 * ポケモンカードゲーム用の3Dシーン管理（唯一の3Dレンダラー）
 * - Scene、Camera、Renderer の設定
 * - カメラ角度・距離の一元管理
 * - DOM (#game-board) はイベント処理のみ、視覚的3DはThree.js
 */

import * as THREE from 'three';

export class ThreeScene {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;

        // 設定値 - カードゲーム俯瞰ビュー
        // ベストプラクティス: FOV 35-45度、プレイヤー側60%:相手側40%の比率
        // 参考: https://www.osd.net/blog/web-development/3d-board-game-in-a-browser-using-webgl-and-three-js-part-1/
        // 参考: https://gdkeys.com/the-card-games-ui-design-of-fairtravel-battle/
        this.config = {
            cameraAngle: 50,        // 度（50度 - 斜め上から俯瞰）
            cameraDistance: 800,    // カメラ距離（全体が見えるように調整）
            cameraOffsetY: 20,      // プレイヤー側を大きく見せるためのオフセット
            playmatSize: 679,       // プレイマットサイズ
            fov: 45,                // 視野角（45度 - バランス良く）
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

        console.log('🎮 Three.js Scene initialized');
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
        const offsetY = this.config.cameraOffsetY || 0;

        // Y軸（高さ）とZ軸（奥行き）を計算
        this.camera.position.set(
            0,                              // X: 中央
            Math.sin(radians) * distance,   // Y: 高さ
            Math.cos(radians) * distance    // Z: 奥行き（プレイヤー側に近い）
        );

        // 少し相手側にオフセットして見ることでプレイヤー側を大きく表示
        // （60:40の比率を実現）
        this.camera.lookAt(0, 0, -offsetY);
    }

    /**
     * レンダラー作成
     */
    _createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,  // 透明背景
        });

        this.renderer.setSize(
            this.container.clientWidth,
            this.container.clientHeight
        );
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // DOM に追加
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.pointerEvents = 'auto';
        this.renderer.domElement.id = 'three-canvas';

        this.container.appendChild(this.renderer.domElement);
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
     * アニメーションループ開始
     */
    start() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.renderer.render(this.scene, this.camera);
        };
        animate();
        console.log('🎬 Three.js animation loop started');
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
}

export default ThreeScene;
