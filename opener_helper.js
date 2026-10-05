// ===== 企鹅开场白助手 v2.0（开场白选择器 + 返回开场页 合并版）=====
/* 由以下两个脚本合并而成，功能不变、互不干扰：
   1. 企鹅简易开场白选择器 v1.0（作者：西维纳尔）——脚本按钮「开场白选择」弹出选择器，切换到角色卡任意开场白；
   2. 返回开场页-角色卡简易模板（企鹅的酒馆开场页生成器生成，灵感来源 @wobushirenji「非首页自动返回」）——第0楼处于第2张及以后开场白时，正文末尾出现「← 返回开场页」按钮，一键切回第0张开场白（开场页）。
   合并说明：选择器管"去任意开场白"，返回按钮管"一键回开场页"，两个入口各自独立，任一失效不影响另一个。
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


(function(){
'use strict';
/* 返回开场页按钮——企鹅的酒馆开场页生成器生成
   灵感来源 @wobushirenji「非首页自动返回」脚本（作者允许二改，来源已标明）。
   只向第0楼的非0号 swipe 注入按钮：不改聊天文本、不碰其它楼层、开场页本身不出现。 */
var CFG={mode:'text',text:"← 返回开场页",img:""};
var CLASS_NAME='opg-backhome',STYLE_ID='opg-backhome-style';
var scheduled=false,disposed=false,observedChat=null,observedFirst=null,chatObserver=null,firstObserver=null,lastDoc=null;
function hasFn(n){return typeof window[n]==='function'}
function getHostDocument(){
  var w=window,k;
  for(k=0;k<8;k++){
    try{
      if(!w.parent||w.parent===w)break;
      w=w.parent;
      if(w.document&&w.document.querySelector('#chat'))return w.document;
    }catch(e){break}
  }
  try{if(document.querySelector('#chat'))return document}catch(e){}
  return null;
}
async function getSwipeId(){
  if(hasFn('getChatMessages')){
    try{
      var r=getChatMessages(0);
      if(r&&typeof r.then==='function')r=await r;
      var first=Array.isArray(r)?r[0]:null;
      if(first){
        if(first.is_user===true||(first.role&&first.role!=='assistant'))return null;
        var n=Number(first.swipe_id==null?0:first.swipe_id);
        return Number.isInteger(n)&&n>=0?n:null;
      }
    }catch(e){}
  }
  try{
    if(typeof SillyTavern!=='undefined'&&SillyTavern&&typeof SillyTavern.getContext==='function'){
      var chat=SillyTavern.getContext().chat,row=chat?chat[0]:null;
      if(row&&!row.is_user){
        var m=Number(row.swipe_id==null?0:row.swipe_id);
        return Number.isInteger(m)&&m>=0?m:null;
      }
    }
  }catch(e){}
  return null;
}
function cssText(){
  /* 主题色已由生成器烘焙为字面量（#6e63bf59 等 hex8 透明度手法与 gen/css.js 一致） */
  if(CFG.mode==='img'){
    return '.'+CLASS_NAME+'{display:block;width:min(160px,88%);min-height:44px;margin:20px auto 10px;padding:0;border:0;background:transparent;box-shadow:none;cursor:pointer;line-height:0;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .15s ease}'
      +'.'+CLASS_NAME+' img{display:block;width:100%;height:auto;max-width:100%;border:none;border-radius:0;background:transparent;box-shadow:none}'
      +'.'+CLASS_NAME+':hover{transform:translateY(-1px)}'
      +'.'+CLASS_NAME+':active{transform:scale(.98)}'
      +'.'+CLASS_NAME+':focus-visible{outline:1px solid #e8c47c;outline-offset:3px}'
      +'@media (prefers-reduced-motion:reduce){.'+CLASS_NAME+'{transition:none}}';
  }
  return '.'+CLASS_NAME+'{display:block;width:min(240px,86%);min-height:44px;margin:20px auto 10px;padding:0 18px;'
    +'border:1px solid #6e63bf59;box-shadow:inset 0 0 0 1px #6e63bf14;border-radius:12px;'
    +'background:linear-gradient(160deg,#6e63bf1a,#6e63bf08);color:#f0f0f5;'
    +'font-family:inherit;font-size:13px;letter-spacing:3px;text-indent:3px;line-height:1.2;'
    +'cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;'
    +'transition:border-color .18s ease,background .18s ease,transform .15s ease}'
    +'.'+CLASS_NAME+':hover{border-color:#e8c47c;background:linear-gradient(160deg,#6e63bf2e,#6e63bf12)}'
    +'.'+CLASS_NAME+':active{transform:scale(.97)}'
    +'.'+CLASS_NAME+':focus-visible{outline:1px solid #e8c47c;outline-offset:3px}'
    +'@media (prefers-reduced-motion:reduce){.'+CLASS_NAME+'{transition:none}}';
}
function ensureStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  var style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=cssText();
  (doc.head||doc.documentElement).appendChild(style);
}
function schedule(){
  if(scheduled||disposed)return;
  scheduled=true;
  setTimeout(function(){scheduled=false;if(!disposed)sync()},80);
}
function attachObservers(doc){
  var chat=doc.querySelector('#chat');
  if(chat!==observedChat){
    if(chatObserver)chatObserver.disconnect();
    observedChat=chat;
    if(chat){chatObserver=new MutationObserver(schedule);chatObserver.observe(chat,{childList:true})}
  }
  var first=chat?chat.querySelector('.mes[mesid="0"]'):null;
  if(first!==observedFirst){
    if(firstObserver)firstObserver.disconnect();
    observedFirst=first;
    if(first){firstObserver=new MutationObserver(schedule);firstObserver.observe(first,{childList:true,subtree:true})}
  }
  return first;
}
function stopGreetAudio(){
  /* 回到开场页视为重新开局：停掉并移除开场白联动音轨（本工具挂宿主文档的 data-opg-greet-audio） */
  try{
    var doc=getHostDocument()||document;
    var list=doc.querySelectorAll('audio[data-opg-greet-audio]');
    for(var i=0;i<list.length;i++){
      try{list[i].pause()}catch(e){}
      if(list[i].parentNode)list[i].parentNode.removeChild(list[i]);
    }
  }catch(e){}
}
function makeButton(doc){
  var button=doc.createElement('button');
  button.type='button';
  button.className=CLASS_NAME;
  button.title='返回主页';
  button.setAttribute('aria-label','返回主页');
  if(CFG.mode==='img'){
    var pic=doc.createElement('img');
    pic.src=CFG.img;
    pic.alt=CFG.text;
    pic.loading='lazy';
    pic.decoding='async';
    button.appendChild(pic);
  }else{
    button.textContent=CFG.text;
  }
  button.addEventListener('click',function(event){
    event.preventDefault();
    event.stopPropagation();
    if(button.disabled)return;
    button.disabled=true;
    if(!hasFn('setChatMessages')){
      console.warn('[返回开场页] 未检测到酒馆助手 setChatMessages API');
      button.disabled=false;
      return;
    }
    try{
      Promise.resolve(setChatMessages([{message_id:0,swipe_id:0}],{refresh:'affected'})).then(function(){
        stopGreetAudio();
        schedule();
      }).catch(function(err){
        console.warn('[返回开场页] 切换失败',err);
        button.disabled=false;
      });
    }catch(err){
      console.warn('[返回开场页] 切换失败',err);
      button.disabled=false;
    }
  });
  return button;
}
function sync(){
  if(disposed)return;
  var doc=getHostDocument();
  if(!doc)return;
  lastDoc=doc;
  var first=attachObservers(doc);
  if(!first)return;
  var existing=first.querySelector('.'+CLASS_NAME);
  getSwipeId().then(function(sw){
    if(disposed)return;
    if(sw===null||sw===0){if(existing)existing.remove();return}
    var text=first.querySelector('.mes_text')||first.querySelector('.mes_block');
    if(!text)return;
    if(existing&&text.contains(existing))return;
    if(existing)existing.remove();
    ensureStyle(doc);
    text.appendChild(makeButton(doc));
  }).catch(function(){});
}
function dispose(){
  disposed=true;
  if(chatObserver)chatObserver.disconnect();
  if(firstObserver)firstObserver.disconnect();
  try{
    if(lastDoc){
      var els=lastDoc.querySelectorAll('.'+CLASS_NAME);
      for(var i=0;i<els.length;i++)els[i].remove();
      var st=lastDoc.getElementById(STYLE_ID);
      if(st)st.remove();
    }
  }catch(e){}
}
if(hasFn('eventOn')&&typeof tavern_events!=='undefined'&&tavern_events){
  ['CHAT_CHANGED','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_UPDATED'].forEach(function(name){
    var ev=tavern_events[name];
    if(ev){try{eventOn(ev,schedule)}catch(e){}}
  });
}
var doc0=getHostDocument();
if(doc0){
  var onClick=function(e){
    if(e.target&&e.target.closest&&e.target.closest('#chat .mes[mesid="0"] .swipe_left,#chat .mes[mesid="0"] .swipe_right'))schedule();
  };
  doc0.addEventListener('click',onClick,true);
  window.addEventListener('pagehide',function(){
    doc0.removeEventListener('click',onClick,true);
    dispose();
  },{once:true});
}else{
  window.addEventListener('pagehide',dispose,{once:true});
}
schedule();
})();
