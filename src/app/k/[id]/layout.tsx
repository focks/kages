import { agentNotice } from "@/server/agent-notice";

// A server layout, so the note is in the HTML a plain fetch receives, not only after the client page loads.
// Visually hidden with the clip pattern rather than display:none, which text extraction would skip. It is
// deliberately not aria-hidden: accessibility-tree readers (browser-driving agents) would drop it too.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { other: { "agent-instructions": agentNotice(id) } };
}

export default async function ShareLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div data-agent-instructions style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0 }}>
        {agentNotice(id)}
      </div>
      {children}
    </>
  );
}
