import { useTranslation } from "react-i18next";
import type { AuthConfig } from "../../types/collection";

/** 认证编辑：无认证 / Bearer / Basic / API Key（发送时自动注入） */
export default function AuthEditor({
  auth,
  onChange,
}: {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}) {
  const { t } = useTranslation();

  const pill = (key: AuthConfig["type"]) =>
    `cursor-pointer rounded-md border px-3 py-1.5 text-xs ${
      auth.type === key
        ? "border-accent bg-accent-soft font-medium text-accent"
        : "border-line text-ink-2 hover:bg-panel-2"
    }`;

  const input =
    "h-8 w-full rounded-md border border-line bg-panel-2 px-2.5 font-mono text-xs text-ink outline-none focus:border-accent focus:bg-panel";
  const label = "mb-1 text-[11.5px] text-ink-3";

  const TYPES: { key: AuthConfig["type"]; label: string }[] = [
    { key: "none", label: t("editor.authNone") },
    { key: "bearer", label: t("editor.authBearer") },
    { key: "basic", label: t("editor.authBasic") },
    { key: "apikey", label: t("editor.authApiKey") },
  ];

  return (
    <div className="max-w-[560px]">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TYPES.map(({ key, label: l }) => (
          <div key={key} onClick={() => onChange({ type: key })} className={pill(key)}>
            {l}
          </div>
        ))}
      </div>

      {auth.type === "none" && (
        <p className="py-4 text-xs text-ink-3">{t("editor.authNoneHint")}</p>
      )}

      {auth.type === "bearer" && (
        <div>
          <div className={label}>{t("editor.authToken")}</div>
          <input
            type="text"
            value={auth.token ?? ""}
            onChange={(e) => onChange({ ...auth, token: e.target.value })}
            placeholder="eyJhbGciOi..."
            className={input}
          />
        </div>
      )}

      {auth.type === "basic" && (
        <div className="flex flex-col gap-3">
          <div>
            <div className={label}>{t("editor.authUsername")}</div>
            <input
              type="text"
              value={auth.username ?? ""}
              onChange={(e) => onChange({ ...auth, username: e.target.value })}
              className={input}
            />
          </div>
          <div>
            <div className={label}>{t("editor.authPassword")}</div>
            <input
              type="password"
              value={auth.password ?? ""}
              onChange={(e) => onChange({ ...auth, password: e.target.value })}
              className={input}
            />
          </div>
        </div>
      )}

      {auth.type === "apikey" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <div className={label}>{t("editor.authKey")}</div>
              <input
                type="text"
                value={auth.keyName ?? ""}
                onChange={(e) => onChange({ ...auth, keyName: e.target.value })}
                placeholder="X-API-Key"
                className={input}
              />
            </div>
            <div className="flex-1">
              <div className={label}>{t("editor.authKeyValue")}</div>
              <input
                type="text"
                value={auth.keyValue ?? ""}
                onChange={(e) => onChange({ ...auth, keyValue: e.target.value })}
                className={input}
              />
            </div>
          </div>
          <div>
            <div className={label}>{t("editor.authInject")}</div>
            <div className="flex gap-1.5">
              <div
                onClick={() => onChange({ ...auth, location: "header" })}
                className={pill("none") + (auth.location !== "query" ? " !border-accent !bg-accent-soft !text-accent" : "")}
              >
                {t("editor.authToHeader")}
              </div>
              <div
                onClick={() => onChange({ ...auth, location: "query" })}
                className={pill("none") + (auth.location === "query" ? " !border-accent !bg-accent-soft !text-accent" : "")}
              >
                {t("editor.authToQuery")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
