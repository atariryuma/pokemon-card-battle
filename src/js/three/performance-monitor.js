/**
 * PERFORMANCE MONITOR
 * 
 * パフォーマンスモニタリングと自動品質調整
 * - FPS測定
 * - メモリ使用量追跡
 * - 自動品質調整
 */

export class PerformanceMonitor {
    constructor() {
        this.fps = 60;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsHistory = [];
        this.maxHistoryLength = 60; // 1秒分 (60fps想定)

        // 品質設定
        this.qualityLevel = 'high'; // 'low', 'medium', 'high'
        this.autoAdjust = true;

        // パフォーマンス閾値
        this.thresholds = {
            low: 30,
            medium: 45,
            high: 55
        };

        // 調整履歴 (頻繁な調整を防ぐ)
        this.lastAdjustTime = 0;
        this.adjustCooldown = 5000; // 5秒

        this.stats = {
            drawCalls: 0,
            triangles: 0,
            points: 0,
            lines: 0
        };
    }

    /**
     * フレーム更新
     */
    update(renderer) {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;

        if (deltaTime >= 1000) {
            // 1秒ごとにFPS計算
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.fpsHistory.push(this.fps);

            if (this.fpsHistory.length > this.maxHistoryLength) {
                this.fpsHistory.shift();
            }

            this.frameCount = 0;
            this.lastTime = currentTime;

            // レンダラー統計を更新
            if (renderer && renderer.info) {
                this.stats = {
                    drawCalls: renderer.info.render.calls,
                    triangles: renderer.info.render.triangles,
                    points: renderer.info.render.points,
                    lines: renderer.info.render.lines
                };
            }

            // 自動品質調整
            if (this.autoAdjust) {
                this.checkAndAdjustQuality();
            }
        }

        this.frameCount++;
    }

    /**
     * 平均FPSを取得
     */
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return 60;

        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.fpsHistory.length);
    }

    /**
     * 品質レベルを自動調整
     */
    checkAndAdjustQuality() {
        const now = performance.now();

        // クールダウン中は調整しない
        if (now - this.lastAdjustTime < this.adjustCooldown) {
            return;
        }

        const avgFPS = this.getAverageFPS();
        let newQuality = this.qualityLevel;

        // FPSに基づいて品質調整
        if (avgFPS < this.thresholds.low && this.qualityLevel !== 'low') {
            newQuality = 'low';
        } else if (avgFPS < this.thresholds.medium && this.qualityLevel === 'high') {
            newQuality = 'medium';
        } else if (avgFPS >= this.thresholds.high && this.qualityLevel !== 'high') {
            // 安定して高FPSなら品質を上げる
            if (this.qualityLevel === 'low') {
                newQuality = 'medium';
            } else if (this.qualityLevel === 'medium') {
                newQuality = 'high';
            }
        }

        if (newQuality !== this.qualityLevel) {
            console.log(`🎮 Performance: Quality adjusted ${this.qualityLevel} → ${newQuality} (FPS: ${avgFPS})`);
            this.qualityLevel = newQuality;
            this.lastAdjustTime = now;

            // カスタムイベントを発火
            window.dispatchEvent(new CustomEvent('qualityChanged', {
                detail: { quality: newQuality, fps: avgFPS }
            }));
        }
    }

    /**
     * 品質レベルを手動設定
     */
    setQuality(level) {
        if (['low', 'medium', 'high'].includes(level)) {
            this.qualityLevel = level;
            this.autoAdjust = false;
            console.log(`🎮 Performance: Quality set to ${level} (auto-adjust disabled)`);

            window.dispatchEvent(new CustomEvent('qualityChanged', {
                detail: { quality: level, manual: true }
            }));
        }
    }

    /**
     * 自動調整の有効/無効
     */
    setAutoAdjust(enabled) {
        this.autoAdjust = enabled;
        console.log(`🎮 Performance: Auto-adjust ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 現在の品質設定を取得
     */
    getQuality() {
        return this.qualityLevel;
    }

    /**
     * パフォーマンス統計を取得
     */
    getStats() {
        return {
            fps: this.fps,
            avgFPS: this.getAverageFPS(),
            quality: this.qualityLevel,
            autoAdjust: this.autoAdjust,
            ...this.stats
        };
    }

    /**
     * FPS表示用の値を取得
     */
    getFPS() {
        return this.fps;
    }

    /**
     * UI更新用のパフォーマンスメトリクス
     */
    getMetrics() {
        return {
            fps: this.fps,
            avgFPS: this.getAverageFPS(),
            quality: this.qualityLevel,
            drawCalls: this.stats.drawCalls,
            triangles: this.stats.triangles
        };
    }
}

export default PerformanceMonitor;
