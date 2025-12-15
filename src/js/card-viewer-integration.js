/*
  card-viewer-integration.js
  - Wires CardAPI into card_viewer.html without assuming specific UI
  - Adds Ctrl+S save shortcut and optional button hooks
  - Exposes window.saveCardsToServer(cards) and window.loadCardsFromServer()
*/
(function () {
  function toast(msg) {
    try { console.info(msg); } catch {}
  }

  let lastUploaded = { ext: null, url: null, filename: null };

  async function loadCardsFromServer() {
    const cards = await (window.CardAPI ? CardAPI.getAll() : Promise.resolve([]));
    toast(`Loaded ${cards.length} cards from server`);
    return cards;
  }

  async function saveCardsToServer(cards) {
    if (!window.CardAPI) throw new Error('CardAPI not loaded');
    normalizeImageFields();
    const list = Array.isArray(cards) ? cards : [];
    await CardAPI.replaceAll(list);
    toast(`Saved ${list.length} cards to server`);
    return true;
  }

  function tryParseJSON(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function detectCardsFromPage() {
    if (Array.isArray(window.cards)) return window.cards;
    if (window.CARD_DATA && Array.isArray(window.CARD_DATA.cards)) return window.CARD_DATA.cards;
    const ta = document.querySelector('textarea#cards-json, textarea[name="cards"], textarea[data-cards]');
    if (ta && ta.value) {
      const parsed = tryParseJSON(ta.value.trim());
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cards)) return parsed.cards;
    }
    const pre = document.querySelector('pre#cards-json, pre[data-cards]');
    if (pre && pre.textContent) {
      const parsed = tryParseJSON(pre.textContent.trim());
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cards)) return parsed.cards;
    }
    return null;
  }

  function installHotkeys() {
    document.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        try {
          normalizeImageFields();
          const cards = detectCardsFromPage() || await loadCardsFromServer();
          await saveCardsToServer(cards);
        } catch (err) {
          console.error('Save failed:', err);
          alert('保存に失敗しました: ' + (err && err.message ? err.message : String(err)));
        }
      }
    });
  }

  function installButtons() {
    const saveBtn = document.getElementById('save-cards');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          normalizeImageFields();
          const cards = detectCardsFromPage() || await loadCardsFromServer();
          await saveCardsToServer(cards);
          alert('保存しました');
        } catch (err) {
          alert('保存に失敗しました: ' + (err && err.message ? err.message : String(err)));
        }
      });
    }
    const loadBtn = document.getElementById('load-cards');
    if (loadBtn) {
      loadBtn.addEventListener('click', async () => {
        const cards = await loadCardsFromServer();
        if (window.renderCards) window.renderCards(cards);
      });
    }

    // Optional image input hooks
    const imgInput = document.getElementById('card-image') || document.querySelector('[data-card-image]');
    if (imgInput) {
      // Ensure accepted types are flexible
      try { imgInput.setAttribute('accept', '.webp,.jpg,.jpeg,.png'); } catch {}
      imgInput.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
          const card = (window.getSelectedCard && window.getSelectedCard()) || window.currentCard || null;
          const res = await CardAPI.uploadAndAssign(card || {}, f);
          // Remember last uploaded info
          const fn = (res && res.filename) || (f && f.name) || '';
          const ext = (fn.split('.').pop() || '').toLowerCase();
          lastUploaded = { ext, url: res && res.path || null, filename: fn };

          // Update placeholders and any filename inputs that assume .webp
          updateImagePlaceholders(ext, res && res.path);

          if (window.renderCard) window.renderCard(card);
          toast(`Uploaded image: ${res.filename}`);
        } catch (err) {
          alert('画像アップロードに失敗しました: ' + (err && err.message ? err.message : String(err)));
        } finally {
          e.target.value = '';
        }
      });
    }

    // Hook a button that says "このカードを保存" to save server-side without download
    const singleSaveBtn = document.querySelector('[data-save-this-card]')
      || Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
        .find(el => /このカードを保存/.test((el.textContent || el.value || '').trim()));
    if (singleSaveBtn) {
      const handler = saveThisCardHandler;
      singleSaveBtn.addEventListener('click', handler, true);
    }

    // Global capture handler as a safety net
    document.addEventListener('click', (e) => {
      const el = e.target && (e.target.closest('[data-save-this-card]') ||
        Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
          .find(x => x.contains(e.target) && /このカードを保存/.test((x.textContent || x.value || '').trim())));
      if (el) {
        saveThisCardHandler(e);
      }
    }, true);

    // Intercept submits that originate from the save button
    document.addEventListener('submit', (e) => {
      const submitter = (e.submitter || document.activeElement);
      if (!submitter) return;
      const txt = (submitter.textContent || submitter.value || '').trim();
      if (/このカードを保存/.test(txt) || submitter.hasAttribute('data-save-this-card')) {
        saveThisCardHandler(e);
      }
    }, true);
  }

  async function saveThisCardHandler(e) {
    try {
      if (e) {
        try { e.preventDefault(); } catch {}
        try { e.stopImmediatePropagation(); } catch {}
        try { e.stopPropagation(); } catch {}
      }
      const card = resolveCurrentCard();
      if (!card) throw new Error('保存対象のカードが見つかりません');

      // If image field is a data URL or preview <img> shows a data URL, upload it first
      await ensureServerImage(card);

      // Ensure image fields and placeholders normalized before save
      normalizeImageFields();
      const preferred = card.filename || (card.id ? String(card.id) : (card.name ? String(card.name) : 'card'));
      await CardAPI.saveCardFile(card, { filename: preferred });
      toast('カードをサーバーに保存しました');
    } catch (err) {
      alert('カードの保存に失敗しました: ' + (err && err.message ? err.message : String(err)));
    }
  }

  async function ensureServerImage(card) {
    try {
      const field = ('image' in card) ? 'image' : (('image_url' in card) ? 'image_url' : null);
      let src = field ? card[field] : '';
      if (!src) {
        const imgUrlEl = document.querySelector('#image-url, input[name="image"], input[name="image_url"], input[data-image]');
        if (imgUrlEl && imgUrlEl.value) src = imgUrlEl.value;
      }
      if (!src) {
        const preview = document.getElementById('card-image-preview') || document.querySelector('[data-card-image-preview]');
        if (preview && preview.tagName === 'IMG') src = preview.src || '';
      }
      if (typeof src === 'string' && src.startsWith('data:')) {
        const res = await CardAPI.uploadAndAssign(card, src);
        if (res && res.url) {
          updateImagePlaceholders((res.filename || '').split('.').pop().toLowerCase(), res.url);
        }
      }
    } catch {}
  }

  function resolveCurrentCard() {
    // 1) Explicit APIs
    try {
      if (typeof window.getSelectedCard === 'function') {
        const c = window.getSelectedCard();
        if (c && typeof c === 'object') return c;
      }
    } catch {}
    if (window.currentCard && typeof window.currentCard === 'object') return window.currentCard;

    // 2) Indexed selection on a cards array
    const cards = detectCardsFromPage();
    const idxCandidates = [
      window.currentCardIndex,
      window.selectedIndex,
      (function () { try { return Number(document.body.getAttribute('data-selected-index')); } catch { return undefined; } })()
    ].map(v => (typeof v === 'string' ? parseInt(v, 10) : v)).filter(v => Number.isInteger(v));
    for (const idx of idxCandidates) {
      if (Array.isArray(cards) && idx >= 0 && idx < cards.length) return cards[idx];
    }
    if (Array.isArray(cards) && cards.length === 1) return cards[0];

    // 3) DOM form serialization fallback
    const form = document.querySelector('[data-card-form]')
      || document.getElementById('card-form')
      || document.querySelector('form.card-form, form[id*="card" i], .card-editor, #card-editor');
    const fromForm = form ? serializeForm(form) : null;
    if (fromForm && Object.keys(fromForm).length > 0) return fromForm;

    // 4) JSON textarea/pre fallback
    const jsonSources = [
      document.querySelector('textarea#card-json, textarea[name="card"], textarea[data-card]'),
      document.querySelector('pre#card-json, pre[data-card]')
    ].filter(Boolean);
    for (const el of jsonSources) {
      const parsed = tryParseJSON(el.value || el.textContent || '');
      if (parsed && typeof parsed === 'object') return parsed;
    }

    // 5) Selected DOM item with data-card-* attributes
    const sel = document.querySelector('[data-selected-card], .card-item.selected, [aria-current="true"]');
    if (sel) {
      const data = {};
      for (const { name, value } of Array.from(sel.attributes)) {
        if (name.startsWith('data-')) data[name.replace(/^data-/, '')] = value;
      }
      if (Object.keys(data).length) return data;
    }

    return null;
  }

  function serializeForm(scope) {
    const obj = {};
    const elements = scope.querySelectorAll('input, select, textarea');
    elements.forEach((el) => {
      const name = el.name || el.id || el.getAttribute('data-field');
      if (!name) return;
      if (el.type === 'checkbox') {
        obj[name] = !!el.checked;
        return;
      }
      if (el.type === 'radio') {
        if (el.checked) obj[name] = coerce(el.value);
        return;
      }
      obj[name] = coerce(el.value);
    });
    // Try to pick up a visible image url if present
    if (!obj.image && !obj.image_url) {
      const imgUrlEl = scope.querySelector('#image-url, input[name="image"], input[name="image_url"], input[data-image]');
      if (imgUrlEl && imgUrlEl.value) obj.image = imgUrlEl.value;
    }
    return obj;
  }

  function coerce(v) {
    if (v === 'true') return true;
    if (v === 'false') return false;
    const n = Number(v);
    if (!isNaN(n) && String(n) === v.trim()) return n;
    return v;
  }

  function normalizeImageFields() {
    // If we've uploaded an image, prefer its URL
    const url = getLastUploadedImageUrl();
    const ext = getLastUploadedImageExt();
    // Update common URL fields
    const urlInputs = [
      '#image-url', 'input[name="image"]', 'input[name="image_url"]', '#card-image-url', 'input[data-image]'
    ];
    if (url) {
      urlInputs.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el && (!el.value || /\.(webp|png|jpe?g)$/i.test(el.value))) {
          el.value = url;
        }
      });
    }
    // If fields still end with .webp but lastUploaded has another ext, rewrite extension
    if (ext) {
      urlInputs.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el && el.value) {
          el.value = el.value.replace(/\.(webp|png|jpe?g)(\b|$)/i, '.' + ext);
        }
      });
    }
    // Also try to update in-memory cards
    const cards = detectCardsFromPage();
    if (Array.isArray(cards)) {
      cards.forEach((c) => {
        if (!c) return;
        const field = ('image' in c) ? 'image' : (('image_url' in c) ? 'image_url' : null);
        if (!field) return;
        if (url && (!c[field] || /\.(webp|png|jpe?g)$/i.test(c[field]))) {
          c[field] = url;
        } else if (ext && typeof c[field] === 'string') {
          c[field] = c[field].replace(/\.(webp|png|jpe?g)(\b|$)/i, '.' + ext);
        }
      });
    }
  }

  function updateImagePlaceholders(ext, url) {
    if (ext) {
      const selector = 'input[placeholder$=".webp"],input[placeholder$=".png"],input[placeholder$=".jpg"],input[placeholder$=".jpeg"]';
      document.querySelectorAll(selector).forEach((el) => {
        const ph = el.getAttribute('placeholder');
        if (ph) el.setAttribute('placeholder', ph.replace(/\.(webp|png|jpe?g)$/i, '.' + ext));
      });
      // Also update text labels showing example filenames
      document.querySelectorAll('[data-image-placeholder], .image-placeholder').forEach((el) => {
        const txt = el.textContent || '';
        el.textContent = txt.replace(/\.(webp|png|jpe?g)\b/ig, '.' + ext);
      });
    }
    if (url) {
      // Populate obvious image url/name fields if empty
      const urlInputs = [
        '#image-url', 'input[name="image"]', 'input[name="image_url"]', '#card-image-url', 'input[data-image]'
      ];
      urlInputs.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el && !el.value) el.value = url;
      });
      // Preview
      const preview = document.getElementById('card-image-preview') || document.querySelector('[data-card-image-preview]');
      if (preview && preview.tagName === 'IMG') preview.src = url + '?t=' + Date.now();
    }
  }

  // Expose helpers so existing code can opt-in with minimal changes
  function getLastUploadedImageExt() { return lastUploaded.ext; }
  function getLastUploadedImageUrl() { return lastUploaded.url; }
  function generateCardImagePath(card, fallbackBaseName) {
    if (card && (card.image || card.image_url)) return card.image || card.image_url;
    if (lastUploaded.url) return lastUploaded.url;
    if (fallbackBaseName && lastUploaded.ext) return `/assets/cards/${fallbackBaseName}.${lastUploaded.ext}`;
    return fallbackBaseName ? `/assets/cards/${fallbackBaseName}.png` : '';
  }

  function ensureCardAPI(cb) {
    if (window.CardAPI) return cb();
    const s = document.createElement('script');
    s.src = './js/card-api.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function init() {
    ensureCardAPI(() => {
      window.saveCardsToServer = saveCardsToServer;
      window.loadCardsFromServer = loadCardsFromServer;
      window.getLastUploadedImageExt = getLastUploadedImageExt;
      window.getLastUploadedImageUrl = getLastUploadedImageUrl;
      window.generateCardImagePath = generateCardImagePath;
      // Normalize any .webp placeholders at boot to be extension-agnostic
      updateImagePlaceholders(getLastUploadedImageExt() || 'png', getLastUploadedImageUrl() || undefined);
      installHotkeys();
      installButtons();
      console.log('Card viewer integration ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
