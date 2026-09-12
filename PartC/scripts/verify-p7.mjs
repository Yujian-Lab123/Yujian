import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const landing = read('app/page.tsx');
const landingCss = read('app/p7-landing.module.css');
const onboarding = read('app/onboarding/page.tsx');
const onboardingCss = read('app/onboarding/p7-motion.module.css');
const encounter = read('app/encounter/page.tsx');
const encounterCss = read('app/encounter/p7-motion.module.css');
const author = read('app/encounter/[id]/page.tsx');
const connect = read('app/connect/[id]/page.tsx');
const connectCss = read('app/connect/[id]/p7-motion.module.css');
const connections = read('app/connections/page.tsx');
const connectionsCss = read('app/connections/p7-motion.module.css');

const checks = [
  ['AI 理解页保留四阶段展示进度', onboarding.includes('Math.min(step, STEPS.length)') && onboarding.includes('正在理解你的')],
  ['Loading 使用水墨 SVG 场景', onboarding.includes('inkLandscape') && onboardingCss.includes('@keyframes drawInk')],
  ['Loading 有状态播报', onboarding.includes('role="status"') && onboarding.includes('aria-live="polite"')],
  ['分析失败有可恢复界面', onboarding.includes("phase === 'error'") && onboarding.includes('重新理解')],
  ['推荐页有进入/离开/消散三种状态', encounter.includes("'enter' | 'idle' | 'leave' | 'dismiss'")],
  ['推荐卡转场不使用横向滑卡', encounterCss.includes('@keyframes paperReveal') && !encounterCss.includes('translateX(-100') && !encounterCss.includes('translateX(100')],
  ['反馈提交会防重复操作', encounter.includes('if (!card || busy) return') && encounter.includes('disabled={busy}')],
  ['推荐列表重载会复位索引', encounter.includes('setIdx(0)')],
  ['作者头像有 Content → Person Reveal', author.includes('avatarReveal') && encounterCss.includes('@keyframes portraitReveal')],
  ['意愿提交有 busy 状态', author.includes('aria-busy={submitting}')],
  ['双向成立先显示过渡层', author.includes('mutualOverlay') && author.includes('你们都愿意认识彼此')],
  ['连接成功页有双人汇合与连线', connect.includes('MutualMark') && connectCss.includes('@keyframes drawConnection')],
  ['连接页窄屏重排双方与话题', connectCss.includes("'left right'") && connectCss.includes("'bridge bridge'")],
  ['核心页面使用动态视口高度', [landing, onboarding, encounter, author, connect, connections].every((source) => source.includes('min-h-[100dvh]'))],
  ['Landing 手机 CTA 可全宽', landing.includes('w-full max-w-sm')],
  ['推荐反馈按钮达到 44px 触控高度', encounter.includes('min-h-11')],
  ['所有 P7 动画支持减少动态效果', [landingCss, onboardingCss, encounterCss, connectCss, connectionsCss].every((source) => source.includes('prefers-reduced-motion: reduce'))],
  ['P7 未依赖新的 JS 动画库', ![landing, onboarding, encounter, author, connect].some((source) => /framer-motion|gsap|lottie/.test(source))],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `P7 verification failed: ${name}`);
  console.log(`✓ ${name}`);
}

console.log(`P7 verification passed: ${checks.length} assertions.`);
