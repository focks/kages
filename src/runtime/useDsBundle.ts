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

const loading = new Map<string, Promise<KagesGlobal>>();

function loadBundle(base: string, integrity?: Record<string, string>): Promise<KagesGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const cached = loading.get(base);
  if (cached) return cached;

  window.React = React;
  window.ReactDOM = ReactDOM;

  // Pin the assets with Subresource Integrity when a hash manifest is served.
  // If bundle.js is swapped after a version was signed, the hash won't match and
  // the browser refuses to execute it — the lockfile's integrity guarantee,
  // enforced by the platform rather than trusted. Absent manifest → load plain.
  const pending = (integrity ? Promise.resolve(integrity) : fetch(`${base}/integrity.json`).then(r => {
    if (!r.ok) throw new Error("design-system integrity manifest unavailable");
    return r.json();
  }))
    .then((sri: Record<string, string>) => new Promise<KagesGlobal>((resolve, reject) => {
      if (!["bundle.js", "bundle.css", "tokens.css"].every(f => /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(sri[f] ?? ""))) { reject(new Error("incomplete design-system integrity manifest")); return; }
      const withSri = (el: HTMLLinkElement | HTMLScriptElement, file: string) => {
        if (sri[file]) { el.integrity = sri[file]; el.crossOrigin = "anonymous"; }
      };
      // tokens.css (scoped to .kg-kage) must load BEFORE bundle.css: the bundle
      // reads --paper, --space-4, --font-display and the rest, which only this
      // generated sheet defines. Without it every --kg-* resolves to nothing.
      const styles: Promise<void>[] = [];
      for (const file of ["tokens.css", "bundle.css"]) {
        if (document.querySelector(`link[data-ds-bundle="${file}"]`)) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${base}/${file}`;
        link.setAttribute("data-ds-bundle", file);
        withSri(link, file);
        styles.push(new Promise<void>((done, fail) => { link.onload = () => done(); link.onerror = () => fail(new Error(`failed to load ${file} (integrity?)`)); }));
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = `${base}/bundle.js`;
      script.async = true;
      withSri(script, "bundle.js");
      script.onload = () => { void Promise.all(styles).then(() => window.Kages ? resolve(window.Kages) : reject(new Error("bundle loaded but window.Kages is missing")), reject); };
      script.onerror = () => reject(new Error(`failed to load ${script.src} (integrity?)`));
      document.head.appendChild(script);
    }));
  loading.set(base, pending);
  return pending;
}

/** Load the DS bundle served under `base` (default /ds). Returns window.Kages or null while loading. */
export function useDsBundle(base = "/ds", integrity?: Record<string, string>): { kages: KagesGlobal | null; error: string | null } {
  const [kages, setKages] = useState<KagesGlobal | null>(typeof window !== "undefined" ? window.Kages ?? null : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadBundle(base, integrity).then(
      (k) => live && setKages(k),
      (e) => live && setError(String(e.message || e)),
    );
    return () => { live = false; };
  }, [base, integrity]);
  return { kages, error };
}
