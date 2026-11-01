import { useEffect, type RefObject } from "react";

/**
 * 点击元素外部时触发回调（用于下拉框自动收起）。
 * 用 mousedown 而非 click：在其他元素的 click 处理之前先收起，避免闪现。
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside, active]);
}
