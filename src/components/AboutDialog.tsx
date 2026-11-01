import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import Modal from "./Modal";
import Logo from "./Logo";
import { useUiStore } from "../store/ui";

/** 关于弹窗：版本 / 简介 / 合规声明 */
export default function AboutDialog() {
  const { t } = useTranslation();
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <Modal title={t("about.title")} onClose={() => setAboutOpen(false)} width={420}>
      <div className="flex items-center gap-3">
        <Logo size={40} />
        <div>
          <div className="text-[15px] font-semibold text-ink">{t("app.name")}</div>
          <div className="text-xs text-ink-3">
            {t("about.version")} {version || "1.0.0"}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-ink-2">{t("about.desc")}</p>
    </Modal>
  );
}
