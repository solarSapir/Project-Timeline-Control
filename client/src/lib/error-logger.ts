interface Breadcrumb {
  action: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

const MAX_BREADCRUMBS = 20;
const breadcrumbs: Breadcrumb[] = [];
let loggingInProgress = false;

export function trackAction(action: string, details?: Record<string, unknown>) {
  breadcrumbs.push({
    action,
    details,
    timestamp: new Date().toISOString(),
  });
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

export async function logError(
  errorMessage: string,
  context: {
    errorSource?: string;
    apiEndpoint?: string;
    apiMethod?: string;
    apiPayload?: string;
    stackTrace?: string;
  } = {}
) {
  if (loggingInProgress) return;
  loggingInProgress = true;

  try {
    await fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errorMessage,
        errorSource: context.errorSource || "unknown",
        pageUrl: window.location.pathname,
        userActions: getBreadcrumbs(),
        apiEndpoint: context.apiEndpoint || null,
        apiMethod: context.apiMethod || null,
        apiPayload: context.apiPayload || null,
        stackTrace: context.stackTrace || null,
      }),
    });
  } catch {
    // silently fail — don't create infinite error loops
  } finally {
    loggingInProgress = false;
  }
}

export function initGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    logError(event.message || "Unhandled error", {
      errorSource: "unhandled_error",
      stackTrace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason instanceof Error
      ? event.reason.message
      : String(event.reason);
    logError(message, {
      errorSource: "unhandled_promise",
      stackTrace: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  });
}

export function trackNavigation(path: string) {
  trackAction("Navigate", { path });
}
