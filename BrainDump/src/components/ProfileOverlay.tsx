"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";

const CLIENT_AVATAR_MAX_BYTES = 320 * 1024;

type UserProfilePanelProps = {
  variant: "modal" | "page";
  /** When variant is modal, parent controls visibility; used to reset form when opening. */
  modalOpen?: boolean;
  onClose?: () => void;
  onOpenSettings?: () => void;
};

export function UserProfilePanel({
  variant,
  modalOpen = true,
  onClose,
  onOpenSettings,
}: UserProfilePanelProps) {
  const { t } = useI18n();
  const { data: session, status, update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const modalHydratedRef = useRef(false);

  useEffect(() => {
    if (variant !== "modal" || !modalOpen) {
      modalHydratedRef.current = false;
      return;
    }
    if (!session?.user) return;
    if (!modalHydratedRef.current) {
      modalHydratedRef.current = true;
      setName(session.user.name ?? "");
      setAvatar(session.user.image ?? null);
      setSaveError(null);
      setSaveOk(false);
    }
  }, [variant, modalOpen, session?.user]);

  useEffect(() => {
    if (variant !== "page" || status !== "authenticated" || !session?.user) return;
    setName(session.user.name ?? "");
    setAvatar(session.user.image ?? null);
  }, [variant, status, session?.user?.name, session?.user?.image]);

  const user = session?.user;
  const displayName = name.trim() || user?.email?.split("@")[0] || "—";
  const initial = (displayName[0] || "?").toUpperCase();

  const openFilePicker = () => fileRef.current?.click();

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setSaveError(t("profile.badImageType"));
      return;
    }
    if (f.size > CLIENT_AVATAR_MAX_BYTES) {
      setSaveError(t("profile.imageTooBig"));
      return;
    }
    setSaveError(null);
    setSaveOk(false);
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data === "string") setAvatar(data);
    };
    reader.readAsDataURL(f);
  };

  const removePhoto = () => {
    setAvatar(null);
    setSaveError(null);
    setSaveOk(false);
  };

  const save = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const body = {
        name: name.trim() || null,
        image: avatar,
      };
      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        setSaveError(data.error || t("profile.saveError"));
        return;
      }
      setSaveOk(true);
      await update();
    } catch {
      setSaveError(t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  }, [avatar, name, t, update, user?.id]);

  const openSettings = () => {
    onClose?.();
    onOpenSettings?.();
  };

  const openPrivacy = () => {
    window.open(`${window.location.origin}/privacy`, "_blank", "noopener,noreferrer");
  };

  const signOutUser = () => void signOut({ callbackUrl: "/" });

  const deleteAccount = async () => {
    if (!window.confirm(t("profile.deleteAccountConfirm"))) return;
    setDeleting(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/user/account", { method: "DELETE" });
      if (!r.ok) {
        setSaveError(t("profile.deleteAccountError"));
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setSaveError(t("profile.deleteAccountError"));
    } finally {
      setDeleting(false);
    }
  };

  if (status === "loading") {
    return (
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        {t("trash.loading")}
      </p>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <p style={{ margin: 0, color: "var(--text-secondary)" }}>
        <Link href="/login" className="bd-btn" style={{ display: "inline-block" }}>
          {t("auth.signIn")}
        </Link>
      </p>
    );
  }

  const inner = (
    <>
      <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
        {t("profile.subtitle")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <div style={{ position: "relative" }}>
          {avatar ? (
            <img
              src={avatar}
              alt=""
              width={88}
              height={88}
              referrerPolicy="no-referrer"
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid var(--border-default)",
                display: "block",
              }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.75rem",
                fontWeight: 700,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "2px solid var(--border-default)",
              }}
            >
              {initial}
            </span>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onFileSelected} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
          <button type="button" className="bd-btn" onClick={openFilePicker}>
            {t("profile.changePhoto")}
          </button>
          {avatar ? (
            <button type="button" className="bd-btn" onClick={removePhoto}>
              {t("profile.removePhoto")}
            </button>
          ) : null}
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textAlign: "center" }}>
          {t("profile.imageHint")}
        </span>
      </div>

      <label htmlFor="bd-profile-name" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
        {t("profile.displayName")}
      </label>
      <input
        id="bd-profile-name"
        className="bd-input"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaveOk(false);
          setSaveError(null);
        }}
        autoComplete="name"
        style={{ width: "100%", marginBottom: "1rem" }}
      />

      <div style={{ marginBottom: "1rem" }}>
        <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
          {t("profile.email")}
        </span>
        <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", wordBreak: "break-all" }}>{user.email ?? "—"}</span>
        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
          {t("profile.emailReadOnly")}
        </span>
      </div>

      {saveError ? (
        <p role="alert" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--danger, #c0392b)" }}>
          {saveError}
        </p>
      ) : null}
      {saveOk ? (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--accent)" }}>{t("profile.saved")}</p>
      ) : null}

      <button type="button" className="bd-btn bd-btn--primary" onClick={() => void save()} disabled={saving} style={{ width: "100%", marginBottom: "1.25rem" }}>
        {saving ? t("profile.saving") : t("profile.save")}
      </button>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {variant === "modal" ? (
          <Link href="/profile" className="bd-btn" style={{ textAlign: "center", textDecoration: "none" }} onClick={() => onClose?.()}>
            {t("profile.openFullPage")}
          </Link>
        ) : (
          <Link href="/" className="bd-btn" style={{ textAlign: "center", textDecoration: "none" }}>
            {t("profile.backToApp")}
          </Link>
        )}
        {onOpenSettings ? (
          <button type="button" className="bd-btn" onClick={openSettings} style={{ width: "100%" }}>
            {t("profile.openSettings")}
          </button>
        ) : null}
        <button type="button" className="bd-btn" onClick={openPrivacy} style={{ width: "100%" }}>
          {t("profile.openPrivacy")}
        </button>
        <button type="button" className="bd-btn" onClick={signOutUser} style={{ width: "100%" }}>
          {t("profile.signOut")}
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "1rem",
          borderRadius: "8px",
        }}
      >
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
          {t("profile.deleteAccountHelp")}
        </p>
        <button
          type="button"
          className="bd-btn"
          onClick={() => void deleteAccount()}
          disabled={deleting}
          style={{
            width: "100%",
            borderColor: "color-mix(in srgb, var(--danger, #e74c3c) 55%, transparent)",
            color: "var(--danger, #e74c3c)",
          }}
        >
          {t("profile.deleteAccount")}
        </button>
      </div>
    </>
  );

  if (variant === "page") {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href="/" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            ← {t("profile.backToApp")}
          </Link>
          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("profile.title")}</h1>
        </div>
        <div className="bd-panel" style={{ padding: "1.5rem", background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
          {inner}
        </div>
      </div>
    );
  }

  return inner;
}

/** Modal shell; body content is `UserProfilePanel` with `variant="modal"`. */
export function ProfileOverlay({
  isOpen,
  onClose,
  onOpenSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-profile-title"
      className="bd-modal-backdrop bd-settings-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bd-modal-panel bd-settings-modal-panel"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "440px",
          width: "100%",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bd-settings-modal-header"
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 id="bd-profile-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {t("profile.title")}
          </h2>
          <button type="button" onClick={onClose} className="bd-btn" style={{ padding: "0.25rem" }} aria-label={t("profile.close")}>
            ×
          </button>
        </div>
        <div className="bd-settings-modal-scroll">
          <div style={{ padding: "1.5rem" }}>
            <UserProfilePanel variant="modal" modalOpen={isOpen} onClose={onClose} onOpenSettings={onOpenSettings} />
          </div>
        </div>
      </div>
    </div>
  );
}
