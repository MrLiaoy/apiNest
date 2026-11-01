/** 发送当前激活页签的请求（请求栏按钮 / Ctrl+Enter 共用） */
import { findNode, useCollectionStore } from "../store/collection";
import { useTabsStore } from "../store/tabs";
import { useResponseStore } from "../store/response";
import { useUiStore } from "../store/ui";
import { buildSendOptions } from "./send";
import { soapToSendOptions } from "./soap";

export function sendActiveRequest(): void {
  const { tabs, activeTabId } = useTabsStore.getState();
  const tab = tabs.find((t) => t.tabId === activeTabId);
  if (!tab) return;
  const node = findNode(useCollectionStore.getState().items, tab.nodeId);
  if (!node || node.type !== "request") return;

  const setStatus = useUiStore.getState().setStatus;
  const send = useResponseStore.getState().send;

  if (node.kind === "soap") {
    const r = node.request;
    if (!r.body.content.trim()) {
      setStatus("editor.soapEmpty");
      return;
    }
    void send(
      node.id,
      soapToSendOptions(r),
      {
        name: node.name,
        kind: "soap",
        method: "SOAP",
        url: r.endpoint || r.wsdl || r.url,
        request: r,
      }
    );
    return;
  }

  const opts = buildSendOptions(node.request);
  void send(
    node.id,
    opts,
    {
      name: node.name,
      kind: "rest",
      method: node.request.method,
      url: opts.url,
      request: node.request,
    }
  );
}
