import AppError from "../../errors/AppError.js";

export function requireApiKey(envVarName: string): string {
  const apiKey = process.env[envVarName];

  if (!apiKey) {
    throw new AppError(`${envVarName} is not set`, 500, "MISSING_API_KEY");
  }

  return apiKey;
}
