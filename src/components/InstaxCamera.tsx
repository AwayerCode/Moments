import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { InstaxScene } from "../three/instax/createInstaxScene.ts";

type Props = {
  busy: boolean;
  error: string;
  onSubmitName: (name: string) => void;
};

export function InstaxCamera({ busy, error, onSubmitName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shakeRef = useRef<(amount: number) => void>(() => {});
  const [name, setName] = useState("");
  const [fallback, setFallback] = useState(false);
  const [cardReady, setCardReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let ready = false;
    let cancelled = false;
    let scene: InstaxScene | null = null;
    const started = performance.now();

    void import("../three/instax/createInstaxScene.ts").then(({ createInstaxScene }) => {
      if (cancelled) {
        return;
      }
      scene = createInstaxScene(canvas, {
        onFrame() {
          scene?.setEject(Math.min(1, (performance.now() - started) / 780));
          const rect = scene?.projectCard();
          const form = formRef.current;
          if (!form || !rect) {
            return;
          }
          form.style.left = `${rect.x}px`;
          form.style.top = `${rect.y}px`;
          form.style.width = `${rect.width}px`;
          form.style.height = `${rect.height}px`;
          form.style.opacity = String(
            Math.min(1, (rect.visible - 0.55) / 0.45),
          );
          if (!ready && rect.visible > 0.92) {
            ready = true;
            setCardReady(true);
            window.setTimeout(() => inputRef.current?.focus(), 40);
          }
        },
      });
      shakeRef.current = scene.setShake;
    }).catch(() => {
      if (cancelled) return;
      setFallback(true);
      setCardReady(true);
    });

    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }
    shakeRef.current(1);
    formRef.current?.classList.remove("shake");
    void formRef.current?.offsetWidth;
    formRef.current?.classList.add("shake");
  }, [error]);

  function submit() {
    const next = name.trim();
    if (!next || busy) {
      return;
    }
    onSubmitName(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    submit();
  }

  return (
    <div className="camera-stage">
      <canvas
        ref={canvasRef}
        className="instax-canvas"
        aria-label="instax mini 13"
      />
      <form
        ref={formRef}
        className={`film-card-overlay ${cardReady ? "ready" : ""} ${fallback ? "fallback" : ""}`}
        onSubmit={onSubmit}
      >
        <label className="name-label" htmlFor="guest-name">
          名字
        </label>
        <input
          id="guest-name"
          ref={inputRef}
          className="name-input"
          type="text"
          name="name"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          disabled={busy}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </form>
    </div>
  );
}
