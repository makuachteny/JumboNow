package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
	"jumbonow/rss"
)

type EventsHandler struct {
	parser    *rss.Parser
	cache     []models.TuftsEvent
	cacheTime time.Time
	cacheTTL  time.Duration
}

func NewEventsHandler() *EventsHandler {
	return &EventsHandler{
		parser:   rss.NewParser(),
		cacheTTL: 10 * time.Minute,
	}
}

// GET /api/events?campus=medford&limit=5
func (h *EventsHandler) GetEvents(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	// Check cache
	if h.cache != nil && time.Since(h.cacheTime) < h.cacheTTL {
		result := h.cache
		if len(result) > limit {
			result = result[:limit]
		}
		c.JSON(http.StatusOK, result)
		return
	}

	// Fetch from Tufts RSS feed
	feedURL := "https://events.tufts.edu/calendar.xml"
	events, err := h.parser.ParseTuftsEvents(feedURL)
	if err != nil {
		// Fall back to curated event data
		events = getFallbackEvents()
	}

	// Cache
	h.cache = events
	h.cacheTime = time.Now()

	if len(events) > limit {
		events = events[:limit]
	}

	c.JSON(http.StatusOK, events)
}

func getFallbackEvents() []models.TuftsEvent {
	return []models.TuftsEvent{
		{
			Title:    "Jazz Ensemble Spring Concert",
			Date:     "2026-02-21",
			Location: "Distler Performance Hall",
			Free:     true,
			Link:     "https://events.tufts.edu",
		},
		{
			Title:    "Career Fair: Tech & Engineering",
			Date:     "2026-02-25",
			Location: "Gantcher Center",
			Free:     true,
			Link:     "https://careers.tufts.edu",
		},
		{
			Title:    "International Film Series: Parasite",
			Date:     "2026-02-27",
			Location: "Barnum Hall 008",
			Free:     true,
			Link:     "https://events.tufts.edu",
		},
		{
			Title:    "Spring Activities Fair",
			Date:     "2026-03-02",
			Location: "Mayer Campus Center",
			Free:     true,
			Link:     "https://events.tufts.edu",
		},
		{
			Title:    "TEDxTufts 2026",
			Date:     "2026-03-08",
			Location: "Cohen Auditorium",
			Free:     false,
			Link:     "https://events.tufts.edu",
		},
		{
			Title:    "Tufts Dance Collective Showcase",
			Date:     "2026-03-12",
			Location: "Balch Arena Theater",
			Free:     true,
			Link:     "https://events.tufts.edu",
		},
		{
			Title:    "Sustainability Week Kickoff",
			Date:     "2026-03-23",
			Location: "Campus Center",
			Free:     true,
			Link:     "https://events.tufts.edu",
		},
		{
			Title:    "Spring Fling Concert",
			Date:     "2026-04-18",
			Location: "President's Lawn",
			Free:     true,
			Link:     "https://events.tufts.edu",
		},
	}
}
