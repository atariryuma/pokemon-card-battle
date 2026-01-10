/**
 * ENHANCED SOUND MANAGER
 * 
 * 空間オーディオとタイプ別効果音を持つ次世代サウンドシステム
 * - Howler.js による Web Audio API統合
 * - 3D位置ベースの空間オーディオ
 * - タイプ別攻撃音 (9種類)
 * - ダイナミックBGM
 */

// Howler.jsがHTMLで読み込まれた後、window.Howlとして利用可能
const Howl = window.Howl || class MockHowl {
    constructor() {
        console.warn('Howler.js not loaded - sounds disabled');
    }
    play() { return this; }
    stop() { return this; }
    volume() { return this; }
    fade() { return this; }
    pos() { return this; }
    stereo() { return this; }
};

class EnhancedSoundManager {
    constructor() {
        this.enabled = true;
        this.volume = {
            master: 0.7,
            sfx: 0.8,
            music: 0.5
        };

        this.sounds = {};
        this.music = {};
        this.currentMusic = null;

        // 空間オーディオ設定
        this.spatialEnabled = true;
        this.listenerPosition = { x: 0, y: 0, z: 0 };

        this.initSounds();
    }

    initSounds() {
        console.log('🎵 Enhanced Sound Manager initializing...');

        // Howlerが利用可能かチェック
        if (typeof window.Howl === 'undefined') {
            console.warn('⚠️  Howler.js not loaded - using mock sounds');
            this.enabled = false;
            return;
        }

        try {
            // 🔇 外部サウンドファイルは無効化（404エラー回避）
            // ローカルサウンドファイルが利用可能になったら有効化してください
            console.log('✅ Sound system ready (external sounds disabled)');
            console.log('💡 To enable sounds, add local audio files and update this section');

            this.sounds = {};
            this.sounds.attack = {};
            this.music = {};

            // サウンドシステムは有効だが、ファイルなし
            this.enabled = true;

        } catch (error) {
            console.error('❌ Sound Manager initialization failed:', error);
            this.enabled = false;
        }
    }

    /**
     * 基本効果音を再生
     */
    play(soundName, options = {}) {
        if (!this.enabled || !this.sounds[soundName]) {
            return;
        }

        try {
            const sound = this.sounds[soundName];
            const id = sound.play();

            // 空間オーディオ適用
            if (this.spatialEnabled && options.position) {
                this.applySpatialAudio(sound, id, options.position);
            }

            return id;
        } catch (error) {
            console.warn(`Failed to play sound: ${soundName}`, error);
        }
    }

    /**
     * タイプ別攻撃音を再生
     */
    playAttack(type = 'Colorless', options = {}) {
        if (!this.enabled || !this.sounds.attack || !this.sounds.attack[type]) {
            return;
        }

        try {
            const sound = this.sounds.attack[type];
            const id = sound.play();

            // 空間オーディオ適用
            if (this.spatialEnabled && options.position) {
                this.applySpatialAudio(sound, id, options.position);
            }

            return id;
        } catch (error) {
            console.warn(`Failed to play ${type} attack sound:`, error);
        }
    }

    /**
     * ダメージ音を再生
     */
    playDamage(options = {}) {
        if (!this.enabled || !this.sounds.damage) {
            return;
        }

        try {
            const sound = this.sounds.damage;
            const id = sound.play();

            // 空間オーディオ適用
            if (this.spatialEnabled && options.position) {
                this.applySpatialAudio(sound, id, options.position);
            }

            return id;
        } catch (error) {
            console.warn('Failed to play damage sound:', error);
        }
    }

    /**
     * 空間オーディオを適用
     */
    applySpatialAudio(sound, id, position) {
        if (!sound || !sound.stereo) return;

        // X座標からステレオパンを計算 (-1.0 to 1.0)
        const pan = Math.max(-1, Math.min(1, position.x / 300));

        // ステレオパンを設定
        sound.stereo(pan, id);

        // 距離減衰 (オプション)
        if (position.z) {
            const distance = Math.abs(position.z);
            const attenuation = Math.max(0.3, 1 - (distance / 500));
            sound.volume(sound.volume() * attenuation, id);
        }
    }

    /**
     * BGMを再生
     */
    playMusic(musicName) {
        if (!this.enabled || !this.music[musicName]) {
            return;
        }

        try {
            // 既存の音楽をフェードアウト
            if (this.currentMusic) {
                this.currentMusic.fade(this.volume.music * this.volume.master, 0, 1000);
                setTimeout(() => {
                    if (this.currentMusic) {
                        this.currentMusic.stop();
                    }
                }, 1000);
            }

            // 新しい音楽をフェードイン
            this.currentMusic = this.music[musicName];
            this.currentMusic.volume(0);
            this.currentMusic.play();
            this.currentMusic.fade(0, this.volume.music * this.volume.master, 1500);
        } catch (error) {
            console.warn(`Failed to play music: ${musicName}`, error);
        }
    }

    /**
     * BGMを停止
     */
    stopMusic() {
        if (!this.currentMusic) {
            return;
        }

        try {
            this.currentMusic.fade(this.volume.music * this.volume.master, 0, 1500);
            setTimeout(() => {
                if (this.currentMusic) {
                    this.currentMusic.stop();
                    this.currentMusic = null;
                }
            }, 1500);
        } catch (error) {
            console.warn('Failed to stop music', error);
        }
    }

    /**
     * 音量を設定
     */
    setVolume(type, value) {
        if (!['master', 'sfx', 'music'].includes(type)) {
            console.warn(`Invalid volume type: ${type}`);
            return;
        }

        this.volume[type] = Math.max(0, Math.min(1, value));

        // 効果音の音量を更新
        if (type === 'sfx' || type === 'master') {
            Object.values(this.sounds).forEach(sound => {
                if (sound && sound.volume) {
                    sound.volume(this.volume.sfx * this.volume.master);
                }
            });

            // タイプ別攻撃音も更新
            if (this.sounds.attack) {
                Object.values(this.sounds.attack).forEach(sound => {
                    if (sound && sound.volume) {
                        sound.volume(this.volume.sfx * this.volume.master);
                    }
                });
            }
        }

        // BGMの音量を更新
        if (type === 'music' || type === 'master') {
            Object.values(this.music).forEach(music => {
                if (music && music.volume) {
                    music.volume(this.volume.music * this.volume.master);
                }
            });
        }
    }

    /**
     * サウンドのON/OFF切り替え
     */
    toggle() {
        this.enabled = !this.enabled;

        if (!this.enabled) {
            this.stopMusic();
        }

        console.log(`🔊 Sound ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }

    /**
     * 空間オーディオのON/OFF
     */
    toggleSpatial() {
        this.spatialEnabled = !this.spatialEnabled;
        console.log(`📍 Spatial audio ${this.spatialEnabled ? 'enabled' : 'disabled'}`);
        return this.spatialEnabled;
    }

    /**
     * リスナー位置を更新 (カメラ位置)
     */
    updateListenerPosition(position) {
        this.listenerPosition = position;
    }

    /**
     * サウンドが有効かどうか
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * 空間オーディオが有効かどうか
     */
    isSpatialEnabled() {
        return this.spatialEnabled;
    }
}

// シングルトンインスタンスをエクスポート
export const soundManager = new EnhancedSoundManager();

export default soundManager;
