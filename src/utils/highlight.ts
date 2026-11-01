/** JSON / XML 语法高亮（源自界面原型，已做 HTML 转义，可安全 innerHTML） */

export function highlightJson(json: string): string {
  const esc = json.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc.replace(
    /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?)/g,
    (m) => {
      let cls = "j-num";
      if (/^"/.test(m)) cls = /:\s*$/.test(m) ? "j-key" : "j-str";
      else if (/true|false/.test(m)) cls = "j-bool";
      else if (/null/.test(m)) cls = "j-null";
      return `<span class="${cls}">${m}</span>`;
    }
  );
}

export function highlightXml(xml: string): string {
  const esc = xml.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc.replace(
    /(&lt;\/?)([\w:.]+)|([\w:.]+)(=)("[^"]*")|(\/?&gt;)/g,
    (_m, open, tag, attr, eq, val, close) => {
      if (open !== undefined) return open + '<span class="x-tag">' + tag + "</span>";
      if (attr !== undefined)
        return (
          '<span class="x-attr">' +
          attr +
          "</span>" +
          eq +
          '<span class="x-str">' +
          val +
          "</span>"
        );
      return '<span class="x-tag">' + close + "</span>";
    }
  );
}

/** 大于 1MB 的响应不做 JSON 格式化（防卡顿）；格式化失败原样返回 */
export function prettyIfJson(text: string): string {
  if (text.length > 1024 * 1024) return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
