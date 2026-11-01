import { useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";

export interface FloatingMenuItem {
  key: string;
  label: string;
  icon?: string;
  /** 有子菜单的项：点击展开子项，onClick 收到子项 key */
  sub?: { key: string; label: string }[];
  onClick?: (subKey?: string) => void;
}

/** 右键/浮动菜单：支持二级子菜单（点击展开） */
export default function FloatingMenu({
  x,
  y,
  items,
  onClose,
  width = 190,
}: {
  x: number;
  y: number;
  items: FloatingMenuItem[];
  onClose: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, true);
  const [openSub, setOpenSub] = useState<string | null>(null);

  const left = Math.min(x, window.innerWidth - width - 8);
  const top = Math.min(y, Math.max(window.innerHeight - 300, 8));

  return (
    <div
      ref={ref}
      className="fixed z-[120] rounded-lg border border-line bg-panel p-1 shadow-xl"
      style={{ left, top, width }}
    >
      {items.map((item) => (
        <div key={item.key}>
          <div
            onClick={() => {
              if (item.sub) {
                setOpenSub(openSub === item.key ? null : item.key);
              } else {
                item.onClick?.();
                onClose();
              }
            }}
            className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs text-ink hover:bg-panel-2"
          >
            {item.icon && <span>{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.sub && (
              <span className="text-[9px] text-ink-3">▶</span>
            )}
          </div>
          {item.sub && openSub === item.key && (
            <div className="mb-1 ml-3 border-l border-line pl-1">
              {item.sub.map((s) => (
                <div
                  key={s.key}
                  onClick={() => {
                    item.onClick?.(s.key);
                    onClose();
                  }}
                  className="cursor-pointer rounded px-3 py-1.5 text-xs text-ink-2 hover:bg-panel-2"
                >
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
