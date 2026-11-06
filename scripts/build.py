#!/usr/bin/env python3
"""从 src/ 生成酒馆助手脚本 JSON，保持单一事实来源。

用法：
    python scripts/build.py                  # 生成 dist/ 下离线版与 CDN 加载器两份 JSON
    python scripts/build.py --check          # 只校验可构建与版本标记，不写文件（CI 用）
    python scripts/build.py --notes v2.1     # 打印 CHANGELOG 中该版本的段落（发 Release 用）
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / 'src' / 'opener_helper.js'
LOADER = REPO_ROOT / 'src' / 'cdn_loader.js'
CHANGELOG = REPO_ROOT / 'CHANGELOG.md'
DIST = REPO_ROOT / 'dist'

# 与 v2.0 导出文件保持一致，重新导入时覆盖旧脚本而非另建一条；
# 离线版与 CDN 加载器共用此 id，导入其一即替换另一个，避免两份同时运行出现重复按钮
SCRIPT_ID = '9e5943d4-8e56-40d9-b4f8-6ebd925b004e'
BUTTON_NAME = '开场白选择'
INFO = (
    '**合并版**：企鹅简易开场白选择器 v1.0（作者：西维纳尔）+ 返回开场页（源自企鹅的酒馆开场页生成器）。\n'
    '**两个入口**：\n'
    '- 脚本按钮「开场白选择」：弹出选择器，列出角色卡全部开场白并一键切换；\n'
    '- 正文末尾「← 返回开场页」：第 0 楼不在开场页时出现，点击即回到第 1 张开场白。\n'
    '两个入口各自独立，互不干扰。脚本不使用正则、不修改消息原文，仅读写第 0 楼的 swipes。'
)
LOADER_INFO = (
    INFO + '\n\n'
    '**CDN 加载器版**：启动时从 jsDelivr 加载最新发布版，发版后无需重新导入；需要联网。'
)


def read_version(content: str) -> str:
    match = re.search(r'企鹅开场白助手 v(\d+\.\d+)', content)
    if not match:
        sys.exit('src/opener_helper.js 缺少「企鹅开场白助手 vX.Y」版本标记')
    return match.group(1)


def script_json(name: str, content: str, info: str) -> dict:
    return {
        'type': 'script',
        'enabled': True,
        'name': name,
        'id': SCRIPT_ID,
        'content': content,
        'info': info,
        'button': {'enabled': True, 'buttons': [{'name': BUTTON_NAME, 'visible': True}]},
        'data': {},
        'export_with': {'data': True, 'button': True},
    }


def build() -> tuple[str, dict, dict]:
    content = SOURCE.read_text(encoding='utf-8')
    version = read_version(content)
    loader = LOADER.read_text(encoding='utf-8')
    if '__FALLBACK_VERSION__' not in loader:
        sys.exit('src/cdn_loader.js 缺少 __FALLBACK_VERSION__ 占位符')
    loader = loader.replace('__FALLBACK_VERSION__', version)
    return (
        version,
        script_json(f'企鹅开场白助手 v{version}', content, INFO),
        script_json('企鹅开场白助手（CDN 自动更新）', loader, LOADER_INFO),
    )


def extract_notes(version: str) -> str:
    text = CHANGELOG.read_text(encoding='utf-8')
    match = re.search(
        rf'^## {re.escape(version)}(?=[\s-])[^\n]*\n(.*?)(?=^## |\Z)', text, re.MULTILINE | re.DOTALL
    )
    if not match:
        sys.exit(f'CHANGELOG.md 中没有 {version} 的段落')
    return match.group(1).strip()


def main() -> None:
    # Windows 重定向时 Python 按系统 ANSI 代码页写出，gh 按 UTF-8 读入会变成替换符
    sys.stdout.reconfigure(encoding='utf-8')
    args = sys.argv[1:]
    if '--notes' in args:
        print(extract_notes(args[args.index('--notes') + 1]))
        return
    version, script, loader = build()
    if '--check' in args:
        print(f"OK: {script['name']}（content {len(script['content'])} 字符）")
        return
    DIST.mkdir(exist_ok=True)
    # GitHub 会剥离 Release 资源名中的非 ASCII 字符，产物文件名用 ASCII
    for filename, data in (
        (f'penguin-opener-helper-v{version}.json', script),
        ('penguin-opener-helper-cdn.json', loader),
    ):
        out = DIST / filename
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'已生成 {out}')


if __name__ == '__main__':
    main()
