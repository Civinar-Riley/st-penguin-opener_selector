# 防踩坑记录

维护本插件 / 本仓库时实际踩过的坑，每条按「现象 → 原因 → 对策」记录。新坑请随手补在这里。

## GitHub Release

1. **资源文件名的非 ASCII 字符会被剥离**
   现象：`酒馆助手脚本-企鹅开场白助手 v2.1.json` 上传后变成 `-.v2.1.json`。
   原因：GitHub 会清洗 Release 资源名，非 ASCII 与空格全部删除。
   对策：发布资源一律用 ASCII 名。build.py 已固定输出 `dist/penguin-opener-helper-vX.Y.json`，导入只读 JSON 内部字段，文件名不影响使用。

2. **资源名以 `-` 开头时 gh 会当成 flag**
   现象：`gh release delete-asset v2.1 "-.v2.1.json"` 报 `unknown shorthand flag`。
   对策：走 API 按资源 id 删：`gh api repos/<owner>/<repo>/releases/tags/<tag>` 拿到 `assets[].id`，再 `gh api -X DELETE repos/<owner>/<repo>/releases/assets/<id>`。

## Windows 编码（本地跑 build.py / gh）

3. **重定向 stdout 时 Python 按 ANSI 代码页写出**
   现象：`python scripts/build.py --notes v2.1 > notes.md` 在 Windows 上写出 GBK 字节；`gh --notes-file` 按 UTF-8 读入，中文全部变 U+FFFD（v2.1 Release 说明因此坏过一次）。
   对策：build.py 入口已加 `sys.stdout.reconfigure(encoding='utf-8')`；任何生成给 gh 的中间文件，先做字节级 UTF-8 校验再使用。

4. **终端显示乱码 ≠ 数据损坏，反之也不成立**
   现象：Git Bash 控制台按 GBK 显示 UTF-8 很常见；本次 Release 说明的损坏曾被误判为「只是显示问题」，而一条实际完好的提交信息又被显示成乱码。
   对策：判定一律走字节级校验——`gh api ... | python -c "... text.decode('utf-8'); assert ..."`，不要用控制台肉眼判断，也不要拿控制台回显做 grep。

5. **含中文的内联命令参数不可靠**
   现象：`git commit -m "中文…"` 本次显示乱码（实际字节完好，但不可依赖）。
   对策：中文长文本一律先写 UTF-8 文件，再 `git commit -F file` / `gh pr create --body-file file`（与全局约定一致：含中文的命令先落文件）。

## 酒馆助手（JS-Slash-Runner）脚本环境

6. **脚本运行在 iframe，`$` 是宿主页 jQuery，裸 `document` 是 iframe 文档**
   现象：`$(document).on('keydown', …)` 收不到宿主页按键，Esc 关弹窗失效（v2.1 子代理审查发现）。
   对策：事件监听绑在元素所在文档：`$(modal[0].ownerDocument).on('keydown', …)`；触碰 `#chat` 用 getHostDocument() 逐层向上找。

7. **API 类型事实（改代码前先查官方文档与 `@types`）**
   - `getCharacter('current')` 返回 `first_messages: string[]`；
   - `getChatMessages(...)` 返回无 `is_user`，判角色用 `role`；但 `SillyTavern.getContext().chat` 回退路径里是原始对象、有 `is_user`，两级判断都要保留；
   - `setChatMessages` 默认 `refresh: 'affected'`，可同时传 `swipes` + `swipe_id`；
   - `eventOn` 随脚本关闭自动清理，但 DOM 清理仍需自己挂 pagehide。

8. **脚本导入覆盖靠固定 id**
   `SCRIPT_ID`（build.py）沿用 v2.0 的 UUID。换了 id，用户重新导入会出现两条重复脚本。

## 仓库工作流

9. **发版只走 tag**
   改 `src/opener_helper.js` 顶部版本标记 + `CHANGELOG.md` → 推 `vX.Y` tag → release.yml 自动构建、校验 tag 与版本一致、提取说明并发布。不要手动 `gh release create`（资源名、编码两个坑都在手动路径上）。

## Python 小坑（build.py 实际踩过）

10. `[ -\n]` 是反向区间，直接 `re.PatternError`，写「空白或连字符」用 `[\s-]`。
11. `re.DOTALL` 下 `.*` 贪婪回溯会吞掉整段正文（表现为提取结果为空），匹配标题行用 `[^\n]*`。
