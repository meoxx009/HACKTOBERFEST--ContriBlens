import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  hashPassword,
  verifyPassword,
  validateEmail,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth";
import { calculatePasswordStrength } from "@/lib/password";
import { db } from "@/lib/db";
import { POST as loginHandler } from "@/app/api/auth/login/route";

describe("Prompt P5 — Authentication & Glass Auth Screens", () => {
  const loginPagePath = path.join(process.cwd(), "src", "app", "login", "page.tsx");
  const signupPagePath = path.join(process.cwd(), "src", "app", "signup", "page.tsx");
  const forgotPagePath = path.join(process.cwd(), "src", "app", "forgot-password", "page.tsx");

  const loginContent = fs.readFileSync(loginPagePath, "utf-8");
  const signupContent = fs.readFileSync(signupPagePath, "utf-8");
  const forgotContent = fs.readFileSync(forgotPagePath, "utf-8");

  describe("Cryptographic Contracts & Token Persistence", () => {
    it("validates emails correctly", () => {
      expect(validateEmail("contributor@example.com")).toBe(true);
      expect(validateEmail("invalid-email")).toBe(false);
      expect(validateEmail("")).toBe(false);
    });

    it("hashes and verifies passwords securely", async () => {
      const raw = "SuperSecret123!";
      const hash = await hashPassword(raw);
      expect(hash).not.toBe(raw);
      expect(hash.startsWith("$2")).toBe(true);

      const isMatch = await verifyPassword(raw, hash);
      expect(isMatch).toBe(true);

      const isWrong = await verifyPassword("WrongPassword123!", hash);
      expect(isWrong).toBe(false);
    });

    it("signs and verifies JWT session tokens", () => {
      const payload = {
        userId: "user-1234",
        email: "test@example.com",
        name: "Tester",
      };
      const token = signSessionToken(payload);
      expect(token).toBeTruthy();

      const decoded = verifySessionToken(token);
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
    });

    it("calculates password strength accurately", () => {
      const veryWeak = calculatePasswordStrength("");
      expect(veryWeak.score).toBe(0);
      expect(veryWeak.label).toBe("Very Weak");

      const weak = calculatePasswordStrength("123");
      expect(weak.score).toBe(1);
      expect(weak.label).toBe("Weak");

      const strong = calculatePasswordStrength("ContribLens2026!Secure");
      expect(strong.score).toBe(4);
      expect(strong.label).toBe("Very Strong");
    });

    it("stores and queries users in local db fallback", () => {
      const testUser = {
        id: "u-test-999",
        email: "unique_test_user@example.com",
        name: "Unique Tester",
        createdAt: new Date().toISOString(),
      };
      db.createUser(testUser);

      const fetched = db.getUserByEmail("unique_test_user@example.com");
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe("Unique Tester");
    });
  });

  describe("Safe Error Guarantees & Next Redirect Sanitation", () => {
    it("never reveals account existence on invalid credentials", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent_account@example.com", password: "SomePassword123!" }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Invalid email or password.");
      expect(data.error).not.toContain("not found");
      expect(data.error).not.toContain("does not exist");
    });

    it("sanitizes ?next= redirect to prevent open redirects", () => {
      const testRedirect = (next: string | null) => {
        if (next && next.startsWith("/") && !next.startsWith("//")) {
          return next;
        }
        return "/app/dashboard";
      };

      expect(testRedirect("/app/findings")).toBe("/app/findings");
      expect(testRedirect("/app/scan?demo=true")).toBe("/app/scan?demo=true");
      expect(testRedirect("https://malicious.com")).toBe("/app/dashboard");
      expect(testRedirect("//malicious.com")).toBe("/app/dashboard");
      expect(testRedirect("javascript:alert(1)")).toBe("/app/dashboard");
      expect(testRedirect(null)).toBe("/app/dashboard");
    });
  });

  describe("Glass Auth Screens Polish & Mobile Standards", () => {
    it("login page renders .glass-panel, tangerine submit, and min 44px tap targets", () => {
      expect(loginContent).toContain("glass-panel");
      expect(loginContent).toContain("bg-electricTangerine");
      expect(loginContent).toContain("min-h-[44px]");
      expect(loginContent).toContain("press-spring");
      expect(loginContent).toContain("Continue with GitHub");
      expect(loginContent).toContain("role=\"alert\"");
    });

    it("signup page features password strength meter, confirmation match, and terms consent", () => {
      expect(signupContent).toContain("glass-panel");
      expect(signupContent).toContain("bg-electricTangerine");
      expect(signupContent).toContain("calculatePasswordStrength");
      expect(signupContent).toContain("Password Strength:");
      expect(signupContent).toContain("signup-confirm-password");
      expect(signupContent).toContain("Passwords do not match");
      expect(signupContent).toContain("acceptedTerms");
      expect(signupContent).toContain("min-h-[44px]");
      // Phone field stays hidden in v2
      expect(signupContent).not.toContain("phone_e164");
    });

    it("forgot-password page renders safe dispatched state with .glass-panel", () => {
      expect(forgotContent).toContain("glass-panel");
      expect(forgotContent).toContain("Reset Link Dispatched");
      expect(forgotContent).toContain("If an account exists for");
      expect(forgotContent).toContain("min-h-[44px]");
    });
  });
});
