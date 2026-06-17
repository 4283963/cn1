package com.boiler.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicLong;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final long permitsPerSecond;
    private final AtomicLong tokens;
    private final AtomicLong lastRefillNanos;
    private final long nanosPerPermit;

    public RateLimitFilter(@Value("${app.request-rate-per-second:50}") long permitsPerSecond) {
        this.permitsPerSecond = permitsPerSecond;
        this.tokens = new AtomicLong(permitsPerSecond);
        this.lastRefillNanos = new AtomicLong(System.nanoTime());
        this.nanosPerPermit = 1_000_000_000L / permitsPerSecond;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (tryAcquire()) {
            chain.doFilter(request, response);
        } else {
            HttpServletResponse resp = (HttpServletResponse) response;
            resp.setStatus(429);
            resp.setContentType("application/json;charset=UTF-8");
            resp.setHeader("Retry-After", "1");
            resp.getWriter().write("{\"code\":429,\"message\":\"Too Many Requests\",\"retryAfterMs\":1000}");
            log.warn("Rate limit exceeded ({} req/s), returning 429", permitsPerSecond);
        }
    }

    private boolean tryAcquire() {
        long now = System.nanoTime();
        long last = lastRefillNanos.get();
        long elapsed = now - last;
        if (elapsed > nanosPerPermit && lastRefillNanos.compareAndSet(last, now)) {
            long refill = Math.min(permitsPerSecond, elapsed / nanosPerPermit);
            tokens.updateAndGet(t -> Math.min(permitsPerSecond, t + refill));
        }
        long current;
        do {
            current = tokens.get();
            if (current <= 0) return false;
        } while (!tokens.compareAndSet(current, current - 1));
        return true;
    }
}
