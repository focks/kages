// Read all of stdin for the hook, bounded and never hanging: with a terminal attached
// (a person ran `kages hook` by hand) there is nothing to read.
export async function readStdin(limit = 1024 * 1024 + 1, stream: NodeJS.ReadStream = process.stdin): Promise<string> {
  if (stream.isTTY) return "";
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of stream) {
    const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
    size += b.length;
    if (size > limit) return "x".repeat(limit); // over the limit: the runner treats it as too big and stays silent
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString("utf8");
}
