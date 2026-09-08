const DEFAULT_MAX_BYTES = 16 * 1024; // 16 KB — generous for any JSON body this app accepts

export type JsonBodyResult<T = unknown> = { ok: true; body: T } | { ok: false; error: string; status: number };

/**
 * Reads and parses a JSON request body with a size ceiling, rejecting
 * oversized bodies before they're buffered/parsed rather than after. None
 * of this app's JSON endpoints (register, share create, share password)
 * legitimately need more than a few hundred bytes — an oversized body is
 * either a mistake or an attempt to waste server resources.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<JsonBodyResult<T>> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, error: 'Request body too large', status: 413 };
  }

  if (!req.body) {
    return { ok: true, body: {} as T };
  }

  let text: string;
  try {
    // Read raw text first so an over-limit body (e.g. no/incorrect
    // Content-Length header) is caught by size, not just parse failure.
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return { ok: false, error: 'Request body too large', status: 413 };
    }
    text = Buffer.from(buffer).toString('utf8');
  } catch {
    return { ok: false, error: 'Malformed request body', status: 400 };
  }

  if (text.trim() === '') {
    return { ok: true, body: {} as T };
  }

  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: 'Malformed request body', status: 400 };
  }
}
