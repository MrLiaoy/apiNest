import { useTranslation } from "react-i18next";
import CodeEditor from "./CodeEditor";
import type { RequestBody, RequestData } from "../../types/collection";

/**
 * SOAP 专属 Body：完整可编辑的 XML 报文区（对齐 SoapUI）。
 * 解析只是辅助：把 WSDL 生成的模板填进编辑器；也可以不解析直接粘贴报文。
 * 参数结构完全不受限（list / 嵌套 / 多值），改完直接发送。
 */
export default function SoapBodyPane({
  req,
  onChange,
}: {
  req: RequestData;
  onChange: (patch: Partial<RequestBody>) => void;
}) {
  const { t } = useTranslation();
  const hasContent = req.body.content.trim() !== "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
        <span className="auto-chip">SOAPAction: "{req.soapAction || req.operation || "—"}"</span>
        {req.endpoint && (
          <span className="truncate font-mono text-[11px]" title={req.endpoint}>
            → {req.endpoint}
          </span>
        )}
        <span className="ml-auto">{t("editor.soapEditableHint")}</span>
      </div>
      {!hasContent && <div className="soap-tip">{t("editor.soapHint")}</div>}
      <CodeEditor
        value={req.body.content}
        onChange={(content) => onChange({ content })}
      />
    </div>
  );
}
