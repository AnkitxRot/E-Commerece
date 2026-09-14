import { useEffect } from 'react';

/** Keeps the browser tab title in sync with the page's content, per WCAG 2.4.2 (Page Titled). */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
