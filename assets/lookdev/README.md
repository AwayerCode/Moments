# 入口 Cycles 美术验证

这是入口场景的 Blender 美术源文件和离线渲染样片。网页通过下述烘焙流程加载同一场景的实时版本。

- `entry-lookdev.blend`：房间、相机、织物、玩具、台灯、书本、程序化材质、灯光与摄影机。
- `entry-cycles.png`：最新 1800 × 1286 渲染，AgX Medium High Contrast、128 samples、去噪。
- `entry-cycles-v1.png` / `v2.png` / `v3.png` / `v4.png`：前几轮画面对照。
- `../source/render_lookdev.py`：组装模型、材料、绒毛、室外枝叶和渲染设置。
- `../source/lookdev_styling.py`：书本、台灯、相纸、织物、织带和相机制造细节。

## 重新生成

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python assets/source/render_lookdev.py
```

`LOOKDEV_SAMPLES=64 LOOKDEV_PERCENT=65` 可用于快速预览。`LOOKDEV_COURTYARD=1` 可开启未入选的远景建筑实验；默认关闭，因为其模型细节尚未达到当前室内画面的质量。执行会覆盖最新 blend 和 PNG，不改原始 playroom.blend 和 sisi-camera.blend。
场景最终乘以 0.15，灯光能量按距离平方同步缩放，用于真实尺度的光照和景深。

## 验证重点

- 机身轮廓、桌面与各物体接触位置；织带连接和表面字样。
- 各种材料有区别：镜片/闪光灯罩、机壳、木材、亚麻、短绒毛。
- 窗光与台灯具有空间方向，保留接触阴影；不过曝、不依靠强景深掩盖主体。
- 图中相纸为空白模型，未使用私人照片。

## 浏览器接入

```sh
npm run assets:lookdev
```

`scripts/export-lookdev.py` 读取已保存的 `entry-lookdev.blend`，应用修改器、降低亚像素绒毛数量，将房间及桌面分组展开 UV，并用 Cycles 64 samples 烘焙静态漫反射光照和切线空间法线。玻璃、金属和室外枝叶仍使用实时 PBR；没有使用相机投影背景。合并网格前保留原物体的程序化纹理坐标；漫反射按 1/4 编码、4 倍发光强度还原，保留高光余量；法线图不参与去噪或 JPEG 压缩。

输出 `public/models/entry-scene.glb`，网页 `world.ts` 直接加载它。保留 `PrintSlot`、`CameraMount` 和展廊锚点；导出时恢复现有运行时坐标尺度。修改 Blender 场景后需要重新运行此命令，刷新网页不会自动执行烘焙。

离线 Cycles 与实时 Three.js 不会完全一致：实时版减少绒毛、使用烘焙漫反射和实时高光，静态物体移动后需要重新烘焙。出纸和画廊照片仍由 Three.js 动态生成。

## 本轮选定方向

相机轻微转向，展示机身厚度；真实比例的景深和光照；奶油黄台灯、书本、前景织物和相纸构成生活场景。机身使用扁平织带、透明闪光灯罩、细握持纹理和镜头压圈；兔子补充手臂及更密的短绒毛。建筑远景实验经过两次检查未入选。

## 穿模检查

`audit_lookdev.py` 对应用修改器后的世界坐标三角面做相交检查，结果为 `collision-audit.json`。本次包括桌面与可见道具，以及 68 组重点邻近对象（绳带/机壳/玩偶、布料/桌裙、积木/书本/台灯等）。排除房间结构和有意嵌入的装配连接；这不是对所有网格的全面无穿模证明，也不检测完全包含关系。

修正：绳带路径与宽度余量、布料先越过桌沿再下垂、兔子与套环间距、玩偶脚底高度、台灯与书封接触，以及书本/台灯与后排积木间距。树枝改为渐细曲线和带叶柄的曲面叶片。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python assets/source/audit_lookdev.py
```
