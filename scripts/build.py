#!/usr/bin/env python3
"""从 src/opener_helper.js 生成酒馆助手脚本 JSON，保持单一事实来源。

用法：
    python scripts/build.py                  # 生成 dist/penguin-opener-helper-vX.Y.json
    python scripts/build.py --check          # 只校验可构建与版本标记，不写文件（CI 用）
    python scripts/build.py --notes v2.1     # 打印 CHANGELOG 中该版本的段落（发 Release 用）
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / 'src' / 'opener_helper.js'
CHANGELOG = REPO_ROOT / 'CHANGELOG.md'
DIST = REPO_ROOT / 'dist'

# 与 v2.0 导出文件保持一致，重新导入时覆盖旧脚本而非另建一条
SCRIPT_ID = '9e5943d4-8e56-40d9-b4f8-6ebd925b004e'
BUTTON_NAME = '开场白选择'
INFO = (
    '**合并版**：企鹅简易开场白选择器 v1.0（作者：西维纳尔）+ 返回开场页（源自企鹅的酒馆开场页生成器）。\n'
    '**两个入口**：\n'
    '- 脚本按钮「开场白选择」：弹出选择器，列出角色卡全部开场白并一键切换；\n'
    '- 正文末尾「← 返回开场页」：第 0 楼不在开场页时出现，点击即回到第 1 张开场白。\n'
    '两个入口各自独立，互不干扰。脚本不使用正则、不修改消息原文，仅读写第 0 楼的 swipes。'
)


def read_version(content: str) -> str:
    match = re.search(r'企鹅开场白助手 v(\d+\.\d+)', content)
    if not match:
        sys.exit('src/opener_helper.js 缺少「企鹅开场白助手 vX.Y」版本标记')
    return match.group(1)


def build() -> dict:
    content = SOURCE.read_text(encoding='utf-8')
    version = read_version(content)
    return {
        'type': 'script',
        'enabled': True,
        'name': f'企鹅开场白助手 v{version}',
        'id': SCRIPT_ID,
        'content': content,
        'info': INFO,
        'button': {'enabled': True, 'buttons': [{'name': BUTTON_NAME, 'visible': True}]},
        'data': {},
        'export_with': {'data': True, 'button': True},
    }


def extract_notes(version: str) -> str:
    text = CHANGELOG.read_text(encoding='utf-8')
    match = re.search(
        rf'^## {re.escape(version)}(?=[\s-])[^\n]*\n(.*?)(?=^## |\Z)', text, re.MULTILINE | re.DOTALL
    )
    if not match:
        sys.exit(f'CHANGELOG.md 中没有 {version} 的段落')
    return match.group(1).strip()


def main() -> None:
    args = sys.argv[1:]
    if '--notes' in args:
        print(extract_notes(args[args.index('--notes') + 1]))
        return
    script = build()
    if '--check' in args:
        print(f"OK: {script['name']}（content {len(script['content'])} 字符）")
        return
    DIST.mkdir(exist_ok=True)
    # GitHub 会剥离 Release 资源名中的非 ASCII 字符，产物文件名用 ASCII
    version = read_version(script['content'])
    out = DIST / f'penguin-opener-helper-v{version}.json'
    out.write_text(json.dumps(script, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'已生成 {out}')


if __name__ == '__main__':
    main()
