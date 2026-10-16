"use client";
// The public renderer always crosses the sandbox boundary, including Studio.
export { KageRenderer } from "./SandboxedKage.tsx";
export type { KageRendererProps } from "./EmbeddedKageRenderer.tsx";
