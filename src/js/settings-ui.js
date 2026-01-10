/**
 * SETTINGS UI MODULE
 * 
 * 品質設定とサウンド設定のUIコントロール
 */

import { soundManager } from './sound-manager.js';

export class SettingsUI {
    constructor(scene) {
        this.scene = scene;
        this.performanceMonitor = scene.getPerformanceMonitor();
        this.particleManager = scene.getParticleManager();
        this.settingsPanel = null;
        this.fpsCounter = null;

        this.init();
    }

    init() {
        this.createSettingsPanel();
        this.createFPSCounter();
        this.bindEvents();
        this.updateQualitySettings();
    }

    createSettingsPanel() {
        // 設定パネルを作成
        const panel = document.createElement('div');
        panel.id = 'settings-panel';
        panel.className = 'settings-panel hidden';
        panel.innerHTML = `
            <div class="settings-content">
                <h3 class="settings-title">⚙️ Settings</h3>
                
                <div class="settings-section">
                    <label class="settings-label">Graphics Quality</label>
                    <select id="quality-select" class="settings-select">
                        <option value="low">Low (最適化)</option>
                        <option value="medium">Medium (推奨)</option>
                        <option value="high" selected>High (最高品質)</option>
                    </select>
                </div>

                <div class="settings-section">
                    <label class="settings-label">
                        <input type="checkbox" id="particles-toggle" checked>
                        <span>Particle Effects</span>
                    </label>
                </div>

                <div class="settings-section">
                    <label class="settings-label">
                        <input type="checkbox" id="spatial-audio-toggle" checked>
                        <span>Spatial Audio</span>
                    </label>
                </div>

                <div class="settings-section">
                    <label class="settings-label">
                        <input type="checkbox" id="auto-quality-toggle" checked>
                        <span>Auto Quality Adjust</span>
                    </label>
                </div>

                <div class="settings-section">
                    <label class="settings-label">Master Volume</label>
                    <input type="range" id="volume-master" min="0" max="100" value="70" class="settings-slider">
                    <span id="volume-master-value">70%</span>
                </div>

                <div class="settings-section">
                    <label class="settings-label">SFX Volume</label>
                    <input type="range" id="volume-sfx" min="0" max="100" value="80" class="settings-slider">
                    <span id="volume-sfx-value">80%</span>
                </div>

                <div class="settings-section">
                    <label class="settings-label">Music Volume</label>
                    <input type="range" id="volume-music" min="0" max="100" value="50" class="settings-slider">
                    <span id="volume-music-value">50%</span>
                </div>

                <button id="settings-close" class="settings-btn">Close</button>
            </div>
        `;

        // スタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            .settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(20, 20, 40, 0.98);
                border: 2px solid rgba(100, 100, 255, 0.5);
                border-radius: 16px;
                padding: 24px;
                min-width: 320px;
                max-width: 400px;
                z-index: 10000;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }

            .settings-panel.hidden {
                display: none;
            }

            .settings-title {
                color: white;
                font-size: 24px;
                margin: 0 0 20px 0;
                text-align: center;
                font-weight: 700;
            }

            .settings-section {
                margin-bottom: 16px;
            }

            .settings-label {
                color: #aaa;
                font-size: 14px;
                display: block;
                margin-bottom: 8px;
            }

            .settings-label input[type="checkbox"] {
                margin-right: 8px;
            }

            .settings-select {
                width: 100%;
                padding: 8px;
                background: rgba(40, 40, 60, 0.8);
                border: 1px solid rgba(100, 100, 255, 0.3);
                border-radius: 8px;
                color: white;
                font-size: 14px;
            }

            .settings-slider {
                width: calc(100% - 60px);
                margin-right: 10px;
            }

            .settings-btn {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 8px;
                color: white;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .settings-btn:hover {
                transform: scale(1.05);
            }

            #fps-counter {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: #0f0;
                padding: 8px 12px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 16px;
                z-index: 9999;
                border: 1px solid #0f0;
            }

