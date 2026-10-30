<p align="center">
  <img src="public/logo.svg" alt="Sisi Moments" width="420" />
</p>

# Sisi Moments

私人家庭相册脚手架。仓库只放**代码**；照片与个人数据永远不要进 git。

两块固定界面：

1. 入口（`/`）：**Sisi Moments** 沁桃粉 Instax。打开/刷新时相机弹出卡片，卡片上**只有「名字」**。没有生日，没有确定/取消。回车 / 输入法确认后进入相册。
2. 冰箱门（`/gallery`）：大小不一的拍立得、错落角度、浅桃色磁贴。支持捏合缩放与拖拽平移；点一张放大，再点空白或 Esc 返回。

说明文字用占位格式：`2025.06.08 · 1岁6个月`（虚构日期与月龄，不是真实孩子信息）。

## 技术栈

- Vite + React + TypeScript
- Cloudflare **Workers** + 静态资源（[`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)）
- 发布主机名：**workers.dev**（之后可在香港用反代）。不配置自定义域名。
- **Three.js**：入口相机是 WebGL 三维 Instax；`src/three/` 里预留了冰箱场景，方便以后把墙做成更完整的 3D。
- 私有 R2：桶名 `sisi-moments`，绑定 `MOMENTS_BUCKET`。只通过**已登录 Worker** 读对象（`GET /api/media/...`）。**不要**给桶开 r2.dev 公网访问。

不是纯静态站：名字校验、失败限流、HMAC 会话 cookie 必须跑在 Worker 里，密钥不能写进前端资源。

## 本地运行

```bash
npm install
cp .env.example .dev.vars
```

在 `.dev.vars` 里填密钥（也可放同目录 `.env`）。用**虚构**本地名字生成哈希，不要用真实孩子的名字：

```bash
npm run hash-name -- --salt '一长串随机盐' --name 'demo'
```

```bash
ACCESS_SALT=一长串随机盐
ACCESS_NAME_HASH=<上面命令打印的 hex>
SESSION_SECRET=<一长串随机串>
```

```bash
npm run dev
```

打开本地地址。输错名字应失败；输入你哈希过的虚构名字应进入冰箱墙。滚轮/捏合缩放，拖拽平移，点击拍立得放大。

```bash
npm run build      # 会先跑 wrangler types
npm run preview
npm run lint
```

## 密钥（只写名字，不写值）

只放在 Cloudflare secrets 或本地 `.dev.vars`，不要写进仓库、README、截图或提交。

| 名字 | 用途 |
| --- | --- |
| `ACCESS_SALT` | 混入访客名字哈希的盐 |
| `ACCESS_NAME_HASH` | `SHA-256(盐 + NUL + 规范化名字)` 的 hex |
| `SESSION_SECRET` | 长期 `sm_session` cookie 的 HMAC 密钥 |

线上：

```bash
npx wrangler secret put ACCESS_SALT
npx wrangler secret put ACCESS_NAME_HASH
npx wrangler secret put SESSION_SECRET
```

不要把真实姓名、生日、照片或其他儿童个人信息放进仓库。

## 访问（v1）

- 访客在弹出的卡片上输入名字（标签 **名字**）。
- Worker 用 `ACCESS_SALT` 做哈希，再与 `ACCESS_NAME_HASH` 做恒定时间比较。
- 失败按 isolate 限流（15 分钟内 5 次）。
- 成功写入 HttpOnly HMAC cookie（`sm_session`，180 天）。
- `/gallery`、`/api/moments`、`/api/media/*` 都要有效 cookie。

## R2（私有）

`wrangler.toml`：

```toml
[[r2_buckets]]
binding = "MOMENTS_BUCKET"
bucket_name = "sisi-moments"
```

本地 Miniflare 模拟空桶时，`GET /api/moments` 返回抽象粉色占位拍立得。以后把对象放进私有桶，由 Worker 鉴权后读取。不要上传家庭照片到 git，也不要开启 r2.dev。

## 部署

```bash
npm run deploy
```

会发到 `*.workers.dev`。需要 Cloudflare 账号、上面三个 secrets，以及私有桶 `sisi-moments`。

## 许可

[MIT](LICENSE)
