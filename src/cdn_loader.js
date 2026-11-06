// ===== 企鹅开场白助手 · CDN 加载器 =====
/* 从 jsDelivr 加载最新发布版的 src/opener_helper.js，发版后无需重新导入脚本。
   版本解析：先查 jsDelivr 已收录的 tag，取最高版本；查询失败时回退到构建时的版本。
   只加载 tag 对应的不可变地址，不加载 main 分支，未发版的改动不会推给用户。
   卸载清理（pagehide）由 opener_helper.js 自行处理；酒馆助手据脚本内容是否含 pagehide 决定是否注入
   cleanup_protector，此处提及使加载器版与离线版运行在相同环境。 */

const REPO = 'Civinar-Riley/st-penguin-opener_selector';
const CDN = 'https://testingcf.jsdelivr.net/gh';
const FALLBACK_VERSION = '__FALLBACK_VERSION__';

const compareVersion = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
};

async function resolveVersion() {
  try {
    const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${REPO}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const versions = (await res.json()).versions.map((v) => v.version).filter((v) => /^\d+(\.\d+)*$/.test(v));
    if (versions.length) return versions.sort(compareVersion).pop();
  } catch (e) {
    console.warn('[企鹅开场白助手] 查询最新版本失败，使用内置版本', FALLBACK_VERSION, e);
  }
  return FALLBACK_VERSION;
}

const version = await resolveVersion();
try {
  await import(`${CDN}/${REPO}@${version}/src/opener_helper.js`);
  console.info(`[企鹅开场白助手] 已从 CDN 加载 v${version}`);
} catch (e) {
  console.error('[企鹅开场白助手] CDN 加载失败', e);
  if (typeof toastr !== 'undefined') toastr.error(`企鹅开场白助手 v${version} 加载失败，请检查网络或改用离线版`);
}
