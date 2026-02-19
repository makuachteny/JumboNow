package middleware

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CORS middleware for React Native clients
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RequestLogger logs incoming requests with timing
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		log.Printf("[%s] %s %s %d %v",
			c.Request.Method, path, c.ClientIP(), status, latency,
		)
	}
}

// RateLimiter provides basic per-IP rate limiting
func RateLimiter(requestsPerMinute int) gin.HandlerFunc {
	// Simple in-memory rate limiter (use Redis in production)
	type client struct {
		count    int
		lastSeen time.Time
	}
	clients := make(map[string]*client)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		if cl, exists := clients[ip]; exists {
			if now.Sub(cl.lastSeen) > time.Minute {
				cl.count = 1
				cl.lastSeen = now
			} else {
				cl.count++
				if cl.count > requestsPerMinute {
					c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
						"success": false,
						"error":   "rate limit exceeded",
					})
					return
				}
			}
		} else {
			clients[ip] = &client{count: 1, lastSeen: now}
		}

		c.Next()
	}
}
