export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export function isNetworkError(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
    return true;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    return true;
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number(error.status) === 0
  )
    return true;
  return /failed to fetch|load failed|networkerror/i.test(errorMessage(error));
}

export function timeoutSignal() {
  return AbortSignal.timeout(10_000);
}
