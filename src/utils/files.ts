/** 在文件管理器中打开目录 / 定位文件 */
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "../store/ui";

/** 打开集合目录 */
export async function openCollectionDir(dir: string) {
  try {
    await invoke("ensure_dir", { path: dir });
    await openPath(dir);
  } catch {
    useUiStore.getState().setStatus("statusbar.openDirFailed");
  }
}

/** 在资源管理器中定位请求定义文件 */
export async function revealRequestFile(dir: string, requestId: string) {
  try {
    await revealItemInDir(`${dir}/requests/${requestId}.json`);
  } catch {
    useUiStore.getState().setStatus("statusbar.openDirFailed");
  }
}
