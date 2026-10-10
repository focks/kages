// Public client config — lets the CLI (or any client) discover how to sign in
// to THIS deployment given only its URL. Returns the public browser values only
// (never the service key). Used by `kages auth login`.

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  return Response.json({ authEnabled: !!(url && anonKey), supabaseUrl: url, anonKey });
}
