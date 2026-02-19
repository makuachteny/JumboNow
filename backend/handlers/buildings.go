package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
)

type BuildingsHandler struct {
	cache     []models.BuildingHours
	cacheTime time.Time
	cacheTTL  time.Duration
}

func NewBuildingsHandler() *BuildingsHandler {
	return &BuildingsHandler{
		cacheTTL: 5 * time.Minute,
	}
}

// GET /api/buildings/hours
func (h *BuildingsHandler) GetBuildingHours(c *gin.Context) {
	// Check cache
	if h.cache != nil && time.Since(h.cacheTime) < h.cacheTTL {
		c.JSON(http.StatusOK, h.cache)
		return
	}

	// In production: scrape access.tufts.edu/work-hours
	// For now, return curated campus building hours
	now := time.Now()
	hour := now.Hour()

	buildings := []models.BuildingHours{
		{Name: "Tisch Library", Hours: "8:00 AM – 12:00 AM", Status: getStatus(8, 24, hour)},
		{Name: "Campus Center", Hours: "7:00 AM – 11:00 PM", Status: getStatus(7, 23, hour)},
		{Name: "SEC (Science & Engineering Complex)", Hours: "7:30 AM – 10:00 PM", Status: getStatus(7, 22, hour)},
		{Name: "Aidekman Arts Center", Hours: "8:00 AM – 9:00 PM", Status: getStatus(8, 21, hour)},
		{Name: "Anderson Hall", Hours: "7:00 AM – 10:00 PM", Status: getStatus(7, 22, hour)},
		{Name: "Barnum Hall", Hours: "7:30 AM – 9:00 PM", Status: getStatus(7, 21, hour)},
		{Name: "Braker Hall", Hours: "7:00 AM – 10:00 PM", Status: getStatus(7, 22, hour)},
		{Name: "Cabot Center", Hours: "6:00 AM – 11:00 PM", Status: getStatus(6, 23, hour)},
		{Name: "Carmichael Hall", Hours: "7:00 AM – 12:00 AM", Status: getStatus(7, 24, hour)},
		{Name: "Dewick-MacPhie Dining", Hours: "7:00 AM – 9:00 PM", Status: getStatus(7, 21, hour)},
		{Name: "Eaton Hall", Hours: "7:30 AM – 9:30 PM", Status: getStatus(7, 21, hour)},
		{Name: "Goddard Chapel", Hours: "8:00 AM – 8:00 PM", Status: getStatus(8, 20, hour)},
		{Name: "Granoff Music Center", Hours: "8:00 AM – 10:00 PM", Status: getStatus(8, 22, hour)},
		{Name: "Halligan Hall", Hours: "7:00 AM – 11:00 PM", Status: getStatus(7, 23, hour)},
		{Name: "Jackson Gym", Hours: "6:00 AM – 10:00 PM", Status: getStatus(6, 22, hour)},
		{Name: "Joyce Cummings Center", Hours: "7:00 AM – 10:00 PM", Status: getStatus(7, 22, hour)},
		{Name: "Mayer Campus Center", Hours: "7:00 AM – 11:00 PM", Status: getStatus(7, 23, hour)},
		{Name: "Mugar Hall", Hours: "7:30 AM – 9:00 PM", Status: getStatus(7, 21, hour)},
		{Name: "Pearson Chemistry Lab", Hours: "8:00 AM – 9:00 PM", Status: getStatus(8, 21, hour)},
		{Name: "Robinson Hall", Hours: "7:00 AM – 10:00 PM", Status: getStatus(7, 22, hour)},
		{Name: "Steve Tisch Sports Center", Hours: "6:00 AM – 10:00 PM", Status: getStatus(6, 22, hour)},
	}

	// Cache the result
	h.cache = buildings
	h.cacheTime = time.Now()

	c.JSON(http.StatusOK, buildings)
}

func getStatus(openHour, closeHour, currentHour int) string {
	if closeHour >= 24 {
		closeHour = 24
	}
	if currentHour >= openHour && currentHour < closeHour {
		return "open"
	}
	return "closed"
}
