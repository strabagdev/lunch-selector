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
        className="fixed right-4 top-4 z-40 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold shadow-[0_12px_32px_rgba(29,29,27,0.14)] transition-colors hover:bg-background sm:right-5 sm:top-5"
      >
        QR
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(29,29,27,0.82)] px-6 py-8">
          <button
            type="button"
            aria-label="Cerrar modal QR"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative z-10 flex w-full max-w-2xl flex-col items-center rounded-[2rem] bg-surface px-6 py-8 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:px-10">
            <div className="w-full text-right">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 flex w-full flex-col items-center gap-5">
              <h2 className="text-center text-2xl font-semibold tracking-tight">
                Escanea este QR
              </h2>
              <p className="max-w-xl text-center text-sm leading-6 text-muted">
                Comparte este acceso directo para abrir el registro de almuerzo.
              </p>
              <div className="w-full max-w-[420px] rounded-[2rem] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(222,214,200,0.9)]">
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
