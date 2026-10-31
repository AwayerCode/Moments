<p align="center">
  <img src="public/logo.svg" alt="Sisi Moments" width="420" />
</p>

# Sisi Moments

一个以家庭照片为主题的 3D 记忆展廊。仓库只包含代码、原创相机模型和项目品牌资产；照片与个人数据不进入 git。

## 体验

整个站点是一个连续的 Three.js 场景，没有首页与内页切换：

1. 入口展示一台沁桃粉拍立得。没有姓名表单，直接点击相机快门。
2. 相纸从机身出片槽打印出来，成为本次浏览的封面照片。
3. 镜头跟随相纸移动，连续转入展览墙。
4. 拖动、滚轮、触屏或左右方向键浏览照片。
5. 点击任意照片，镜头移动到近景；按 `Esc` 或「返回展廊」退出。

场景支持 `prefers-reduced-motion`；启用减少动态效果时会跳过机械动画。

## 技术栈

- Vite + React + TypeScript
- Three.js：单一 renderer、相机、相纸、灯光、展墙和浏览镜头
- Cloudflare Workers + 静态资源
- 私有 R2：绑定名 `MOMENTS_BUCKET`，桶名 `sisi-moments`
- 发布主机名：`*.workers.dev`

Three.js 场景入口位于 `src/three/moments/createMomentsScene.ts`，React 只负责加载、键盘操作与可访问控件。

## 本地运行

```bash
npm install
cp .env.example .dev.vars
```

生成一个本地邀请令牌的哈希：

```bash
npm run hash-invite -- --salt '一长串随机盐' --invite 'local-only-token'
```

填写 `.dev.vars`：

```bash
ACCESS_SALT=一长串随机盐
ACCESS_INVITE_HASH=<上一条命令输出的 hex>
SESSION_SECRET=一长串随机串
```

```bash
npm run dev
```

打开本地地址后访问 `/i/local-only-token` 可换取长期会话。未登录时仍会显示内置示例内容和完整 3D 交互，但私有 R2 内容不会返回。

## 验证

```bash
npm run lint
npx tsc -b
npm run build
node --test tests/*.test.mjs
```

## 私有访问

旧版姓名门已移除。现在的流程是：

- 邀请链接：`/i/<opaque-token>`
- Worker 用 `ACCESS_SALT` 哈希令牌，与 `ACCESS_INVITE_HASH` 恒定时间比较
- 成功后写入 180 天有效的 HttpOnly `sm_session` Cookie
- `/api/moments` 与 `/api/media/*` 仍要求有效会话
- 失败请求按 isolate 限流

只把秘密放在 Cloudflare Secrets 或本地 `.dev.vars`：

| 名称 | 用途 |
| --- | --- |
| `ACCESS_SALT` | 邀请令牌哈希盐 |
| `ACCESS_INVITE_HASH` | `SHA-256(盐 + NUL + 邀请令牌)` |
| `SESSION_SECRET` | `sm_session` Cookie 的 HMAC 密钥 |

线上设置：

```bash
npx wrangler secret put ACCESS_SALT
npx wrangler secret put ACCESS_INVITE_HASH
npx wrangler secret put SESSION_SECRET
```

邀请链接本身也是秘密，不要发到公开群聊或提交到仓库。需要撤销时轮换令牌、更新 `ACCESS_INVITE_HASH` 并部署。

## 照片与 R2

`wrangler.toml` 只包含绑定：

```toml
[[r2_buckets]]
binding = "MOMENTS_BUCKET"
bucket_name = "sisi-moments"
```

保持桶为私有，不要开启 `r2.dev` 公共访问。照片只通过 Worker 鉴权路由读取：

```text
GET /api/media/<object-key>
```

照片元数据可包含：

```json
{
  "id": "moment-001",
  "caption": "2025.06.08 · 1岁6个月",
  "src": "/api/media/moments/photo-001.jpg",
  "palette": "peach"
}
```

画廊布局由前端按内容顺序生成，R2 元数据不需要保存 CSS 坐标。

## 相机资产

- `assets/source/sisi-camera.blend`：可编辑 Blender 源文件
- `assets/source/build_camera.py`：可重复构建脚本
- `public/models/sisi-camera.glb`：浏览器加载模型

所有相机资产为项目原创，不包含真实儿童照片、姓名、生日或可识别的第三方品牌素材。

## 部署

```bash
npm run deploy
```

需要 Cloudflare 账号、上面三个 Secrets，以及私有桶 `sisi-moments`。香港服务器反代阶段只需反代 `*.workers.dev` 站点，不反代 R2 桶。

## License

[MIT](LICENSE)
