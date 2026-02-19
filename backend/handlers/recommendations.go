package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
)

type RecommendationsHandler struct {
	DB *sql.DB
}

func NewRecommendationsHandler(db *sql.DB) *RecommendationsHandler {
	return &RecommendationsHandler{DB: db}
}

// GET /api/recommendations
func (h *RecommendationsHandler) GetRecommendations(c *gin.Context) {
	category := c.Query("category")

	// Try database first
	if h.DB != nil {
		recs, err := h.fetchFromDB(category)
		if err == nil && len(recs) > 0 {
			c.JSON(http.StatusOK, recs)
			return
		}
	}

	// Fallback to curated data
	recs := getDefaultRecommendations()
	if category != "" {
		var filtered []models.Recommendation
		for _, r := range recs {
			if r.Category == category {
				filtered = append(filtered, r)
			}
		}
		c.JSON(http.StatusOK, filtered)
		return
	}

	c.JSON(http.StatusOK, recs)
}

func (h *RecommendationsHandler) fetchFromDB(category string) ([]models.Recommendation, error) {
	query := `
		SELECT id, name, rating, category, reviews, comment
		FROM recommendations
		WHERE rating >= 4.0
		ORDER BY rating DESC, reviews DESC
		LIMIT 20
	`
	if category != "" {
		query = `
			SELECT id, name, rating, category, reviews, comment
			FROM recommendations
			WHERE rating >= 4.0 AND category = $1
			ORDER BY rating DESC, reviews DESC
			LIMIT 20
		`
	}

	var rows *sql.Rows
	var err error
	if category != "" {
		rows, err = h.DB.Query(query, category)
	} else {
		rows, err = h.DB.Query(query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recs []models.Recommendation
	for rows.Next() {
		var r models.Recommendation
		var comment sql.NullString
		if err := rows.Scan(&r.ID, &r.Name, &r.Rating, &r.Category, &r.Reviews, &comment); err != nil {
			continue
		}
		r.Comment = comment.String
		recs = append(recs, r)
	}
	return recs, nil
}

func getDefaultRecommendations() []models.Recommendation {
	return []models.Recommendation{
		{ID: "1", Name: "Tamper Café", Rating: 4.8, Category: "Coffee", Reviews: 142, Comment: "Best espresso near campus"},
		{ID: "2", Name: "Danish Pastry House", Rating: 4.7, Category: "Bakery", Reviews: 87, Comment: "Amazing croissants and pastries"},
		{ID: "3", Name: "Hotung Café", Rating: 4.5, Category: "Study Spot", Reviews: 98, Comment: "Great late-night study vibes"},
		{ID: "4", Name: "Tisch Roof Garden", Rating: 4.6, Category: "Hidden Gem", Reviews: 64, Comment: "Secret rooftop with amazing views"},
		{ID: "5", Name: "Hodgdon Good-To-Go", Rating: 4.3, Category: "Quick Eats", Reviews: 112, Comment: "Fastest grab-and-go on campus"},
		{ID: "6", Name: "Kindred Coffee", Rating: 4.6, Category: "Coffee", Reviews: 76, Comment: "Cozy atmosphere, great pour-overs"},
		{ID: "7", Name: "Dewick-MacPhie Dining", Rating: 4.1, Category: "Dining Hall", Reviews: 203, Comment: "Best dining hall food on campus"},
		{ID: "8", Name: "Carmichael Dining", Rating: 4.0, Category: "Dining Hall", Reviews: 189, Comment: "Solid breakfast, close to dorms"},
		{ID: "9", Name: "Tower Café", Rating: 4.4, Category: "Study Spot", Reviews: 55, Comment: "Quiet spot in Tisch, great coffee"},
		{ID: "10", Name: "Brown & Brew", Rating: 4.5, Category: "Coffee", Reviews: 91, Comment: "On-campus classic, always reliable"},
	}
}
