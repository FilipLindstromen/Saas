"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

/**
 * Settings modal for OpenAI API key.
 * Uses shared apiKeys storage so the key is shared across all Saas apps.
 */
export function ApiKeySettings({ isOpen, onClose, onSave }: ApiKeySettingsProps) {
  const [openaiKey, setOpenaiKey] = useState("");

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      try {
        const { loadApiKeys } = require("@shared/apiKeys");
        const keys = loadApiKeys();
        setOpenaiKey(keys.openai || "");
      } catch {
        setOpenaiKey("");
      }
    }
  }, [isOpen]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { saveApiKeys } = require("@shared/apiKeys");
      saveApiKeys({ openai: openaiKey.trim() });
      onSave?.();
      onClose();
    } catch (err) {
      console.error("Failed to save API key:", err);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="w-full max-w-md rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
          Settings
        </h2>
        <p className="mb-4 text-sm text-[var(--text-tertiary)]">
          API keys are shared across all Saas apps and stored locally in your browser only.
        </p>
        <form onSubmit={handleSave}>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            OpenAI API Key
          </label>
          <Input
            type="password"
            placeholder="sk-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            className="mb-4"
            autoComplete="off"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
