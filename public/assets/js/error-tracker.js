/**
 * FPay Client-Side Error Tracking
 * Captures and logs client-side errors to the server
 */

(function() {
    'use strict';

    const ERROR_LOG_ENDPOINT = '/api/errors/log';
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    // Debounce to prevent duplicate error logs
    const recentErrors = new Set();
    const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds

    /**
     * Get browser information
     */
    function getBrowserInfo() {
        return {
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };
    }

    /**
     * Create error signature for deduplication
     */
    function getErrorSignature(message, url, lineNo, colNo) {
        return `${message}|${url}|${lineNo}|${colNo}`;
    }

    /**
     * Check if error was recently logged
     */
    function isRecentError(signature) {
        if (recentErrors.has(signature)) {
            return true;
        }
        recentErrors.add(signature);
        setTimeout(() => recentErrors.delete(signature), ERROR_DEBOUNCE_TIME);
        return false;
    }

    /**
     * Send error to server with retry logic
     */
    async function sendErrorToServer(errorData, retryCount = 0) {
        try {
            const response = await fetch(ERROR_LOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(errorData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (window.FPayDebug) {
                console.log('Error logged successfully:', result);
            }

            return result;

        } catch (error) {
            console.error('Failed to log error to server:', error);

            // Retry on network errors
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => {
                    sendErrorToServer(errorData, retryCount + 1);
                }, RETRY_DELAY * (retryCount + 1));
            } else {
                // Store in localStorage as fallback
                try {
                    const failedLogs = JSON.parse(localStorage.getItem('fpay_failed_error_logs') || '[]');
                    failedLogs.push({
                        ...errorData,
                        failedAt: new Date().toISOString()
                    });
                    // Keep only last 50 failed logs
                    if (failedLogs.length > 50) {
                        failedLogs.shift();
                    }
                    localStorage.setItem('fpay_failed_error_logs', JSON.stringify(failedLogs));
                } catch (storageError) {
                    console.error('Failed to store error in localStorage:', storageError);
                }
            }
        }
    }

    /**
     * Log error with context
     */
    function logError(message, stack, url, lineNo, colNo, metadata = {}) {
        const signature = getErrorSignature(message, url, lineNo, colNo);

        // Prevent duplicate logging
        if (isRecentError(signature)) {
            return;
        }

        const errorData = {
            message: message,
            stack: stack || 'No stack trace available',
            url: url || window.location.href,
            userAgent: navigator.userAgent,
            browserInfo: getBrowserInfo(),
            metadata: {
                lineNo: lineNo,
                colNo: colNo,
                timestamp: new Date().toISOString(),
                pageUrl: window.location.href,
                referrer: document.referrer,
                ...metadata
            }
        };

        // Send to server
        sendErrorToServer(errorData);

        // Log to console in development
        if (window.location.hostname === 'localhost' || window.FPayDebug) {
            console.group('🐛 FPay Error Logged');
            console.error('Message:', message);
            console.error('Stack:', stack);
            console.error('Location:', `${url}:${lineNo}:${colNo}`);
            console.groupEnd();
        }
    }

    /**
     * Global error handler
     */
    window.addEventListener('error', function(event) {
        const { message, filename, lineno, colno, error } = event;

        // Ignore errors from browser extensions
        if (filename && (
            filename.includes('chrome-extension://') ||
            filename.includes('moz-extension://') ||
            filename.includes('safari-extension://')
        )) {
            return;
        }

        logError(
            message || 'Unknown error',
            error?.stack,
            filename || window.location.href,
            lineno,
            colno,
            {
                errorType: error?.name || 'Error',
                errorObject: error ? {
                    name: error.name,
                    message: error.message
                } : null
            }
        );
    });

    /**
     * Unhandled promise rejection handler
     */
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        const message = reason?.message || reason?.toString() || 'Unhandled Promise Rejection';
        const stack = reason?.stack || new Error().stack;

        logError(
            message,
            stack,
            window.location.href,
            0,
            0,
            {
                errorType: 'UnhandledPromiseRejection',
                reason: reason?.toString()
            }
        );
    });

    /**
     * Wrap fetch to catch network errors
     */
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args)
            .catch(error => {
                // Log network errors
                logError(
                    `Network Error: ${error.message}`,
                    error.stack,
                    args[0], // URL being fetched
                    0,
                    0,
                    {
                        errorType: 'NetworkError',
                        fetchUrl: args[0],
                        fetchOptions: args[1] ? JSON.stringify(args[1]) : null
                    }
                );
                throw error; // Re-throw to maintain original behavior
            });
    };

    /**
     * Retry failed error logs on page load
     */
    function retryFailedLogs() {
        try {
            const failedLogs = JSON.parse(localStorage.getItem('fpay_failed_error_logs') || '[]');
            if (failedLogs.length > 0) {
                console.log(`Retrying ${failedLogs.length} failed error logs...`);

                failedLogs.forEach(errorData => {
                    sendErrorToServer(errorData);
                });

                // Clear after attempting retry
                localStorage.removeItem('fpay_failed_error_logs');
            }
        } catch (error) {
            console.error('Failed to retry error logs:', error);
        }
    }

    // Retry failed logs when online
    if (navigator.onLine) {
        retryFailedLogs();
    }

    window.addEventListener('online', retryFailedLogs);

    /**
     * Public API for manual error logging
     */
    window.FPayErrorTracker = {
        log: function(message, additionalData = {}) {
            logError(
                message,
                new Error().stack,
                window.location.href,
                0,
                0,
                { ...additionalData, manualLog: true }
            );
        },

        enableDebug: function() {
            window.FPayDebug = true;
            console.log('FPay Error Tracker debug mode enabled');
        },

        disableDebug: function() {
            window.FPayDebug = false;
        }
    };

    console.log('✅ FPay Error Tracker initialized');

})();
