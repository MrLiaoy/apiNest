import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { lineNumbers } from "@codemirror/view";
import { json } from "@codemirror/lang-json";

/** 通用代码编辑器（CodeMirror 6）：language 传 "json" 启用 JSON 高亮，其他语言纯文本 */
export default function CodeEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (v: string) => void;
  language?: "json";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const extensions = [
      lineNumbers(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current(u.state.doc.toString());
      }),
    ];
    if (language === "json") extensions.push(json());
    const view = new EditorView({
      doc: value,
      extensions,
      parent: hostRef.current!,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 仅挂载一次；切换请求由父组件用 key 重挂载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部值变化（如「格式化」/ 解析生成模板）同步进编辑器
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      className="cm-host max-h-[420px] overflow-auto rounded-lg border border-line"
    />
  );
}
