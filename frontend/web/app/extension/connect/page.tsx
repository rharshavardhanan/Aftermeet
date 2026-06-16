import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConnectToken } from "./connect-token";

export const dynamic = "force-dynamic";

// Authenticated handshake page for the Chrome extension: the user opens this
// from the extension popup, we mint a backend token, they copy it back into the
// popup. (Bearer tokens avoid the cross-origin cookie problem entirely.)
export default async function ExtensionConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/extension/connect");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <ConnectToken />
    </main>
  );
}
