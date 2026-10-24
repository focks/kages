// A long-lived MCP process must re-read login state per call. Never let logout
// or an expired session silently redirect an intended cloud write into .kages.
export function mcpDestination(signedIn: boolean, explicitLocal: boolean): 'cloud' | 'local' | 'setup' {
  return explicitLocal ? 'local' : signedIn ? 'cloud' : 'setup';
}
