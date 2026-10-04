export type CbtFormat = "FORMAT_A" | "FORMAT_B";
export type Plan = "FREE" | "PLUS";
export type QuestionSource =
  | "PAST_QUESTION"
  | "LECTURER_PROVIDED"
  | "KEFPREP_GENERATED"
  | "PATTERN_BASED"
  | "OTHER_VERIFIED_SOURCE";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

/** Business errors use a stable `KFP_<CODE>:` prefix so the UI can react. */
export function errorCode(message: string): string | null {
  const match = /^KFP_([A-Z_]+):/.exec(message);
  return match ? match[1] : null;
}

export function kfp(code: string, message: string): Error {
  return new Error(`KFP_${code}: ${message}`);
}
