# 生产依赖安全基线

最后验证：2026-09-03。

## 当前基线

- Next.js `16.3.3`（官方 Active LTS）
- React / React DOM `19.2.8`
- PostCSS `8.5.26`（Next 内置 `8.5.23`）
- Sharp `0.35.4`

升级前的 Next.js `15.3.2` 在生产审计中存在 1 个 critical 和 2 个 high；仅升级到 15.5.24 后，Next 的内置 PostCSS 仍保留 1 个 high。故最终升级至 Next 16.3.3，并同步建立 ESLint 9 的平铺配置，替换 Next 16 已移除的 `next lint` 命令。

## 部署前检查

```bash
npm run lint
npm run typecheck
npm run audit:prod
npm run build
```

`audit:prod` 会在生产依赖中出现 high 或 critical 漏洞时失败。依赖升级、锁文件更新或每次发布前都应执行这四项检查。
