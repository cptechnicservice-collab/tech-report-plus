type PageResult<T> = { data: T[] | null; error: unknown };
type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<PageResult<T>>;
};

/** Rebuild each ordered query; callers cache only after every page succeeds. */
export async function fetchAllPages<T>(query: () => RangeQuery<T>): Promise<T[]> {
  const pageSize = 1000;
  const result: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}