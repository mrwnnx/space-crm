"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=1");
  }
  redirect("/leads");
}

export async function signup(formData: FormData) {
  const rawEmail = String(formData.get("email"));
  const password = String(formData.get("password"));

  // Allowlist : seul un email présent dans allowed_emails peut créer un compte
  const normalized = rawEmail.trim().toLowerCase();
  const [match] = await db
    .select({ id: allowedEmails.id })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, normalized))
    .limit(1);
  if (!match) {
    redirect("/login?error=unauthorized");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: rawEmail, password });
  if (error) {
    redirect("/login?error=1");
  }
  redirect("/leads");
}