            #fps-counter.low {
                color: #f00;
                border-color: #f00;
            }

            #fps-counter.medium {
                color: #ff0;
                border-color: #ff0;
            }

            #settings-toggle-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                transition: transform 0.2s;
                z-index: 9998;
            }

            #settings-toggle-btn:hover {
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(panel);
        this.settingsPanel = panel;

        // 設定トグルボタンを作成
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'settings-toggle-btn';
        toggleBtn.innerHTML = '⚙️';
        toggleBtn.title = 'Settings';
        document.body.appendChild(toggleBtn);
    }

    createFPSCounter() {
        const counter = document.createElement('div');
        counter.id = 'fps-counter';
        counter.innerHTML = '<span id="fps-value">60</span> FPS';
        document.body.appendChild(counter);
        this.fpsCounter = counter;

        // FPS更新
        setInterval(() => {
            const fps = this.performanceMonitor.getFPS();
            const fpsValue = document.getElementById('fps-value');
            if (fpsValue) {
                fpsValue.textContent = fps;

                // 色を変更
                counter.className = '';
                if (fps < 30) {
                    counter.classList.add('low');
                } else if (fps < 50) {
                    counter.classList.add('medium');
                }
            }
        }, 500);
    }

    bindEvents() {
        // 設定トグルボタン
        const toggleBtn = document.getElementById('settings-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.settingsPanel.classList.toggle('hidden');
            });
        }

        // 閉じるボタン
        const closeBtn = document.getElementById('settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.settingsPanel.classList.add('hidden');
            });
        }

        // 品質設定
        const qualitySelect = document.getElementById('quality-select');
        if (qualitySelect) {
            qualitySelect.addEventListener('change', (e) => {
                this.performanceMonitor.setQuality(e.target.value);
                this.updateQualitySettings();
            });
        }

        // パーティクルトグル
        const particlesToggle = document.getElementById('particles-toggle');
        if (particlesToggle) {
            particlesToggle.addEventListener('change', (e) => {
                // TODO: パーティクルマネージャーの有効/無効
                console.log('Particles:', e.target.checked);
            });
        }

        // 空間オーディオトグル
        const spatialToggle = document.getElementById('spatial-audio-toggle');
        if (spatialToggle) {
            spatialToggle.addEventListener('change', (e) => {
                soundManager.toggleSpatial();
            });
        }

        // 自動品質調整トグル
        const autoQualityToggle = document.getElementById('auto-quality-toggle');
        if (autoQualityToggle) {
            autoQualityToggle.addEventListener('change', (e) => {
                this.performanceMonitor.setAutoAdjust(e.target.checked);
            });
        }

        // 音量スライダー
        ['master', 'sfx', 'music'].forEach(type => {
            const slider = document.getElementById(`volume-${type}`);
            const valueSpan = document.getElementById(`volume-${type}-value`);

            if (slider && valueSpan) {
                slider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value) / 100;
                    soundManager.setVolume(type, value);
                    valueSpan.textContent = `${e.target.value}%`;
                });
            }
        });

        // 品質変更イベントをリッスン
        window.addEventListener('qualityChanged', (e) => {
            const { quality } = e.detail;
            const qualitySelect = document.getElementById('quality-select');
            if (qualitySelect) {
                qualitySelect.value = quality;
            }
            this.updateQualitySettings();
        });
    }

    updateQualitySettings() {
        const quality = this.performanceMonitor.getQuality();
        console.log(`🎮 Updating quality settings to: ${quality}`);

        // 品質に応じた設定を適用
        // TODO: シーンの品質設定を更新
    }

    show() {
        this.settingsPanel.classList.remove('hidden');
    }

    hide() {
        this.settingsPanel.classList.add('hidden');
    }

    toggle() {
        this.settingsPanel.classList.toggle('hidden');
    }
}

export default SettingsUI;
