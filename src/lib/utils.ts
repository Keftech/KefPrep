import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Extracts the stable `KFP_<CODE>` prefix from a server error message. */
export function errorCodeOf(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = /KFP_([A-Z_]+):/.exec(message);
  return match ? match[1] : null;
}

/** Human-friendly copy for known server error codes. */
export function friendlyError(message: string | null | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  const code = errorCodeOf(message);
  const withoutCode = message.replace(/^KFP_[A-Z_]+:\s*/, "");
  const map: Record<string, string> = {
    UNAUTHENTICATED: "Please sign in to continue.",
    FORBIDDEN: "You do not have access to that.",
    INVALID_CREDENTIALS: "Invalid phone number or password.",
    PHONE_TAKEN: "An account with this phone number already exists. Try signing in.",
    INVALID_PHONE: "Please enter a valid phone number (10–15 digits).",
    INVALID_PASSWORD:
      "Password must be at least 8 characters with a letter and a number.",
    INVALID_NAME: "Please enter your full name.",
    INVALID_LEVEL: "Please select your level.",
    INVALID_UNIVERSITY: "Please select your university.",
    INVALID_PROGRAMME: "Please select your programme.",
    NOT_OWNER: "You do not have access to this attempt.",
    ATTEMPT_NOT_FOUND: "Attempt not found.",
    ATTEMPT_CLOSED: "This attempt has already been submitted.",
    TIME_EXPIRED: "Time is up — your attempt was auto-submitted.",
    NOT_READY: "Not available yet.",
    NOT_ENROLLED: "Enrol in this course before starting a CBT.",
    COURSE_LIMIT: "You have reached your course limit for this plan.",
    COURSE_NOT_FREE: "This course is not included in the Free plan.",
    WEEKLY_LIMIT: "You have used all simulations allowed this week.",
    COURSE_WEEKLY_LIMIT:
      "You have already used your simulation for this course this week.",
    FORMAT_NOT_ALLOWED: "Your plan cannot take this test format yet.",
    TEST_NOT_FOUND: "That CBT is not available.",
    NO_BLUEPRINT: "This test is not configured yet.",
    NOT_ENOUGH_QUESTIONS: "Not enough questions available for this test yet.",
    RESULT_PENDING: "Your result is being processed. Refresh in a moment.",
  };
  if (code && map[code]) return map[code];
  return withoutCode || "Something went wrong. Please try again.";
}
