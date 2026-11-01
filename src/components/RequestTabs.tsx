import { useTranslation } from "react-i18next";

export type EditorPaneKey = "params" | "body" | "headers" | "auth" | "history";

const PANES: EditorPaneKey[] = ["params", "body", "headers", "auth", "history"];

/**
 * 请求编辑 Tab 行。「历史」固定在最右侧、与「认证」之间留间隙（核心设计）。
 * SOAP 请求只显示 Body│认证│历史（参数对 SOAP 无意义、Headers 自动注入）。
 */
export default function RequestTabs({
  active,
  onSelect,
  paramCount,
  headerCount,
  historyCount = 0,
  soapMode = false,
}: {
  active: EditorPaneKey;
  onSelect: (k: EditorPaneKey) => void;
  paramCount: number;
  headerCount: number;
  historyCount?: number;
  soapMode?: boolean;
}) {
  const { t } = useTranslation();
  const counts: Partial<Record<EditorPaneKey, number>> = {
    params: paramCount,
    headers: headerCount,
    history: historyCount,
  };
  const visible = PANES.filter(
    (p) => !soapMode || (p !== "params" && p !== "headers")
  );

  return (
    <div className="flex border-b border-line px-4">
      {visible.map((key) => {
        const count = counts[key] ?? 0;
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            className={`-mb-px cursor-pointer border-b-2 px-3.5 pb-2.5 pt-2 text-[12.5px] ${
              active === key
                ? "border-accent font-medium text-accent"
                : "border-transparent text-ink-2 hover:text-ink"
            } ${key === "history" ? "hist-tab" : ""}`}
          >
            {key === "history" ? "🕐 " : ""}
            {t(`tabs.${key}`)}
            {count > 0 && (
              <span className="ml-1 rounded-full bg-accent-soft px-1.5 text-[10px] text-accent">
                {count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
