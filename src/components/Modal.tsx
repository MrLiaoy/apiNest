import { useEffect, type ReactNode } from "react";

/** 通用弹窗：遮罩点击 / Esc 关闭 */
export default function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35"
      onMouseDown={onClose}
    >
      <div
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[80vh] overflow-y-auto rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-center border-b border-line px-5 py-3">
          <span className="text-[14px] font-semibold text-ink">{title}</span>
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 rounded text-ink-3 hover:bg-panel-2 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
