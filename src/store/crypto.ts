// The trust primitives for the artifactory: a content digest and an ed25519
// signature over every version. These are what make a store that MANY different
// agents write to trustworthy — "nothing is anonymous and nothing is mutable"
// is enforced here, not by convention. A version's digest covers its canonical
// content, and the signature covers the digest, so tampering with either the
// bytes or the recorded hash is detectable by anyone holding the public key.

import { createCipheriv, createDecipheriv, randomBytes, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as nodeSign, verify as nodeVerify, type KeyObject } from "node:crypto";

type Json = unknown;

/** Serialize with keys sorted at every level so the SAME logical content always
 *  produces the SAME bytes — a digest is meaningless if {a,b} and {b,a} hash
 *  differently. Arrays keep their order (it is semantic); object key order is
 *  not, so we impose one. */
export function canonicalize(value: Json): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, Json> = Object.create(null);
    for (const k of Object.keys(v as Record<string, Json>).sort()) out[k] = sortKeys((v as Record<string, Json>)[k]);
    return out;
  }
  return v;
}

/** sha256 of the canonical form, as "sha256:<hex>" — the digest format stored
 *  on every version record. */
export function digest(value: Json): string {
  return "sha256:" + createHash("sha256").update(canonicalize(value)).digest("hex");
}

export interface SigningKey {
  keyId: string;
  publicKey: KeyObject;
  privateKey: KeyObject;
}

/** Mint an ed25519 keypair for an agent/workspace signer. One identity per
 *  signer, NOT per model — an agent keeps its key across the models it runs. */
export function newSigningKey(keyId: string): SigningKey {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { keyId, publicKey, privateKey };
}

export interface Signature {
  keyId: string;
  alg: "ed25519";
  sig: string; // base64
}

/** Sign a digest string. ed25519 takes the message directly (no pre-hash). */
export function signDigest(key: SigningKey, dgst: string): Signature {
  const sig = nodeSign(null, Buffer.from(dgst), key.privateKey);
  return { keyId: key.keyId, alg: "ed25519", sig: sig.toString("base64") };
}

/** Verify a signature over a digest against a known public key. */
export function verifyDigest(publicKey: KeyObject, dgst: string, signature: Signature): boolean {
  try {
    return nodeVerify(null, Buffer.from(dgst), publicKey, Buffer.from(signature.sig, "base64"));
  } catch {
    return false;
  }
}

/** A signer serialized as PEM, so a persistent store keeps the SAME identity
 *  across runs and signatures stay verifiable after a reload. Production exports
 *  encrypt private material with a separately configured wrapping secret. */
export interface SerializedKey {
  keyId: string;
  publicPem: string;
  privatePem?: string;
  encryptedPrivatePem?: { iv: string; tag: string; ciphertext: string };
}

export function exportKey(k: SigningKey): SerializedKey {
  return {
    keyId: k.keyId,
    publicPem: k.publicKey.export({ type: "spki", format: "pem" }) as string,
    ...sealPrivateKey(k.privateKey.export({ type: "pkcs8", format: "pem" }) as string),
  };
}

export function importKey(s: SerializedKey): SigningKey {
  return { keyId: s.keyId, publicKey: createPublicKey(s.publicPem), privateKey: createPrivateKey(openPrivateKey(s)) };
}

/** A database dump must not contain usable hosted signer keys. The wrapping key lives in operator secrets. */
function wrappingKey(): Buffer | undefined {
  const secret = process.env.KAGES_SIGNING_KEY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("KAGES_SIGNING_KEY_SECRET is required for production signing-key storage");
    return undefined;
  }
  if (!/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error("KAGES_SIGNING_KEY_SECRET must be 64 hexadecimal characters");
  return Buffer.from(secret, "hex");
}
function sealPrivateKey(pem: string): Pick<SerializedKey, "privatePem" | "encryptedPrivatePem"> {
  const key = wrappingKey();
  if (!key) return { privatePem: pem };
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  return { encryptedPrivatePem: { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") } };
}
function openPrivateKey(s: SerializedKey): string {
  // Legacy plaintext rows can be read and are encrypted on their next committed snapshot.
  if (!s.encryptedPrivatePem && s.privatePem) return s.privatePem;
  const key = wrappingKey(), sealed = s.encryptedPrivatePem;
  if (!key || !sealed) throw new Error("signing-key wrapping secret is required");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

/** Publication state is mutable; identity, authorship and ancestry are immutable evidence. */
export function provenanceDigest(v: import("./types.ts").VersionRecord): string {
  return digest({ ref: v.ref, parent: v.parent, name: v.name, uuid: v.uuid, v: v.v, digest: v.digest, createdAt: v.createdAt, author: v.author, change: v.change, resolved: v.resolved, validation: v.validation });
}

/** Legacy versions have content signatures only and cannot retrospectively attest provenance. */
export function verifyVersion(publicKey: KeyObject, v: import("./types.ts").VersionRecord): boolean {
  return digest(v.doc) === v.digest && verifyDigest(publicKey, v.digest, v.signature)
    && !!v.provenanceSignature && verifyDigest(publicKey, provenanceDigest(v), v.provenanceSignature);
}
