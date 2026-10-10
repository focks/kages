"use client";

// Loads a design-system bundle (the trusted, versioned, SRI-pinnable code the
// spec describes) into the page exactly once and hands back window.Kages. The
// bundle is a browser IIFE that reads window.React and attaches its component
// implementations + `systems`/`contracts` to window.Kages, so we MUST publish
// our React onto window before the script evaluates — otherwise the bundle
// grabs an undefined React and every component throws on first render. We reuse
// the app's own React instance (not a second copy) so the bundle's elements are
// the same element type our tree renders; a mismatched duplicate React would
// fail with the classic "invalid hook call" / cross-renderer errors.

import { useEffect, useState } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";

type KagesGlobal = Record<string, unknown> & { systems: unknown; contracts: unknown };

declare global {
  interface Window {
    React?: typeof React;
    ReactDOM?: typeof ReactDOM;
    Kages?: KagesGlobal;
  }
}

let loading: Promise<KagesGlobal> | null = null;

function loadBundle(base: string): Promise<KagesGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Kages) return Promise.resolve(window.Kages);
  if (loading) return loading;

  window.React = React;
  window.ReactDOM = ReactDOM;

  // tokens.css (scoped to .kg-kage) must load BEFORE bundle.css: the bundle
  // reads --paper, --space-4, --font-display and the rest, which only this
  // generated sheet defines. Without it every --kg-* resolves to nothing.
  for (const file of ["tokens.css", "bundle.css"]) {
    if (document.querySelector(`link[data-ds-bundle="${file}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${base}/${file}`;
    link.setAttribute("data-ds-bundle", file);
    document.head.appendChild(link);
  }

  loading = new Promise<KagesGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${base}/bundle.js`;
    script.async = true;
    script.onload = () => (window.Kages ? resolve(window.Kages) : reject(new Error("bundle loaded but window.Kages is missing")));
    script.onerror = () => reject(new Error(`failed to load ${script.src}`));
    document.head.appendChild(script);
  });
  return loading;
}

/** Load the DS bundle served under `base` (default /ds). Returns window.Kages or null while loading. */
export function useDsBundle(base = "/ds"): { kages: KagesGlobal | null; error: string | null } {
  const [kages, setKages] = useState<KagesGlobal | null>(typeof window !== "undefined" ? window.Kages ?? null : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadBundle(base).then(
      (k) => live && setKages(k),
      (e) => live && setError(String(e.message || e)),
    );
    return () => { live = false; };
  }, [base]);
  return { kages, error };
}
