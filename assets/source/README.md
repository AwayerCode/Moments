# Blender 资产约定

当前源文件与导出模型使用 Blender 5.2.3 LTS。模型为项目原创，采用仓库 MIT 许可证。

- `playroom.blend` / `build_playroom.py`：儿童房、桌子、玩具与场景锚点
- `sisi-camera.blend` / `build_camera.py`：相机与出纸口锚点
- `../../public/models/`：浏览器加载的 GLB

## 两种工作流

`npm run assets:build` 从 Python 重新生成原型，**覆盖两个 blend 与 GLB**。手工精修前请保存版本。

在 Blender 中编辑并保存现有源文件后，运行 `npm run assets:export`；它只导出 GLB，不修改源文件。
可通过 `BLENDER_BIN` 指定 Blender 可执行文件。提交模型改动时同步提交源文件和 GLB。

## 空间约定

Three.js 使用 Y 向上。Blender 导出负责坐标转换，不在前端按设备移动或缩放房间。
保留以下命名 Empty 节点：

| 源文件 | 节点 | 用途 |
| --- | --- | --- |
| playroom | CameraMount | 相机模型在世界中的位置、旋转、比例 |
| playroom | EntryView / EntryPortrait | 横屏与竖屏观察位置 |
| playroom | EntryTarget | 入口观察目标 |
| playroom | GalleryOrigin | 展墙起点，与 galleryLayout.ts 一致 |
| sisi-camera | PrintSlot | 出纸口位置 |

当前打印方向为世界 +Z、纸面朝 +Y；改变相机朝向时需同步修改 sequence.ts 的出纸方向。
运行时使用模型原有 PBR 材质；灯光位于 src/scene/lighting.ts。不要按材质名称在前端覆盖材质。
照片贴图是照片内容本身；旧房间背景与程序化纹理在 assets/reference/legacy 中归档，不会发布。

## 当前限制

模型仍为程序化空间原型，不代表最终美术品质。后续在 Blender 中精修曲面、倒角、布料、镜头与材质。
导出后检查锚点、接触阴影、出纸是否穿模，以及横竖屏镜头构图。
