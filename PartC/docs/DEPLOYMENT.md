# 部署指南（阿里云 ECS）

> 目标：一台学生机把「遇见」跑起来，公网可访问。比赛期间 OAuth 未接入，登录走 demo 模式；凭证发放后再补 HTTPS 回调。
>
> 组成：`postgres` + `web`（`next start`）+ `worker`（画像后台任务）+ 一次性 `migrate`，全部在 Docker 里，由 `docker-compose.prod.yml` 编排。

## 0. 买机器

| 项 | 建议 | 原因 |
| --- | --- | --- |
| 优惠 | 阿里云「云工开物」学生计划 300 元券 | 覆盖一年低配机 |
| 规格 | **2 核 4 GiB** 起步 | `next build`（Turbopack）吃内存；2 GiB 必须先加 swap |
| 镜像 | Ubuntu 24.04 64 位 | Docker 支持最省心 |
| 磁盘 | 40 GiB+ | 镜像 + 数据库 + 日志 |
| 带宽 | 按量付费或 3–5 Mbps 固定 | 演示够用 |
| 安全组 | 放行 22（限自己 IP）、80、443 | **不要放行 3000 和 5432**，前者走 Nginx 反代，后者只在内网 |

机器是 2 GiB 时先加 swap（在服务器上执行）：

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 1. 装环境

```bash
ssh root@<公网IP>
curl -fsSL https://get.docker.com | bash
systemctl enable --now docker
docker compose version    # 能打印版本即可
```

国内拉取 Docker Hub 慢或失败时，在 `/etc/docker/daemon.json` 配一个镜像加速器后 `systemctl restart docker`。

## 2. 拿代码

仓库是私有的，用 GitHub fine-grained PAT（只给本仓库读权限）：

```bash
git clone https://<你的TOKEN>@github.com/Yujian-Lab123/Yujian.git /opt/yujian
cd /opt/yujian
```

## 3. 配置

```bash
cp .env.example .env.prod
```

必改项：

- `TOKEN_ENCRYPTION_KEY`：`openssl rand -base64 48` 生成，**不能**用 example 里的占位值
- `LLM_API_KEY`：画像引擎要用；不填则画像回退 Mock
- `DEMO_AUTH_ENABLED=true`：比赛演示依赖 demo 登录
- `POSTGRES_PASSWORD`：自己生成一个，compose 会用它拼 `DATABASE_URL`，**文件里不用写 DATABASE_URL**
- `ZHIHU_*` 四个：凭证未发放前留空

`.env.prod` 已被 `.gitignore` 覆盖，不会进 Git。

## 4. 起服务

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl http://127.0.0.1:3000/api/health
```

`/api/health` 返回 ok 即成功。四个容器的预期状态：`migrate` 跑完退出（Exited 0），其余三个 Up。

常用命令：

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f web      # 看 web 日志
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f worker   # 画像任务不转先看这里
```

## 5. Nginx 反代（对公网暴露 80）

```nginx
# /etc/nginx/sites-available/yujian
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/yujian /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

此时浏览器访问 `http://<公网IP>` 即可演示。

## 6. 域名、HTTPS 与 OAuth 的关系（重要）

- 知乎 OAuth 回调要求**公网 HTTPS** 地址，且必须与活动页登记值完全一致。
- 域名解析到**中国大陆服务器必须 ICP 备案，通常 7–20 个工作日**——赶不上 9/15 截止。
- 结论：**比赛期间按无 OAuth 演示**（demo 登录 + 爬虫数据），不填回调地址；`ZHIHU_ALLOW_MISSING_STATE` 保持 false。
- 备案通过后再：解析域名 → certbot 签证书 → 在活动页登记 `https://<域名>/api/auth/callback` → 填入四个 `ZHIHU_*` → 重新部署。

## 7. 更新与回滚

```bash
cd /opt/yujian && git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build   # 重建并滚动替换
```

回滚：`git checkout <上一个tag或commit>` 后重跑同一条命令。数据库数据在 `yujian_pgdata` 卷里，`down` 不删卷；**删除卷前必须确认并备份**。

## 8. 赛后复用为博客

- 同一台 Nginx 加 `server` 块，按域名把博客和「遇见」分流；或再起一个容器映射到别的本机端口
- PostgreSQL 可再建一个 database 给博客用，互不影响
- 比赛结束不再用「遇见」时：`docker compose down`（保留卷），镜像用 `docker image prune -a -f` 清理

## 9. 待办：真实爬虫数据入种子库

当前 `db:seed` 写入的是 10 个虚构 Mock 用户。「用 MediaCrawler 抓到的真实数据当演示数据」还需要一个转换脚本：`data/crawler/<名>.json` → `users` / `contents` 表（沿用 ContentSource 的归一化结构），生成后通过 `migrate` 服务的幂等种子写入。这是下一步，不影响本次部署。
