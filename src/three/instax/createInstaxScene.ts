import {
  AmbientLight,
  CatmullRomCurve3,
  TubeGeometry,
  PMREMGenerator,
  PlaneGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { easeOutBack, mountWebGL } from "../core.ts";

export type CardScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: number;
};

export type InstaxScene = {
  setEject: (amount: number) => void;
  setShake: (amount: number) => void;
  projectCard: () => CardScreenRect | null;
  dispose: () => void;
};

type Options = {
  onFrame?: () => void;
};

const BLOSSOM = new Color("#ed8b95");
const BLOSSOM_DEEP = new Color("#da7587");

export function createInstaxScene(
  canvas: HTMLCanvasElement,
  options: Options = {},
): InstaxScene {
  const host = mountWebGL(canvas, { alpha: true });
  const scene = new Scene();
  const pmrem = new PMREMGenerator(host.renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .45;
  room.dispose();
  pmrem.dispose();
  const camera = new PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, -0.22, 9.3);

  const hemi = new HemisphereLight("#fff7fb", "#f4c4d4", .8);
  const sun = new DirectionalLight("#fff6ee", 1.05);
  sun.position.set(-3.2, 4.4, 5.2);
  const fill = new DirectionalLight("#cfe6ff", 0.45);
  fill.position.set(3.4, -1.2, 2.4);
  scene.add(new AmbientLight("#ffffff", 0.28), hemi, sun, fill);

  const root = new Group();
  scene.add(root);

  const body = buildCameraBody();
  root.add(body);

  const card = buildFilmCard();
  root.add(card);

  let eject = 0;
  let shake = 0;
  let elapsed = 0;

  const slotHidden = { y: -.65, scaleY: .04 };
  const slotShown = { y: -1.8, scaleY: 1 };

  function applyCardPose() {
    const t = easeOutBack(eject);
    card.position.set(0, lerp(slotHidden.y, slotShown.y, t), 0.65);
    card.scale.set(1, lerp(slotHidden.scaleY, slotShown.scaleY, t), 1);
    card.rotation.z = Math.sin(elapsed * 28) * shake * 0.08;
    card.visible = eject > 0.02;
  }

  function resizeCamera() {
    const { width, height } = host.resize();
    camera.aspect = width / height;
    camera.position.z = Math.max(9.3, 7.4 / camera.aspect);
    camera.updateProjectionMatrix();
  }

  resizeCamera();
  const onResize = () => resizeCamera();
  window.addEventListener("resize", onResize);

  host.start((delta, time) => {
    elapsed = time;
    shake = Math.max(0, shake - delta * 2.4);
    root.rotation.y = -.08 + Math.sin(time * .55) * .025;
    root.rotation.z = -.025;
    root.position.y = Math.sin(time * 0.9) * 0.045;
    applyCardPose();
    host.renderer.render(scene, camera);
    options.onFrame?.();
  });

  return {
    setEject(amount) {
      eject = amount;
    },
    setShake(amount) {
      shake = amount;
    },
    projectCard() {
      if (eject < 0.55) {
        return null;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        return null;
      }
      card.updateMatrixWorld(true);
      const corners = [
        new Vector3(-.87, .55, .04),
        new Vector3(.87, .55, .04),
        new Vector3(-.87, -.48, .04),
        new Vector3(.87, -.48, .04),
      ].map((point) => point.applyMatrix4(card.matrixWorld).project(camera));
      const xs = corners.map((point) => (point.x * 0.5 + 0.5) * canvas.clientWidth);
      const ys = corners.map((point) => (-point.y * 0.5 + 0.5) * canvas.clientHeight);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        visible: eject,
      };
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) {
            if ("map" in material && material.map) {
              material.map.dispose();
            }
            material.dispose();
          }
        }
      });
      environment.dispose();
      host.dispose();
    },
  };
}

