"use client";

import { useEffect, useMemo, useState } from "react";

type QrLauncherProps = {
  shareUrl: string;
};

export function QrLauncher({ shareUrl }: QrLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const qrImageUrl = useMemo(() => {
    const encodedUrl = encodeURIComponent(shareUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodedUrl}`;
  }, [shareUrl]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex-1 rounded-[16px] border border-[color:var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow-soft)] transition-colors hover:bg-white sm:flex-none"
      >
        QR
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.78)] px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Cerrar modal QR"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-[28px] bg-[var(--surface-strong)] px-5 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:max-w-md sm:px-8">
            <div className="w-full text-right">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-border bg-white px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-background"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-2 flex w-full flex-col items-center gap-4">
              <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--ink)]">
                Escanea este QR
              </h2>
              <p className="max-w-xl text-center text-sm leading-6 text-muted">
                Comparte este acceso directo para abrir el registro de almuerzo.
              </p>
              <div className="w-full max-w-[320px] rounded-[24px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,27,36,0.08)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt="Código QR para abrir el registro de almuerzo"
                  className="block h-auto w-full"
                />
              </div>
              <p className="break-all text-center text-xs leading-5 text-muted">
                {shareUrl}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
