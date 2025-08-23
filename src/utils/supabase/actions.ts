"use server";

import { redirect } from "next/navigation";
import { getUserRole, type AppRole } from "../get-user-role";
import { createClient } from "./server";

export async function protectPage(allowedRoles: AppRole[]) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    return redirect("/auth");
  }

  const userRole = getUserRole(user.user_metadata);
  if (!userRole || !allowedRoles.includes(userRole)) {
    return redirect("/auth");
  }

  return user;
}
