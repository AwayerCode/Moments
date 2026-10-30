import { useState } from "react";
import { InstaxCamera } from "../components/InstaxCamera.tsx";
import { createSession } from "../lib/api.ts";

export function EntryPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmitName(name: string) {
    setBusy(true);
    setError("");
    try {
      const result = await createSession(name);
      if (result.ok) {
        window.location.assign("/gallery");
        return;
      }
      setError(result.error ?? "名字不对哦");
    } catch {
      setError("现在进不去，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sky-page">
      <div className="sky-glow" aria-hidden />
      <div className="clouds" aria-hidden>
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
        <span className="cloud c4" />
      </div>
      <h1 className="brand-title">Sisi Moments</h1>
      <InstaxCamera busy={busy} error={error} onSubmitName={onSubmitName} />
      <p className={`entry-error ${error ? "visible" : ""}`} role="status">
        {error}
      </p>
    </main>
  );
}
