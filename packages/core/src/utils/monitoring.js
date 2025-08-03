/**
 * Performance monitoring utilities
 */

/**
 * Simple performance monitor for tracking operation times
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = process.env.NODE_ENV !== 'production';
  }

  /**
   * Start timing an operation
   */
  startTimer(name) {
    if (!this.enabled) return () => {};
    
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
    };
  }

  /**
   * Record a metric value
   */
  recordMetric(name, value) {
    if (!this.enabled) return;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        values: [],
      });
    }
    
    const metric = this.metrics.get(name);
    metric.count++;
    metric.total += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    
    // Keep last 1000 values for percentile calculations
    metric.values.push(value);
    if (metric.values.length > 1000) {
      metric.values.shift();
    }
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    const summary = {};
    
    for (const [name, metric] of this.metrics) {
      const values = [...metric.values].sort((a, b) => a - b);
      summary[name] = {
        count: metric.count,
        avg: metric.total / metric.count,
        min: metric.min,
        max: metric.max,
        p50: values[Math.floor(values.length * 0.5)] || 0,
        p95: values[Math.floor(values.length * 0.95)] || 0,
        p99: values[Math.floor(values.length * 0.99)] || 0,
      };
    }
    
    return summary;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
  }

  /**
   * Print metrics to console
   */
  printMetrics() {
    if (!this.enabled) return;
    
    const metrics = this.getMetrics();
    console.log('\n=== Performance Metrics ===');
    
    for (const [name, values] of Object.entries(metrics)) {
      console.log(`\n${name}:`);
      console.log(`  Count: ${values.count}`);
      console.log(`  Avg:   ${values.avg.toFixed(3)}ms`);
      console.log(`  Min:   ${values.min.toFixed(3)}ms`);
      console.log(`  Max:   ${values.max.toFixed(3)}ms`);
      console.log(`  P50:   ${values.p50.toFixed(3)}ms`);
      console.log(`  P95:   ${values.p95.toFixed(3)}ms`);
      console.log(`  P99:   ${values.p99.toFixed(3)}ms`);
    }
  }
}

// Singleton instance
export const monitor = new PerformanceMonitor();