import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../store/ui";
import { useClickOutside } from "../hooks/useClickOutside";

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type Method = (typeof METHODS)[number];

/** URL 输入框：contentEditable，仅切换标签时同步外部值（避免输入中被重渲染打断） */
function UrlBox({
  value,
  resetKey,
  onChange,
}: {
  value: string;
  resetKey: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 内容相同不写 DOM（保护输入光标）；参数表等外部改动则立即同步
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, value]);

  return (
    <div
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      data-placeholder="http://"
      onKeyDown={(e) => {
        // URL 栏不允许换行
        if (e.key === "Enter") e.preventDefault();
      }}
      onPaste={(e) => {
        // 只接收纯文本，并剥离粘贴内容中的换行
        e.preventDefault();
        const text = (e.clipboardData.getData("text/plain") || "").replace(/[\r\n]+/g, "");
        document.execCommand("insertText", false, text);
      }}
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      className="url-box"
    />
  );
}

interface Props {
  method: string;
  url: string;
  /** SOAP 请求类型锁定，方法不可改 */
  locked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** SOAP：显示「解析」按钮（WSDL → 参数模板） */
  showParse?: boolean;
  parseLoading?: boolean;
  resetKey: string;
  onMethodChange: (m: Method) => void;
  onUrlChange: (u: string) => void;
  onSend: () => void;
  onParse?: () => void;
}

/** ③ 请求栏：方法下拉 + URL + 发送（发送链路在任务 04 接入） */
export default function RequestBar({
  method,
  url,
  locked = false,
  disabled = false,
  loading = false,
  showParse = false,
  parseLoading = false,
  resetKey,
  onMethodChange,
  onUrlChange,
  onSend,
  onParse,
}: Props) {
  const { t } = useTranslation();
  const setStatus = useUiStore((s) => s.setStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const methodRef = useRef<HTMLDivElement>(null);

  useClickOutside(methodRef, () => setMenuOpen(false), menuOpen);

  return (
    <div className={`flex items-center gap-2 px-4 pb-2.5 pt-3 ${disabled ? "opacity-50" : ""}`}>
      {/* 方法下拉 */}
      <div className="relative w-24 shrink-0" ref={methodRef}>
        <button
          onClick={() => {
            if (disabled) return;
            if (locked) {
              setStatus("editor.soapLocked");
              return;
            }
            setMenuOpen((v) => !v);
          }}
          className={`flex h-[34px] w-full items-center justify-between rounded-md border border-line bg-panel-2 px-2.5 text-[12.5px] font-bold ${
            locked ? "m-SOAP" : `m-${method}`
          } ${disabled ? "cursor-not-allowed" : locked ? "cursor-not-allowed" : ""}`}
        >
          {locked ? "SOAP" : method}
          <span className="text-[9px] text-ink-3">▼</span>
        </button>
        {menuOpen && !locked && !disabled && (
          <div className="absolute left-0 top-[38px] z-50 w-[110px] rounded-lg border border-line bg-panel p-1 shadow-lg">
            {METHODS.map((m) => (
              <div
                key={m}
                onClick={() => {
                  onMethodChange(m);
                  setMenuOpen(false);
                }}
                className={`cursor-pointer rounded px-2.5 py-1.5 text-xs font-bold hover:bg-panel-2 m-${m}`}
              >
                {m}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URL 输入 */}
      <UrlBox value={url} resetKey={resetKey} onChange={onUrlChange} />

      {/* SOAP：WSDL 解析 */}
      {showParse && (
        <button
          onClick={() => !parseLoading && onParse?.()}
          className="parse-btn"
        >
          {parseLoading ? "⏳" : "🔍"} {t("editor.parse")}
        </button>
      )}

      {/* 发送 */}
      <button
        onClick={() => {
          if (!disabled && !loading) onSend();
        }}
        disabled={disabled || loading}
        className={`h-[34px] shrink-0 rounded-md bg-accent px-5 text-[13px] font-semibold text-white hover:brightness-110 active:scale-95 ${
          loading ? "opacity-70" : ""
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        {loading ? "⏳" : "➤"} {t("editor.send")}
      </button>
    </div>
  );
}
