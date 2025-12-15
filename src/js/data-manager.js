/**
 * データ管理モジュール
 * カードデータの読み込み、画像パス管理、フォールバック機能を提供
 */

import { noop } from './utils.js';

// カードデータ（JSONから動的読み込み）
let cardMasterList = [];

/**
 * カードデータをJSONファイルから読み込む
 * @param {boolean} forceReload - キャッシュを無視して強制的に再読み込みするか
 * @returns {Promise<Array>} カードデータの配列
 */
export async function loadCardsFromJSON(forceReload = false) {
    try {
        const cacheParam = forceReload ? `?_t=${Date.now()}` : '';
        const response = await fetch(`/data/cards-master.json${cacheParam}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawData = await response.json();
        cardMasterList = normalizeCardData(rawData);
        
        // 静音読み込み完了
        noop(`📦 Loaded ${cardMasterList.length} cards from JSON${forceReload ? ' (forced reload)' : ''}`);
        return cardMasterList;
    } catch (error) {
        console.error('❌ Failed to load cards from JSON:', error);
        // フォールバック: 静的データ
        cardMasterList = getStaticFallbackData();
        noop(`🔄 Fallback: Using ${cardMasterList.length} static cards`);
        return cardMasterList;
    }
}

/**
 * 現在のカードリストを取得
 * @returns {Array} カードデータの配列
 */
export function getCardMasterList() {
    return cardMasterList;
}

/**
 * カードデータを強制的に再読み込み
 * @returns {Promise<Array>} 更新されたカードデータの配列
 */
export async function refreshCardData() {
    return await loadCardsFromJSON(true);
}

/**
 * ページフォーカス時のデータ更新チェック
 * エディタから戻ってきた時にデータを自動更新
 */
export function enableAutoRefresh() {
    let isHidden = false;
    
    // ページの表示状態が変わったときの処理
    const handleVisibilityChange = async () => {
        if (document.hidden) {
            isHidden = true;
        } else if (isHidden) {
            // ページが再度表示されたときにデータを更新
            isHidden = false;
            try {
                await refreshCardData();
                noop('🔄 Card data refreshed on page focus');
                // カスタムイベントを発火してUIに更新を通知
                window.dispatchEvent(new CustomEvent('cardDataUpdated', { 
                    detail: { cards: cardMasterList } 
                }));
            } catch (error) {
                console.error('❌ Failed to refresh card data:', error);
            }
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // フォーカス時にも更新チェック
    window.addEventListener('focus', async () => {
        if (isHidden) {
            await handleVisibilityChange();
        }
    });
}

/**
 * カード画像パスを取得（IDベース優先の統一システム）
 * @param {string} cardNameEn - カードの英語名
 * @param {Object} card - カードオブジェクト（タイプ判定用）
 * @returns {string} 画像ファイルのパス
 */
export function getCardImagePath(cardNameEn, card = null) {
    // 引数の妥当性チェック
    if (!card && (!cardNameEn || typeof cardNameEn !== 'string')) {
        console.warn('⚠️ getCardImagePath: invalid inputs:', { cardNameEn, card });
        return 'assets/ui/card_back.webp'; // フォールバック画像
    }
    
    // カードオブジェクトがある場合はそれを優先
    const finalCard = card || { name_en: cardNameEn };
    const finalNameEn = finalCard.name_en || cardNameEn || 'Unknown';
    
    // カードタイプによるフォルダ判定
    const folder = getCardTypeFolder(finalCard.card_type);
    
    // === 優先順位1: image_file が明示的に指定されている場合 ===
    if (finalCard.image_file) {
        return `assets/cards/${folder}/${finalCard.image_file}`;
    }
    
    // === 優先順位2: IDベースの画像パス生成 ===
    if (finalCard.id) {
        const idBasedPath = generateIdBasedImagePath(finalCard, folder);
        return idBasedPath;
    }
    
    // === 優先順位3: エネルギーカード専用ロジック ===
    if (folder === 'energy' || finalNameEn.includes('Energy')) {
        const energyImagePath = generateEnergyImagePath(finalNameEn, finalCard);
        return energyImagePath;
    }
    
    // === 優先順位4: 従来の名前ベースシステム（フォールバック） ===
    const nameBasedPath = generateNameBasedImagePath(finalNameEn, folder, finalCard);
    return nameBasedPath;
}

/**
 * IDベースの画像パスを生成
 * @param {Object} card - カードオブジェクト
 * @param {string} folder - フォルダ名
 * @returns {string} 画像パス
 */
function generateIdBasedImagePath(card, folder) {
    const sanitizedName = sanitizeFileName(card.name_en);
    const id = card.id.padStart(3, '0'); // ID正規化
    
    // IDベース命名規則: {ID}_{folder}_{sanitized_name}.webp
    const idBasedFileName = `${id}_${folder}_${sanitizedName}.webp`;
    
    // 開発モードでのみデバッグ
    if (typeof window !== 'undefined' && window.DEBUG_IMAGE_PATHS) {
        console.debug(`🆔 ID-based path: ${card.name_en} (${card.id}) → ${idBasedFileName}`);
    }
    
    return `assets/cards/${folder}/${idBasedFileName}`;
}

/**
 * エネルギーカード専用の画像パス生成
 * @param {string} nameEn - 英語名
 * @param {Object} card - カードオブジェクト
 * @returns {string} 画像パス
 */
function generateEnergyImagePath(nameEn, card) {
    // エネルギータイプ抽出
    let energyType = card.energy_type;
    if (!energyType) {
        // 名前からタイプを推測
        energyType = nameEn.split(" ")[0];
    }
    
    const energyImageMap = {
        "Colorless": "Energy_Colorless",
        "Grass": "Energy_Grass",
        "Fire": "Energy_Fire",
        "Water": "Energy_Water",
        "Lightning": "Energy_Lightning",
        "Psychic": "Energy_Psychic",
        "Fighting": "Energy_Fighting",
        "Darkness": "Energy_Darkness",
        "Metal": "Energy_Metal"
    };
    
    const imageName = energyImageMap[energyType] || "Energy_Colorless";
    return `assets/cards/energy/${imageName}.webp`;
}

/**
 * 従来の名前ベース画像パス生成（フォールバック）
 * @param {string} nameEn - 英語名
 * @param {string} folder - フォルダ名
 * @param {Object} card - カードオブジェクト
 * @returns {string} 画像パス
 */
function generateNameBasedImagePath(nameEn, folder, card) {
    // 特別なカード名のマッピング（既存のspecialNamesを維持）
    const specialNames = {
        "Glasswing Butterfly Larva": "Glasswing_Butterfly_Larva",
        "Cat exv": "Cat_exv",
        "Grey Dagger Moth Larva": "Grey_Dagger_Moth_Larva",
        "Short-horned Grasshopper": "Short-horned_Grasshopper",
        "Tateha Butterfly": "Tateha_Butterfly",
        "Caterpillar exz": "Caterpillar_exz",
        "Taiwan Clouded Yellow": "Taiwan_Clouded_Yellow",
        "Kurohime Crane Fly": "Kurohime_Crane_Fly",
        "Bee ex": "Bee_ex",
        "Hosohari Stinkbug ex": "Hosohari_Stinkbug_ex",
        "Tonosama Grasshopper": "Tonosama_Grasshopper",
        "Rainbow Skink": "Rainbow_Skink",
        "Longhorn Beetle": "Longhorn_Beetle",
        "Tsumamurasaki Madara": "Tsumamurasaki_Madara",
        "Kobane Inago": "Kobane_Inago",
        "Orange Spider": "Orange_Spider"
    };
    
    const fileName = specialNames[nameEn] || nameEn.replace(/ /g, '_');
    const imagePath = `assets/cards/${folder}/${fileName}.webp`;
    
    // 移行期間中の開発者向け情報（本番では無効）
    if (card && card.id && typeof window !== 'undefined' && window.DEBUG_IMAGE_PATHS) {
        console.debug(`⚠️ Using name-based fallback for "${nameEn}" (ID: ${card.id}). Consider migrating to ID-based naming.`);
    }
    
    return imagePath;
}

/**
 * 名前翻訳マップ
 */
// グローバルに公開（他のモジュールから使用可能にする）
window.getCardImagePath = getCardImagePath;
window.getCardMasterList = getCardMasterList;

export const nameTranslations = {
    "Akamayabato": "アカメバト",
    "Cat exv": "猫exv",
    "Glasswing Butterfly Larva": "イシガケチョウ 幼虫",
    "Glasswing Butterfly": "イシガケチョウ",
    "Kobane Inago": "コバネイナゴ",
    "Orange Spider": "オレンジぐも",
    "Tsumamurasaki Madara": "つまむらさきまだら",
    "Grey Dagger Moth Larva": "ハイイロヒトリの幼虫",
    "Short-horned Grasshopper": "ショウヨウバッタ",
    "Haiirohitori": "ハイイロヒトリ",
    "Tateha Butterfly": "タテハチョウ",
    "Caterpillar exz": "毛虫exz",
    "Taiwan Clouded Yellow": "タイワンキチョウ",
    "Kurohime Crane Fly": "クロヒメガガンボモドキ",
    "Snail": "カタツムリ",
    "Bee ex": "ミツバチex",
    "Hosohari Stinkbug ex": "ホソヘリカメムシex",
    "Aokanabun": "アオカナブン",
    "Tonosama Grasshopper": "トノサマバッタ",
    "Rainbow Skink": "ニホントカゲ（レインボー）",
    "Longhorn Beetle": "カミキリムシ",
    "Colorless Energy": "無色 エネルギー",
    "Grass Energy": "くさ エネルギー",
    "Fire Energy": "ほのお エネルギー",
    "Water Energy": "みず エネルギー",
    "Lightning Energy": "でんき エネルギー",
    "Psychic Energy": "エスパー エネルギー",
    "Fighting Energy": "かくとうエネルギー",
    "Darkness Energy": "あく エネルギー",
    "Metal Energy": "はがね エネルギー"
};

/**
 * カードデータを正規化してゲームエンジンと互換性を保つ
 * @param {Array} rawData - 生のカードデータ
 * @returns {Array} 正規化されたカードデータ
 */
function normalizeCardData(rawData) {
    if (!Array.isArray(rawData)) return [];
    
    // ID重複検出用セット
    const usedIds = new Set();
    let nextAutoId = 1;
    
    return rawData.map((card, index) => {
        const normalized = { ...card };
        
        // === ID システム標準化 ===
        // IDが欠落または無効な場合、自動生成
        if (!normalized.id || typeof normalized.id !== 'string' || normalized.id.trim() === '') {
            normalized.id = generateUniqueId(usedIds, nextAutoId);
            noop(`⚠️ Missing ID for card at index ${index}, auto-generated: ${normalized.id}`);
        } else {
            // IDを3桁ゼロパディング形式に正規化
            const numericId = parseInt(normalized.id, 10);
            if (!isNaN(numericId) && numericId > 0) {
                normalized.id = String(numericId).padStart(3, '0');
            }
            
            // ID重複チェック
            if (usedIds.has(normalized.id)) {
                const originalId = normalized.id;
                normalized.id = generateUniqueId(usedIds, nextAutoId);
                noop(`⚠️ Duplicate ID detected: ${originalId}, reassigned to: ${normalized.id}`);
            }
        }
        
        usedIds.add(normalized.id);
        if (!isNaN(parseInt(normalized.id, 10))) {
            nextAutoId = Math.max(nextAutoId, parseInt(normalized.id, 10) + 1);
        }
        
        // === カードタイプ正規化 ===
        normalized.card_type = normalizeCardType(normalized.card_type, normalized);
        
        // === 画像フィールド統一 ===
        normalizeImageFields(normalized);
        
        // === stage の正規化 ===
        if (normalized.stage === 'Basic') normalized.stage = 'BASIC';
        if (normalized.stage === 'Stage1') normalized.stage = 'STAGE1';
        if (normalized.stage === 'Stage2') normalized.stage = 'STAGE2';
        
        // === 後方互換性のための type -> types 変換 ===
        if (!normalized.types && normalized.type) {
            normalized.types = Array.isArray(normalized.type) ? normalized.type : [normalized.type];
            delete normalized.type;
        }
        
        // === weakness を配列に変換（もし単一オブジェクトの場合） ===
        if (normalized.weakness && !Array.isArray(normalized.weakness)) {
            normalized.weakness = [normalized.weakness];
        }
        
        // === retreat_cost を数値に変換（もし配列の場合） ===
        if (Array.isArray(normalized.retreat_cost)) {
            normalized.retreat_cost = normalized.retreat_cost.length;
        }
        
        // === 欠落フィールドの補完 ===
        if (!normalized.name_en && normalized.name_ja) {
            normalized.name_en = normalized.name_ja; // フォールバック
            console.warn(`⚠️ Missing name_en, using name_ja: ${normalized.name_ja} (ID: ${normalized.id})`);
        }
        
        if (!normalized.name_ja && normalized.name_en) {
            normalized.name_ja = normalized.name_en; // フォールバック
            console.warn(`⚠️ Missing name_ja, using name_en: ${normalized.name_en} (ID: ${normalized.id})`);
        }
        
        // === データ整合性検証 ===
        validateCardData(normalized);
        
        return normalized;
    });
}

/**
 * ユニークなIDを生成
 * @param {Set} usedIds - 使用済みIDのセット
 * @param {number} startFrom - 開始番号
 * @returns {string} 生成されたID
 */
function generateUniqueId(usedIds, startFrom) {
    let id = startFrom;
    let formattedId;
    
    do {
        formattedId = String(id).padStart(3, '0');
        id++;
    } while (usedIds.has(formattedId));
    
    return formattedId;
}

/**
 * カードタイプを正規化
 * @param {string} cardType - 元のカードタイプ
 * @param {object} card - カードオブジェクト
 * @returns {string} 正規化されたカードタイプ
 */
function normalizeCardType(cardType, card) {
    if (!cardType) return 'Pokémon'; // デフォルト
    
    // 正規化マッピング
    const typeMap = {
        'Pokemon': 'Pokémon',
        'pokemon': 'Pokémon',
        'Energy': () => {
            // is_basic プロパティで基本/特殊エネルギーを判定
            if (card.is_basic === false) {
                return 'Special Energy';
            } else {
                return 'Basic Energy';
            }
        },
        'energy': () => card.is_basic === false ? 'Special Energy' : 'Basic Energy',
        'Basic Energy': 'Basic Energy',
        'Special Energy': 'Special Energy',
        'Trainer': 'Trainer',
        'trainer': 'Trainer'
    };
    
    const normalizer = typeMap[cardType];
    if (typeof normalizer === 'function') {
        return normalizer();
    } else if (normalizer) {
        return normalizer;
    }
    
    return cardType; // 不明なタイプはそのまま
}

/**
 * 画像フィールドを統一
 * @param {object} card - カードオブジェクト
 */
function normalizeImageFields(card) {
    // image フィールドを image_file に統一
    if (!card.image_file && card.image) {
        card.image_file = card.image;
        delete card.image;
    }
    
    // 空の画像フィールドをクリア
    if (card.image_file === '' || card.image_file === null) {
        delete card.image_file;
    }
    
    // IDベースの画像ファイル名を推測（ファイルが存在しない場合）
    if (!card.image_file && card.id && card.name_en) {
        const sanitizedName = sanitizeFileName(card.name_en);
        const cardTypeFolder = getCardTypeFolder(card.card_type);
        card.image_file = `${card.id}_${cardTypeFolder}_${sanitizedName}.webp`;
    }
}

/**
 * ファイル名に使用できるように文字列をサニタイズ
 * @param {string} name - 元の名前
 * @returns {string} サニタイズされた名前
 */
function sanitizeFileName(name) {
    if (!name) return 'unknown';
    return name
        .replace(/[^a-zA-Z0-9\s\-_]/g, '') // 特殊文字を除去
        .replace(/\s+/g, '_') // スペースをアンダースコアに
        .replace(/_+/g, '_') // 連続するアンダースコアを1つに
        .replace(/^_|_$/g, '') // 先頭・末尾のアンダースコアを除去
        .toLowerCase();
}

/**
 * カードタイプに対応するフォルダ名を取得
 * @param {string} cardType - カードタイプ
 * @returns {string} フォルダ名
 */
function getCardTypeFolder(cardType) {
    const folderMap = {
        'Pokémon': 'pokemon',
        'Basic Energy': 'energy',
        'Special Energy': 'energy',
        'Trainer': 'trainer'
    };
    
    return folderMap[cardType] || 'pokemon';
}

/**
 * カードデータの整合性を検証
 * @param {object} card - カードオブジェクト
 */
function validateCardData(card) {
    const warnings = [];
    
    // 必須フィールドチェック
    if (!card.id) warnings.push('Missing required field: id');
    if (!card.name_en) warnings.push('Missing required field: name_en');
    if (!card.name_ja) warnings.push('Missing required field: name_ja');
    if (!card.card_type) warnings.push('Missing required field: card_type');
    
    // カードタイプ別検証
    if (card.card_type === 'Pokémon') {
        if (!card.hp || card.hp <= 0) warnings.push('Pokémon card missing valid HP');
        if (!card.types || !Array.isArray(card.types) || card.types.length === 0) {
            warnings.push('Pokémon card missing types');
        }
    }
    
    if (card.card_type === 'Basic Energy' || card.card_type === 'Special Energy') {
        if (!card.energy_type) warnings.push('Energy card missing energy_type');
    }
    
    if (warnings.length > 0) {
        console.warn(`⚠️ Card validation warnings for "${card.name_en}" (ID: ${card.id}):`, warnings);
    }
}

/**
 * 静的フォールバックデータを取得
 * @returns {Array} 基本的なカードデータ
 */
function getStaticFallbackData() {
    return [
        {
            id: "001",
            name_en: "Akamayabato",
            name_ja: "アカメバト",
            card_type: "Pokémon",
            stage: "BASIC",
            hp: 130,
            types: ["Colorless"],
            weakness: [{ type: "Darkness", value: "×2" }],
            retreat_cost: 1,
            attacks: [
                {
                    name_ja: "ひっかく",
                    name_en: "Scratch",
                    cost: ["Lightning"],
                    damage: 90
                }
            ],
            image_file: "Akamayabato.webp"
        },
        {
            id: "002",
            name_en: "Grass Energy",
            name_ja: "くさエネルギー",
            card_type: "Basic Energy",
            energy_type: "Grass",
            is_basic: true,
            image_file: "Energy_Grass.webp"
        }
    ];
}
