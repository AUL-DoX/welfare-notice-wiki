"use client";

import type { MouseEvent, ReactNode } from "react";

type SourceFileLinkProps = {
  slug: string;
  className?: string;
  children: ReactNode;
};

export function SourceFileLink({ slug, className, children }: SourceFileLinkProps) {
  const href = `/api/files/${encodeURIComponent(slug)}`;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (opened) {
      event.preventDefault();
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
