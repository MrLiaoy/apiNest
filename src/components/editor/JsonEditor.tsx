import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { lineNumbers } from "@codemirror/view";
import { json } from "@codemirror/lang-json";

/** JSON 编辑器（CodeMirror 6）：行号 / 换行 / 明暗主题走 CSS 变量 */
export default function JsonEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const view = new EditorView({
      doc: value,
      extensions: [
        lineNumbers(),
        json(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
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

  // 外部值变化（如「格式化」按钮）同步进编辑器
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="cm-host overflow-auto rounded-lg border border-line" />;
}
