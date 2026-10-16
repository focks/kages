// The guided builder moved into the documentation, where a one-time lesson belongs.
// This keeps old links, bookmarks and the pilot protocol working.
import { redirect } from "next/navigation";

export default function GuideRedirect() {
  redirect("/docs/build-a-guide");
}
