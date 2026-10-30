import type { Palette } from "../lib/api.ts";

type Props = {
  palette: Palette;
  className?: string;
};

export function BokehPhoto({ palette, className = "" }: Props) {
  return (
    <div className={`bokeh bokeh-${palette} ${className}`.trim()} aria-hidden>
      <span className="orb o1" />
      <span className="orb o2" />
      <span className="orb o3" />
      <span className="orb o4" />
      <span className="orb o5" />
      <span className="orb o6" />
    </div>
  );
}
