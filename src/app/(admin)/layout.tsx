import { ReactNode } from "react";
import Navbar from "@/components/global/Navbar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { protectPage } from "@/utils/supabase/actions";

interface LayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: LayoutProps) {
  await protectPage(["admin"]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <section className="flex flex-1">
        <div className="hidden md:block h-auto flex-shrink-0 w-[280px] border-r">
          <AdminSidebar />
        </div>
        <div className="flex-grow min-w-0 overflow-x-hidden">{children}</div>
      </section>
    </div>
  );
}
