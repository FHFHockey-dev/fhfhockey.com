import path from "node:path";

import dotenv from "dotenv";

export const SQL_REFRESH_ENV_FILE = "SQL_REFRESH_ENV_FILE";
export const SQL_REFRESH_REQUIRED_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type SqlRefreshEnvironment = Record<string, string | undefined>;

type EnvironmentFileLoader = (args: {
  absolutePath: string;
  environment: SqlRefreshEnvironment;
}) => { error?: unknown };

export type SqlRefreshConfiguration = {
  supabaseUrl: string;
  serviceRoleKey: string;
  environmentFile: string | null;
};

export class SqlRefreshConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqlRefreshConfigurationError";
  }
}

function defaultEnvironmentFileLoader({
  absolutePath,
  environment,
}: {
  absolutePath: string;
  environment: SqlRefreshEnvironment;
}) {
  return dotenv.config({
    path: absolutePath,
    // dotenv only writes string values; ProcessEnv-style callers may also
    // contain existing undefined entries that are irrelevant to population.
    processEnv: environment as Record<string, string>,
    quiet: true,
  });
}

export function resolveSqlRefreshEnvironmentFile(
  environment: SqlRefreshEnvironment,
  repositoryRoot = path.resolve(__dirname, "../.."),
): { absolutePath: string; repositoryRelativePath: string } | null {
  const configuredPath = environment[SQL_REFRESH_ENV_FILE]?.trim();
  if (!configuredPath) return null;

  if (path.isAbsolute(configuredPath)) {
    throw new SqlRefreshConfigurationError(
      `${SQL_REFRESH_ENV_FILE} must name a repository-relative file.`,
    );
  }

  const absolutePath = path.resolve(repositoryRoot, configuredPath);
  const repositoryRelativePath = path.relative(repositoryRoot, absolutePath);
  const escapesRepository =
    repositoryRelativePath === ".." ||
    repositoryRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(repositoryRelativePath);

  if (!repositoryRelativePath || escapesRepository) {
    throw new SqlRefreshConfigurationError(
      `${SQL_REFRESH_ENV_FILE} must name a file inside the repository.`,
    );
  }

  return { absolutePath, repositoryRelativePath };
}

export function loadSqlRefreshConfiguration(options: {
  environment?: SqlRefreshEnvironment;
  repositoryRoot?: string;
  loadEnvironmentFile?: EnvironmentFileLoader;
} = {}): SqlRefreshConfiguration {
  const environment = options.environment ?? process.env;
  const environmentFile = resolveSqlRefreshEnvironmentFile(
    environment,
    options.repositoryRoot,
  );

  if (environmentFile) {
    const loaded = (options.loadEnvironmentFile ?? defaultEnvironmentFileLoader)({
      absolutePath: environmentFile.absolutePath,
      environment,
    });
    if (loaded.error) {
      throw new SqlRefreshConfigurationError(
        `Unable to load the repository-relative file named by ${SQL_REFRESH_ENV_FILE}.`,
      );
    }
  }

  const missingNames = SQL_REFRESH_REQUIRED_ENV_NAMES.filter(
    (name) => !environment[name]?.trim(),
  );
  if (missingNames.length > 0) {
    throw new SqlRefreshConfigurationError(
      `Missing required SQL refresh environment variables: ${missingNames.join(", ")}.`,
    );
  }

  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL!.trim();
  try {
    const parsedUrl = new URL(supabaseUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new SqlRefreshConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.",
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    environmentFile: environmentFile?.repositoryRelativePath ?? null,
  };
}

export function formatSqlRefreshEntrypointError(error: unknown): string {
  return error instanceof SqlRefreshConfigurationError
    ? error.message
    : "SQL refresh validation failed; configuration values were not logged.";
}
