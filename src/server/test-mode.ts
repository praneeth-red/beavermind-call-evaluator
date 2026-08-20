type RuntimeEnvironment = Record<string, string | undefined>;

export function evaluatorTestModeEnabled(
  environment: RuntimeEnvironment = process.env,
) {
  if (environment.EVALUATOR_TEST_MODE !== "1") return false;
  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    throw new Error("Evaluator test mode is refused in production.");
  }
  return true;
}
