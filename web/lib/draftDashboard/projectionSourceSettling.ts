export interface ProjectionSourceDescriptor {
  id: string;
  displayName: string;
}

export interface ProjectionSourceWarning {
  sourceId: string;
  sourceName: string;
  message: string;
}

export async function fetchProjectionSourcesSettled<
  TSource extends ProjectionSourceDescriptor,
  TResult,
>(
  sources: TSource[],
  fetchSource: (source: TSource, index: number) => Promise<TResult>,
): Promise<{
  successes: Array<{ source: TSource; result: TResult }>;
  warnings: ProjectionSourceWarning[];
}> {
  const settled = await Promise.allSettled(
    sources.map((source, index) => fetchSource(source, index)),
  );
  const successes: Array<{ source: TSource; result: TResult }> = [];
  const warnings: ProjectionSourceWarning[] = [];

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      successes.push({ source, result: result.value });
      return;
    }
    warnings.push({
      sourceId: source.id,
      sourceName: source.displayName,
      message:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason || "Unknown source error"),
    });
  });

  if (sources.length > 0 && successes.length === 0) {
    throw new Error(
      `All enabled projection sources failed: ${warnings
        .map((warning) => `${warning.sourceName}: ${warning.message}`)
        .join("; ")}`,
    );
  }

  return { successes, warnings };
}
