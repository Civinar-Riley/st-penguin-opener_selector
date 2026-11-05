// ===== 企鹅开场白助手 v2.1（开场白选择器 + 返回开场页）=====
/* 两个入口各自独立，任一失效不影响另一个：
   1. 开场白选择器 v1.0（作者：西维纳尔）——脚本按钮「开场白选择」弹出选择器，切换到角色卡任意开场白；
   2. 返回开场页（源自企鹅的酒馆开场页生成器「返回开场页-角色卡简易模板」，灵感来源 @wobushirenji
      「非首页自动返回」，作者允许二改、来源已标明）——第 0 楼不在开场页时，正文末尾出现「← 返回开场页」按钮。
   v2.1：修复弹窗连点时的竞态与内容重复开场白的映射；「返回开场页」重写为与选择器一致的可读风格，行为不变。
   注意：若某角色还单独启用了开场页生成器生成的「返回开场页」脚本，请停用其一，避免楼层出现两个返回按钮。 */

// ===== 开场白选择器（按钮弹窗版）=====
$(() => {
  const errText = (e) => (e instanceof Error ? e.message : String(e));
  const notifyError = (msg) => {
    console.error('[开场白选择器]', msg);
    if (typeof toastr !== 'undefined') toastr.error(String(msg));
  };

  // ---- 注入样式（先移除旧的，避免重复累积）----
  $('#opening_selector_style').remove();
  $('.opening-selector-overlay').remove();

  const $style = $(`
    <style id="opening_selector_style">
      .opening-selector-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 99999;
      }
      .opening-selector-modal {
        background: var(--SmartThemeBlurTintColor, #1a1a1a);
        border: 1px solid var(--SmartThemeBorderColor, #444);
        border-radius: 8px;
        width: 90vw; max-width: 600px; max-height: 80vh;
        display: flex; flex-direction: column;
        color: var(--SmartThemeBodyColor, #fff);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      }
      .opening-selector-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
      }
      .opening-selector-header h3 { margin: 0; font-size: 16px; }
      .opening-selector-close {
        background: none; border: none;
        color: var(--SmartThemeBodyColor, #fff);
        font-size: 24px; cursor: pointer; padding: 0 8px; line-height: 1;
      }
      .opening-selector-close:hover { opacity: 0.7; }
      .opening-selector-content { flex: 1; overflow-y: auto; padding: 8px; }
      .opening-selector-list { display: flex; flex-direction: column; gap: 4px; }
      .opening-selector-item {
        display: flex; align-items: flex-start; gap: 8px;
        padding: 10px 12px; border-radius: 6px; cursor: pointer;
        border: 1px solid transparent; transition: background 0.15s, border-color 0.15s;
      }
      .opening-selector-item:hover {
        background: rgba(255,255,255,0.08);
        border-color: var(--SmartThemeBorderColor, #444);
      }
      .opening-selector-item.active {
        background: rgba(100,160,255,0.15);
        border-color: rgba(100,160,255,0.5);
      }
      .opening-selector-index {
        flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
        background: rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: bold;
      }
      .opening-selector-item.active .opening-selector-index {
        background: rgba(100,160,255,0.4);
      }
      .opening-selector-text {
        flex: 1; font-size: 14px; line-height: 1.5;
        white-space: pre-wrap; word-break: break-word; opacity: 0.9;
      }
      .opening-selector-badge {
        flex-shrink: 0; padding: 2px 8px; border-radius: 4px;
        background: rgba(100,160,255,0.3);
        font-size: 12px; color: rgba(150,200,255,1);
      }
      .opening-selector-state { padding: 24px; text-align: center; opacity: 0.7; }
    </style>
  `).appendTo('head');

  // ---- 弹窗 DOM ----
  const $modal = $(`
    <div class="opening-selector-overlay" style="display:none">
      <div class="opening-selector-modal" role="dialog" aria-modal="true" aria-label="选择开场白">
        <div class="opening-selector-header">
          <h3>选择开场白</h3>
          <button class="opening-selector-close" aria-label="关闭">×</button>
        </div>
        <div class="opening-selector-content">
          <div class="opening-selector-state">加载中...</div>
        </div>
      </div>
    </div>
  `).appendTo('body');

  // ---- 状态 ----
  let swipe_id_map = [];
  let current_index = -1;
  let switching = false;
  let opening = false;

  // 关闭按钮 & 遮罩点击关闭
  const closeModal = () => $modal.hide();
  $modal.find('.opening-selector-close').on('click', closeModal);
  $modal.on('click', (e) => {
    if (e.target === $modal[0]) closeModal();
  });

  // Esc 关闭（仅弹窗可见时接管；脚本运行在 iframe 中，弹窗与按键都在宿主文档）
  const keydownTarget = $($modal[0].ownerDocument);
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && $modal.is(':visible')) closeModal();
  };
  keydownTarget.on('keydown', onKeyDown);

  // 列表项点击事件（事件委托，只绑一次）
  $modal.on('click', '.opening-selector-item[data-index]', async function () {
    if (switching) return;
    const index = Number($(this).attr('data-index'));
    if (index === current_index) {
      closeModal();
      return;
    }
    switching = true;
    try {
      await setChatMessages([{ message_id: 0, swipe_id: swipe_id_map[index] }]);
      current_index = index;
      if (typeof toastr !== 'undefined') toastr.success(`已切换到开场白 ${index + 1}`);
      closeModal();
    } catch (e) {
      notifyError(`切换失败: ${errText(e)}`);
    } finally {
      switching = false;
    }
  });

  // 点击"当前为自定义页"的提示项只关闭弹窗
  $modal.on('click', '.opening-selector-item[data-custom]', closeModal);

  // 预览文本：剥离 HTML 标签再截断，避免 Markdown/HTML 开场白显示成乱码
  function getPreview(message) {
    const text = String(message || '')
      .replace(/<img[^>]*>/gi, ' [图片] ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length <= 120 ? text : `${text.slice(0, 120)}...`;
  }

  // 列表项：序号圆标 + 预览文本 + 可选徽标，文本一律走 .text() 注入
  function buildItem({ marker, preview, badge, active }) {
    const $item = $('<div class="opening-selector-item"></div>');
    if (active) $item.addClass('active');
    $item.append(
      $('<div class="opening-selector-index"></div>').text(marker),
      $('<div class="opening-selector-text"></div>').text(preview)
    );
    if (badge) $item.append($('<div class="opening-selector-badge"></div>').text(badge));
    return $item;
  }

  async function openSelector() {
    if (opening) return;
    opening = true;
    $modal.show();
    const $content = $modal.find('.opening-selector-content');
    $content.empty().append($('<div class="opening-selector-state"></div>').text('加载中...'));

    try {
      const character = await getCharacter('current');
      const first_messages = character.first_messages || [];

      if (first_messages.length === 0) {
        $content.empty().append($('<div class="opening-selector-state"></div>').text('当前角色卡没有开场白'));
        return;
      }

      const msgs = getChatMessages(0, { include_swipes: true });
      const msg = msgs[0];
      if (!msg) {
        $content.empty().append($('<div class="opening-selector-state"></div>').text('当前没有聊天，请先开始一个新对话'));
        return;
      }

      const existing_swipes = Array.isArray(msg.swipes) ? msg.swipes : [];
      const swipes = [...existing_swipes];
      const remaining = [...swipes]; // 消耗式匹配：内容重复的开场白各自对应不同的 swipe
      swipe_id_map = first_messages.map((fm) => {
        let idx = remaining.indexOf(fm);
        if (idx === -1) {
          swipes.push(fm);
          idx = swipes.length - 1;
        } else {
          remaining[idx] = null;
        }
        return idx;
      });

      // 同步时保留当前选中页，避免被重置回第 0 页
      if (swipes.length !== existing_swipes.length) {
        await setChatMessages([{ message_id: 0, swipes, swipe_id: msg.swipe_id }]);
      }

      // 当前页不是任何卡片开场白（用户 re-roll 过）时记为 -1，列表顶部给出提示项
      current_index = swipe_id_map.indexOf(msg.swipe_id);

      // 渲染列表
      const $list = $('<div class="opening-selector-list"></div>');

      if (current_index === -1 && swipes[msg.swipe_id]) {
        $list.append(
          buildItem({
            marker: '★',
            preview: getPreview(swipes[msg.swipe_id]),
            badge: '当前 · 非卡片开场白',
            active: true,
          }).attr('data-custom', '1')
        );
      }

      first_messages.forEach((fm, i) => {
        const is_active = i === current_index;
        $list.append(
          buildItem({
            marker: String(i + 1),
            preview: getPreview(fm),
            badge: is_active ? '当前' : null,
            active: is_active,
          }).attr('data-index', i)
        );
      });
      $content.empty().append($list);
    } catch (e) {
      console.error('[开场白选择器]', e);
      $content.empty().append(
        $('<div class="opening-selector-state"></div>').text(`加载失败: ${errText(e)}`)
      );
    } finally {
      opening = false;
    }
  }

  // ---- 注册脚本按钮 ----
  appendInexistentScriptButtons([{ name: '开场白选择', visible: true }]);

  eventOn(getButtonEvent('开场白选择'), () => {
    void openSelector();
  });

  console.info('[开场白选择器] 脚本已加载');

  // 卸载时清理
  $(window).on('pagehide', () => {
    keydownTarget.off('keydown', onKeyDown);
    $modal.remove();
    $style.remove();
  });
});

