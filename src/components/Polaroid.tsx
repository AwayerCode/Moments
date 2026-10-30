import type { MomentItem } from "../lib/api.ts";
import { BokehPhoto } from "./BokehPhoto.tsx";

type Props = {
  item: MomentItem;
  onSelect: (item: MomentItem) => void;
};

export function Polaroid({ item, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`polaroid pin-${item.pin} ${item.width < 140 ? "polaroid-small" : ""}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        transform: `rotate(${item.rotate}deg)`,
      }}
      onClick={() => onSelect(item)}
      aria-label={item.caption}
    >
      <span className="magnet" />
      <BokehPhoto palette={item.palette} />
      <span className="caption">{item.caption}</span>
    </button>
  );
}
