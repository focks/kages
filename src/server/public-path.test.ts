import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicPath } from "./public-path.ts";

test("anonymous readers reach shared project pages, markdown and their access-checked APIs", () => {
  const id = "7aa4d077-711e-4cf6-9660-25f58e1443b4";
  for (const path of [`/r/${id}`, `/r/${id}.md`, `/api/shared-repo/${id}`, `/api/shared-repo/${id}/md`, `/k/${id}`, `/k/${id}.md`, `/embed/${id}`]) assert.equal(isPublicPath(path), true, path);
});

test("sharing prefixes do not make workspace pages public", () => {
  for (const path of ["/", "/artifacts", "/preview/private-id", "/settings", "/reports", "/rendering", "/knowledge", "/api-keys", "/authentication", "/embedding"]) assert.equal(isPublicPath(path), false, path);
  for (const path of ["/login", "/auth/callback", "/docs", "/docs/authoring", "/render", "/landing"]) assert.equal(isPublicPath(path), true, path);
});


test("versioned CLI downloads are anonymous without exposing arbitrary download paths", () => {
  assert.equal(isPublicPath("/downloads/ifocksh-kages-0.1.2.tgz"), true);
  for (const path of ["/downloads", "/downloads/private.json", "/downloads/ifocksh-kages-0.1.2.tgz/extra"]) assert.equal(isPublicPath(path), false);
});
