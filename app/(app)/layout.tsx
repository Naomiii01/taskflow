import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Middleware already guards unauthenticated access; this is a defensive
  // fallback (e.g. the taskflow.users row hasn't been created yet).
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-x-hidden bg-muted/30 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