function buildCameraBody(): Group {
  const group = new Group();
  const plastic = new MeshPhysicalMaterial({ color: BLOSSOM, roughness: .3, metalness: .03, clearcoat: .8, clearcoatRoughness: .23 });
  const deep = plastic.clone(); deep.color = BLOSSOM_DEEP;
  const dark = new MeshPhysicalMaterial({ color: "#191b22", roughness: .2, metalness: .4, clearcoat: 1 });
  const silver = new MeshStandardMaterial({ color: "#e6d9ce", metalness: .85, roughness: .22 });
  function box(w: number, h: number, d: number, radius: number, material: MeshStandardMaterial, x: number, y: number, z: number) {
    const mesh = new Mesh(new RoundedBoxGeometry(w, h, d, 5, radius), material);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  }
  function disc(radius: number, depth: number, material: MeshStandardMaterial, x: number, y: number, z: number) {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, 80), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); group.add(mesh); return mesh;
  }
  function ring(radius: number, tube: number, material: MeshStandardMaterial, x: number, y: number, z: number) {
    const mesh = new Mesh(new TorusGeometry(radius, tube, 16, 80), material);
    mesh.position.set(x, y, z); group.add(mesh);
  }
  box(2.9, 3.12, .95, .38, deep, 0, .38, -.09);
  box(2.8, 3.04, .62, .32, plastic, .035, .4, .18);
  box(.55, 2.5, .3, .18, plastic, -1.02, .42, .49);
  // Silver reflector and its translucent ribbed flash cover.
  box(.45, .97, .16, .19, silver, -.32, 1.25, .57);
  box(.34, .85, .13, .14, new MeshPhysicalMaterial({ color: '#fff6e9', metalness: .2, roughness: .14, transparent: true, opacity: .7 }), -.32, 1.25, .67);
  for (let i = 0; i < 9; i++) box(.27, .018, .015, .006, silver, -.32, .94 + i * .075, .75);
  box(.24, .34, .1, .035, dark, -.94, 1.24, .69);
  box(.11, .2, .04, .025, silver, -.94, 1.24, .75);
  disc(.07, .05, dark, .28, 1.43, .55);
  disc(.07, .05, dark, .28, 1.23, .55);
  const label = new Mesh(new PlaneGeometry(.65, .38), new MeshStandardMaterial({ map: brandTexture(), transparent: true, roughness: .5 }));
  label.position.set(.88, 1.32, .51); group.add(label);
  // Concentric lens housing with a convex glass element and reflected highlights.
  disc(.9, .22, deep, .34, -.02, .58);
  disc(.84, .22, plastic, .34, -.02, .72);
  ring(.79, .025, deep, .34, -.02, .85);
  disc(.43, .12, dark, .34, -.02, .86);
  ring(.37, .025, silver, .34, -.02, .94);
  disc(.33, .06, dark, .34, -.02, .95);
  ring(.27, .025, dark, .34, -.02, .99);
  const glass = new Mesh(new SphereGeometry(.24, 40, 24), new MeshPhysicalMaterial({color:'#182532',metalness:.45,roughness:.06,clearcoat:1}));
  glass.scale.z = .35; glass.position.set(.34, -.02, 1); group.add(glass);
  const glint = new Mesh(new SphereGeometry(.055,16,12),new MeshStandardMaterial({color:'#d5e7f3',emissive:'#9bb0c2',emissiveIntensity:.3}));
  glint.scale.set(1,.5,.2);glint.position.set(.27,.07,1.08);group.add(glint);
  box(.18,.29,.06,.07,silver,-.3,.02,.89);
  disc(.25,.12,deep,-.94,.55,.7);
  ring(.205,.025,new MeshStandardMaterial({color:'#efa567',metalness:.6,roughness:.25}),-.94,.55,.79);
  disc(.17,.08,plastic,-.94,.55,.8);
  box(2.12,.13,.14,.04,dark,0,-.99,.53);
  // A continuous soft wrist strap instead of the original open torus.
  const path = new CatmullRomCurve3([
    new Vector3(-1.4,.9,0), new Vector3(-1.8,.4,.05), new Vector3(-1.95,-.9,.1),
    new Vector3(-1.65,-1.7,.2), new Vector3(-1.18,-1.84,.25), new Vector3(-1.46,-1.1,.1),
    new Vector3(-1.65,.15,0), new Vector3(-1.4,.9,0),
  ]);
  group.add(new Mesh(new TubeGeometry(path,80,.042,10,false),deep));
  box(.17,.48,.18,.06,deep,-1.77,-.05,.08);
  return group;
}

function buildFilmCard(): Group {
  const group = new Group();
  const paper = new Mesh(new RoundedBoxGeometry(2,1.58,.04,3,.035), new MeshStandardMaterial({color:'#fff8ec',roughness:.85}));
  group.add(paper);
  const inset = new Mesh(new PlaneGeometry(1.8,1.28),new MeshStandardMaterial({color:'#ee8f92',roughness:.65}));
  inset.position.set(0,.025,.023); group.add(inset);
  return group;
}

function brandTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 42px Fredoka, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("instax", 240, 58);
    ctx.font = "500 28px Fredoka, sans-serif";
    ctx.fillText("mini 13", 240, 96);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
