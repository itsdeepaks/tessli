"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./live-preview.module.css";

type LivePreview = Readonly<{
  resourceId: string;
  src: string;
}>;

// This is intentionally a closed, source-ID keyed allowlist. Do not accept a
// provider URL or derive one from the catalogue at runtime.
const livePreviewAllowlist: readonly LivePreview[] = [
  {
    resourceId: "resource-affc29967a7c",
    src: "https://ui.shadcn.com",
  },
];

function getLivePreview(resourceId: string) {
  return livePreviewAllowlist.find(
    (preview) => preview.resourceId === resourceId,
  );
}

export function LivePreview({
  resourceId,
  resourceName,
}: Readonly<{
  resourceId: string;
  resourceName: string;
}>) {
  const preview = getLivePreview(resourceId);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      requestAnimationFrame(() => openerRef.current?.focus());
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  if (!preview) return null;

  const frameId = `live-preview-${resourceId}`;

  function closePreview() {
    setIsOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  return (
    <section
      aria-labelledby={`${frameId}-title`}
      className={styles.preview}
      data-live-preview-pilot
    >
      <div className={styles.intro}>
        <div>
          <p className={styles.kicker}>Optional human preview</p>
          <h2 id={`${frameId}-title`}>Live preview</h2>
        </div>
        <button
          aria-controls={frameId}
          aria-describedby={`${frameId}-description`}
          aria-expanded={isOpen}
          className={styles.launch}
          data-live-preview-launch
          onClick={() => setIsOpen(true)}
          ref={openerRef}
          type="button"
        >
          Open live preview
        </button>
      </div>
      <p id={`${frameId}-description`} className={styles.description}>
        This optional preview is for human review only, not agent access. It may
        be unavailable if provider framing changes.
      </p>
      {isOpen ? (
        <div className={styles.frameWrap} id={frameId}>
          <div className={styles.frameBar}>
            <p aria-live="polite" className={styles.status}>
              Live preview active for {resourceName}.
            </p>
            <button
              className={styles.close}
              data-live-preview-close
              onClick={closePreview}
              type="button"
            >
              Close live preview
            </button>
          </div>
          <iframe
            className={styles.frame}
            data-live-preview-frame
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts"
            src={preview.src}
            title={`${resourceName} live preview`}
          />
        </div>
      ) : null}
    </section>
  );
}