// ===== 返回开场页（正文末尾注入按钮）=====
$(() => {
  /* 源自企鹅的酒馆开场页生成器「返回开场页-角色卡简易模板」，v2.1 重写为可读风格，行为不变。
     只向第 0 楼的非 0 号 swipe 注入按钮：不改聊天文本、不碰其它楼层、开场页本身不出现。 */
  'use strict';

  const BUTTON_CLASS = 'opg-backhome';
  const BUTTON_TEXT = '← 返回开场页';
  const STYLE_ID = 'opg-backhome-style';
  const SYNC_DELAY = 80; // 楼层重渲染后等待 DOM 稳定的去抖间隔

  let scheduled = false;
  let disposed = false;
  let chatObserver = null;
  let firstObserver = null;
  let observedChat = null;
  let observedFirst = null;
  let hostDoc = null;

  // 酒馆助手脚本运行在 iframe 中，#chat 在宿主文档里，逐层向上找
  function getHostDocument() {
    let w = window;
    for (let i = 0; i < 8; i++) {
      try {
        if (!w.parent || w.parent === w) break;
        w = w.parent;
        if (w.document && w.document.querySelector('#chat')) return w.document;
      } catch {
        break;
      }
    }
    try {
      if (document.querySelector('#chat')) return document;
    } catch {
      /* 跨域不可达 */
    }
    return null;
  }

  // 取第 0 楼当前 swipe 序号；不是 assistant 楼或环境缺失时返回 null（不注入）
  async function getSwipeId() {
    if (typeof getChatMessages === 'function') {
      try {
        const messages = await getChatMessages(0);
        const first = Array.isArray(messages) ? messages[0] : null;
        if (first) {
          if (first.is_user === true || (first.role && first.role !== 'assistant')) return null;
          const id = Number(first.swipe_id == null ? 0 : first.swipe_id);
          return Number.isInteger(id) && id >= 0 ? id : null;
        }
      } catch {
        /* 回退到酒馆本体 API */
      }
    }
    try {
      if (typeof SillyTavern !== 'undefined' && SillyTavern && typeof SillyTavern.getContext === 'function') {
        const chat = SillyTavern.getContext().chat;
        const row = chat ? chat[0] : null;
        if (row && !row.is_user) {
          const id = Number(row.swipe_id == null ? 0 : row.swipe_id);
          return Number.isInteger(id) && id >= 0 ? id : null;
        }
      }
    } catch {
      /* 环境缺失时视为不可注入 */
    }
    return null;
  }

  // 主题色已由生成器烘焙为字面量（#6e63bf59 等 hex8 透明度写法与生成器一致）
  function cssText() {
    return `.${BUTTON_CLASS}{display:block;width:min(240px,86%);min-height:44px;margin:20px auto 10px;padding:0 18px;`
      + `border:1px solid #6e63bf59;box-shadow:inset 0 0 0 1px #6e63bf14;border-radius:12px;`
      + `background:linear-gradient(160deg,#6e63bf1a,#6e63bf08);color:#f0f0f5;`
      + `font-family:inherit;font-size:13px;letter-spacing:3px;text-indent:3px;line-height:1.2;`
      + `cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;`
      + `transition:border-color .18s ease,background .18s ease,transform .15s ease}`
      + `.${BUTTON_CLASS}:hover{border-color:#e8c47c;background:linear-gradient(160deg,#6e63bf2e,#6e63bf12)}`
      + `.${BUTTON_CLASS}:active{transform:scale(.97)}`
      + `.${BUTTON_CLASS}:focus-visible{outline:1px solid #e8c47c;outline-offset:3px}`
      + `@media (prefers-reduced-motion:reduce){.${BUTTON_CLASS}{transition:none}}`;
  }

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = cssText();
    (doc.head || doc.documentElement).appendChild(style);
  }

  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      if (!disposed) sync();
    }, SYNC_DELAY);
  }

  // 观察 #chat 的楼层增删与第 0 楼内部变化，变化后重新同步按钮
  function attachObservers(doc) {
    const chat = doc.querySelector('#chat');
    if (chat !== observedChat) {
      if (chatObserver) chatObserver.disconnect();
      observedChat = chat;
      if (chat) {
        chatObserver = new MutationObserver(schedule);
        chatObserver.observe(chat, { childList: true });
      }
    }
    const first = chat ? chat.querySelector('.mes[mesid="0"]') : null;
    if (first !== observedFirst) {
      if (firstObserver) firstObserver.disconnect();
      observedFirst = first;
      if (first) {
        firstObserver = new MutationObserver(schedule);
        firstObserver.observe(first, { childList: true, subtree: true });
      }
    }
    return first;
  }

  // 回到开场页视为重新开局：停掉并移除开场白联动音轨（开场页生成器挂在宿主文档的 data-opg-greet-audio）
  function stopGreetAudio() {
    try {
      const doc = getHostDocument() || document;
      const audios = doc.querySelectorAll('audio[data-opg-greet-audio]');
      audios.forEach((audio) => {
        try {
          audio.pause();
        } catch {
          /* 已销毁 */
        }
        audio.remove();
      });
    } catch {
      /* 环境缺失时忽略 */
    }
  }

  function makeButton(doc) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.title = '返回开场页';
    button.setAttribute('aria-label', '返回开场页');
    button.textContent = BUTTON_TEXT;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      if (typeof setChatMessages !== 'function') {
        console.warn('[返回开场页] 未检测到酒馆助手 setChatMessages API');
        button.disabled = false;
        return;
      }
      try {
        Promise.resolve(setChatMessages([{ message_id: 0, swipe_id: 0 }], { refresh: 'affected' }))
          .then(() => {
            stopGreetAudio();
            schedule();
          })
          .catch((err) => {
            console.warn('[返回开场页] 切换失败', err);
            button.disabled = false;
          });
      } catch (err) {
        console.warn('[返回开场页] 切换失败', err);
        button.disabled = false;
      }
    });
    return button;
  }

  // 使按钮状态与第 0 楼当前 swipe 一致：非 0 号且有正文则注入，否则移除
  function sync() {
    if (disposed) return;
    const doc = getHostDocument();
    if (!doc) return;
    hostDoc = doc;
    const first = attachObservers(doc);
    if (!first) return;
    const existing = first.querySelector('.' + BUTTON_CLASS);
    getSwipeId()
      .then((swipe_id) => {
        if (disposed) return;
        if (swipe_id === null || swipe_id === 0) {
          if (existing) existing.remove();
          return;
        }
        const text = first.querySelector('.mes_text') || first.querySelector('.mes_block');
        if (!text) return;
        if (existing && text.contains(existing)) return;
        if (existing) existing.remove();
        ensureStyle(doc);
        text.appendChild(makeButton(doc));
      })
      .catch(() => {
        /* 同步失败保持现状 */
      });
  }

  function dispose() {
    disposed = true;
    if (chatObserver) chatObserver.disconnect();
    if (firstObserver) firstObserver.disconnect();
    try {
      if (hostDoc) {
        hostDoc.querySelectorAll('.' + BUTTON_CLASS).forEach((el) => el.remove());
        const style = hostDoc.getElementById(STYLE_ID);
        if (style) style.remove();
      }
    } catch {
      /* 文档不可达时忽略 */
    }
  }

  // 楼层切换 / 渲染 / 翻页后重新同步（eventOn 随脚本关闭自动清理；单个事件注册失败不影响其余）
  if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events) {
    ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED'].forEach((name) => {
      const ev = tavern_events[name];
      if (!ev) return;
      try {
        eventOn(ev, schedule);
      } catch {
        /* 该事件不可用时靠其余事件与 MutationObserver 兜底 */
      }
    });
  }

  // swipe 箭头点击不一定触发上述事件，用捕获阶段点击兜底
  const doc0 = getHostDocument();
  const onClickCapture = (e) => {
    if (e.target && e.target.closest && e.target.closest('#chat .mes[mesid="0"] .swipe_left,#chat .mes[mesid="0"] .swipe_right')) {
      schedule();
    }
  };
  if (doc0) {
    hostDoc = doc0;
    doc0.addEventListener('click', onClickCapture, true);
    $(window).on('pagehide', () => {
      doc0.removeEventListener('click', onClickCapture, true);
      dispose();
    });
  } else {
    $(window).on('pagehide', dispose);
  }
  schedule();
});
