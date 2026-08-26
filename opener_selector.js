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
      <div class="opening-selector-modal">
        <div class="opening-selector-header">
          <h3>选择开场白</h3>
          <button class="opening-selector-close">×</button>
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

  // 关闭按钮 & 遮罩点击关闭
  $modal.find('.opening-selector-close').on('click', () => $modal.hide());
  $modal.on('click', (e) => {
    if (e.target === $modal[0]) $modal.hide();
  });

  // 列表项点击事件（事件委托，只绑一次）
  $modal.on('click', '.opening-selector-item[data-index]', async function () {
    if (switching) return;
    const index = parseInt($(this).attr('data-index'), 10);
    if (index === current_index) {
      $modal.hide();
      return;
    }
    switching = true;
    try {
      await setChatMessages([{ message_id: 0, swipe_id: swipe_id_map[index] }]);
      current_index = index;
      if (typeof toastr !== 'undefined') toastr.success(`已切换到开场白 ${index + 1}`);
      $modal.hide();
    } catch (e) {
      notifyError(`切换失败: ${errText(e)}`);
    } finally {
      switching = false;
    }
  });

  // 点击"当前为自定义页"的提示项只关闭弹窗
  $modal.on('click', '.opening-selector-item[data-custom]', () => $modal.hide());

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

  async function openSelector() {
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

      const swipes = [...(Array.isArray(msg.swipes) ? msg.swipes : [])];
      swipe_id_map = [];

      // 把角色卡开场白同步进第 0 楼的 swipes（只补不删，保留用户 re-roll 的页）
      for (const fm of first_messages) {
        let idx = swipes.indexOf(fm);
        if (idx === -1) {
          swipes.push(fm);
          idx = swipes.length - 1;
        }
        swipe_id_map.push(idx);
      }

      // 同步时保留当前选中页，避免被重置回第 0 页
      if (swipes.length !== (Array.isArray(msg.swipes) ? msg.swipes.length : 0)) {
        await setChatMessages([{ message_id: 0, swipes, swipe_id: msg.swipe_id }]);
      }

      const current_content = swipes[msg.swipe_id] || '';
      current_index = first_messages.indexOf(current_content);

      // 渲染列表
      const $list = $('<div class="opening-selector-list"></div>');

      // 当前页不是任何卡片开场白（用户 re-roll 过）时给出提示项
      if (current_index === -1 && current_content) {
        const $custom = $(
          '<div class="opening-selector-item active" data-custom="1">' +
            '<div class="opening-selector-index">★</div>' +
            '<div class="opening-selector-text"></div>' +
            '<div class="opening-selector-badge">当前 · 非卡片开场白</div>' +
          '</div>'
        );
        $custom.find('.opening-selector-text').text(getPreview(current_content));
        $list.append($custom);
      }

      first_messages.forEach((fm, i) => {
        const is_active = i === current_index;
        const $item = $(
          '<div class="opening-selector-item' + (is_active ? ' active' : '') + '" data-index="' + i + '">' +
            '<div class="opening-selector-index">' + (i + 1) + '</div>' +
            '<div class="opening-selector-text"></div>' +
            (is_active ? '<div class="opening-selector-badge">当前</div>' : '') +
          '</div>'
        );
        $item.find('.opening-selector-text').text(getPreview(fm));
        $list.append($item);
      });
      $content.empty().append($list);
    } catch (e) {
      console.error('[开场白选择器]', e);
      $content.empty().append(
        $('<div class="opening-selector-state"></div>').text(`加载失败: ${errText(e)}`)
      );
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
    $modal.remove();
    $style.remove();
  });
});
