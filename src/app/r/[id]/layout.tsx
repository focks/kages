import { repoNotice } from "@/server/agent-notice";

// Same reasoning as the /k layout: a server layout so the note is in the HTML a plain fetch receives.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { other: { "agent-instructions": repoNotice(id) } };
}

export default async function ProjectShareLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div data-agent-instructions style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0 }}>
        {repoNotice(id)}
      </div>
      {children}
    </>
  );
}
