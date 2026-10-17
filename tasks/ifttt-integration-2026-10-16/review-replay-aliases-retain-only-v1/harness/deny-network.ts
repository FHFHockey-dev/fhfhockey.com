// Any fetch a test did not stub fails loudly instead of reaching a host.
globalThis.fetch = (async (input: unknown) => { throw new Error(`Review harness blocked network request: ${String(input)}`); }) as typeof fetch;
