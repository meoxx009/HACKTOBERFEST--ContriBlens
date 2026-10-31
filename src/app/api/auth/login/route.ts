import { NextResponse } from "next/server";
import {
  verifyPassword,
  validateEmail,
  signSessionToken,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { isSupabaseConfigured, getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password || !validateEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password.", code: "AUTH_INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = db.getUserByEmail(cleanEmail);

    // If not in local db, check Supabase
    if (!user && isSupabaseConfigured()) {
      try {
        const client = getSupabaseServerClient();
        if (client) {
          const { data, error } = await client.auth.signInWithPassword({
            email: cleanEmail,
            password: password,
          });

          if (!error && data.user) {
            user = {
              id: data.user.id,
              email: cleanEmail,
              name: data.user.user_metadata?.name || cleanEmail.split("@")[0],
              createdAt: data.user.created_at,
            };
          }
        }
      } catch (err) {
        console.warn("Supabase auth check fallback:", err);
      }
    }

    if (!user) {
      // Safe generic message — never reveal account existence
      return NextResponse.json(
        { ok: false, error: "Invalid email or password.", code: "AUTH_INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    if (user.passwordHash) {
      const match = await verifyPassword(password, user.passwordHash);
      if (!match) {
        return NextResponse.json(
          { ok: false, error: "Invalid email or password.", code: "AUTH_INVALID_CREDENTIALS" },
          { status: 401 }
        );
      }
    }

    const sessionToken = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        settings: user.settings,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json(
      { ok: false, error: msg, code: "AUTH_PROVIDER_UNAVAILABLE" },
      { status: 500 }
    );
  }
}
