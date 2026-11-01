import { Material, Mesh, Texture, Light, type Object3D } from 'three';
type Disposable = { dispose(): void };
/** Per-scene ownership. Late asynchronous results must check active before attachment. */
export class SceneResources {
  active = true;
  private root: Object3D;
  private owned = new Set<Disposable>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  constructor(root: Object3D) { this.root = root; }
  track<T extends Disposable>(resource: T): T {
    if (!this.active) resource.dispose(); else this.owned.add(resource);
    return resource;
  }
  release(resource: Disposable) { this.owned.delete(resource); resource.dispose(); }
  timeout(callback: () => void, delay: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); if (this.active) callback(); }, delay);
    this.timers.add(timer);
  }
  dispose() {
    if (!this.active) return;
    this.active = false;
    this.timers.forEach(clearTimeout); this.timers.clear();
    const objects = new Set<Disposable>();
    this.root.traverse((object) => {
      if (object instanceof Light && "shadow" in object) {
        const shadow = object.shadow as {dispose():void};
        objects.add(shadow);
      }
      if (!(object instanceof Mesh)) return;
      objects.add(object.geometry);
      const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        objects.add(material);
        for (const value of Object.values(material)) if (value instanceof Texture) objects.add(value);
      }
    });
    this.owned.forEach(item => objects.add(item));
    objects.forEach(item => item.dispose());
    this.owned.clear(); this.root.clear();
  }
}
