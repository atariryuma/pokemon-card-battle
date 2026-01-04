/**
 * SOUND-MANAGER.JS - 効果音と音楽の管理
 * Howler.jsを使用してゲーム内のサウンドエフェクトとBGMを管理
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
};

class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = {
            master: 0.7,
            sfx: 0.8,
            music: 0.5
        };

        this.sounds = {};
        this.currentMusic = null;

        this.initSounds();
    }

    initSounds() {
        // Howlerが利用可能かチェック
        if (typeof Howl === 'undefined') {
            console.warn('Howler.js is not loaded. Sound will be disabled.');
            this.enabled = false;
            return;
        }

        // 効果音の定義（音声ファイルがない場合でもエラーを無視）
        this.sounds = {
            cardDraw: new Howl({
                src: ['./assets/sounds/card-draw.mp3', './assets/sounds/card-draw.ogg'],
                volume: 0.3 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            cardPlace: new Howl({
                src: ['./assets/sounds/card-place.mp3'],
                volume: 0.4 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            attack: new Howl({
                src: ['./assets/sounds/attack.mp3'],
                volume: 0.6 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            damage: new Howl({
                src: ['./assets/sounds/damage.mp3'],
                volume: 0.5 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            knockout: new Howl({
                src: ['./assets/sounds/knockout.mp3'],
                volume: 0.7 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            victory: new Howl({
                src: ['./assets/sounds/victory.mp3'],
                volume: 0.8 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            click: new Howl({
                src: ['./assets/sounds/click.mp3'],
                volume: 0.2 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            evolve: new Howl({
                src: ['./assets/sounds/evolve.mp3'],
                volume: 0.6 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            }),
            shuffle: new Howl({
                src: ['./assets/sounds/shuffle.mp3'],
                volume: 0.4 * this.volume.master * this.volume.sfx,
                onloaderror: () => {}
            })
        };

        // BGM（音声ファイルがない場合でもエラーを無視）
        this.music = {
            battle: new Howl({
                src: ['./assets/music/battle-theme.mp3'],
                loop: true,
                volume: this.volume.music * this.volume.master,
                onloaderror: () => {}
            }),
            victory: new Howl({
                src: ['./assets/music/victory-theme.mp3'],
                loop: false,
                volume: this.volume.music * this.volume.master,
                onloaderror: () => {}
            })
        };

        console.log('🔊 Sound Manager initialized');
    }

    /**
     * 効果音を再生
     * @param {string} soundName - 再生する効果音の名前
     */
    play(soundName) {
        if (!this.enabled || !this.sounds[soundName]) {
            return;
        }

        try {
            this.sounds[soundName].play();
        } catch (error) {
            console.warn(`Failed to play sound: ${soundName}`, error);
        }
    }

    /**
     * BGMを再生
     * @param {string} musicName - 再生する音楽の名前
     */
    playMusic(musicName) {
        if (!this.enabled || !this.music[musicName]) {
            return;
        }

        try {
            // 既存の音楽を停止
            if (this.currentMusic) {
                this.currentMusic.fade(this.volume.music * this.volume.master, 0, 500);
                setTimeout(() => {
                    if (this.currentMusic) {
                        this.currentMusic.stop();
                    }
                }, 500);
            }

            // 新しい音楽を再生
            this.currentMusic = this.music[musicName];
            this.currentMusic.play();
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
            this.currentMusic.fade(this.volume.music * this.volume.master, 0, 1000);
            setTimeout(() => {
                if (this.currentMusic) {
                    this.currentMusic.stop();
                    this.currentMusic = null;
                }
            }, 1000);
        } catch (error) {
            console.warn('Failed to stop music', error);
        }
    }

    /**
     * 音量を設定
     * @param {string} type - 'master', 'sfx', 'music'
     * @param {number} value - 音量 (0.0 - 1.0)
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
     * サウンドのON/OFFを切り替え
     * @returns {boolean} 新しい有効状態
     */
    toggle() {
        this.enabled = !this.enabled;

        if (!this.enabled) {
            this.stopMusic();
        }

        console.log(`Sound ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }

    /**
     * サウンドが有効かどうか
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled;
    }
}

// シングルトンインスタンスをエクスポート
export const soundManager = new SoundManager();
