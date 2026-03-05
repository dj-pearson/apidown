/**
 * Builds an in-memory map of domain → api_id from the apis table.
 * Supports exact domain matching and wildcard patterns.
 */
export async function buildDomainMap(supabase) {
  const { data: apis, error } = await supabase
    .from('apis')
    .select('id, base_domains');

  if (error) {
    throw new Error(`Failed to load APIs: ${error.message}`);
  }

  const domainMap = {};
  const wildcardPatterns = [];

  for (const api of apis) {
    for (const domain of api.base_domains) {
      if (domain.includes('*')) {
        // Convert wildcard pattern to regex
        const pattern = domain
          .replace(/\./g, '\\.')
          .replace(/\*/g, '[^.]+');
        wildcardPatterns.push({
          regex: new RegExp(`^${pattern}$`),
          apiId: api.id,
        });
      } else {
        domainMap[domain] = api.id;
      }
    }
  }

  // Attach wildcard patterns for resolution
  domainMap.__wildcards = wildcardPatterns;

  return domainMap;
}

/**
 * Resolve a domain to an api_id using exact match then wildcard fallback
 */
export function resolveDomain(domainMap, hostname) {
  // Exact match first
  if (domainMap[hostname]) {
    return domainMap[hostname];
  }

  // Wildcard fallback
  const wildcards = domainMap.__wildcards || [];
  for (const { regex, apiId } of wildcards) {
    if (regex.test(hostname)) {
      return apiId;
    }
  }

  return null;
}
