"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
// Avatar removed for mobile menu; using hamburger icon
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggler from "./ThemeToggler";
import Logout from "../auth/Logout";
import { User as SupabaseUser } from "@supabase/auth-js";
import { createClient } from "@/utils/supabase/client";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const Navbar = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = createClient();
  const pathname = usePathname();

  interface NavLinkProps {
    href: string;
    children: ReactNode;
  }

  // PREPARING THE NAVLINK WITH ACTIVE LINK
  const NavLink = ({ href, children }: NavLinkProps) => {
    const isActive = pathname === href;

    return (
      <Link
        href={href}
        className={`text-white dark:text-white px-3 py-2 text-sm font-medium hover:bg-gray-700 hover:text-white ${
          isActive
            ? "border-b-4 border-indigo-500 text-gray-900"
            : "border-b-4 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
        }`}
      >
        {children}
      </Link>
    );
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    fetchUser(); // Fetch user on initial load

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // console.log("User:", user);

  return (
    <div className="bg-slate-700 dark:bg-slate-700 py-2 px-5 flex justify-between">
      <Link href={"/"}>
        <Image
          src={
            "https://res.cloudinary.com/dyb0qa58h/image/upload/v1696245158/company-4-logo_syxli0.png"
          }
          alt="Cyberize"
          width={40}
          height={40}
        />
      </Link>

      {/* NAVIGATION */}
      <nav className="hidden sm:ml-6 sm:flex flex-grow justify-center items-center">
        <NavLink href="/admin-portal">Dashboard</NavLink>
        <NavLink href="/profile">Profile</NavLink>
        <NavLink href="/settings">Settings</NavLink>
      </nav>

      {/* Right side: dark mode, email, and hamburger menu */}
      <div className="flex items-center gap-3">
        {/* <ThemeToggler /> */}

        {user && <span className="text-white">{user.email}</span>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open Menu">
              <Menu className="h-5 w-5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white dark:bg-slate-600">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href={"/admin-portal"}>Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href={"/profile"}>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href={"/settings"}>Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Logout />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default Navbar;
