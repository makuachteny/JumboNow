package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
)

type PreferencesHandler struct {
	DB *sql.DB
}

func NewPreferencesHandler(db *sql.DB) *PreferencesHandler {
	return &PreferencesHandler{DB: db}
}

// POST /api/customization/preferences
func (h *PreferencesHandler) SavePreferences(c *gin.Context) {
	var prefs models.Preferences
	if err := c.ShouldBindJSON(&prefs); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
		return
	}

	// Upsert preferences
	query := `
		INSERT INTO user_preferences (user_id, building_hours, emergency_numbers, student_recs, tufts_events, academic_calendar, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			building_hours = EXCLUDED.building_hours,
			emergency_numbers = EXCLUDED.emergency_numbers,
			student_recs = EXCLUDED.student_recs,
			tufts_events = EXCLUDED.tufts_events,
			academic_calendar = EXCLUDED.academic_calendar,
			updated_at = NOW()
		RETURNING user_id, building_hours, emergency_numbers, student_recs, tufts_events, academic_calendar, updated_at
	`

	var saved models.Preferences
	err := h.DB.QueryRow(query,
		prefs.UserID, prefs.BuildingHours, prefs.EmergencyNumbers,
		prefs.StudentRecs, prefs.TuftsEvents, prefs.AcademicCalendar,
	).Scan(
		&saved.UserID, &saved.BuildingHours, &saved.EmergencyNumbers,
		&saved.StudentRecs, &saved.TuftsEvents, &saved.AcademicCalendar,
		&saved.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "failed to save preferences",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    saved,
	})
}

// GET /api/customization/preferences/:userId
func (h *PreferencesHandler) GetPreferences(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "userId is required",
		})
		return
	}

	var prefs models.Preferences
	err := h.DB.QueryRow(`
		SELECT user_id, building_hours, emergency_numbers, student_recs, tufts_events, academic_calendar, updated_at
		FROM user_preferences WHERE user_id = $1
	`, userID).Scan(
		&prefs.UserID, &prefs.BuildingHours, &prefs.EmergencyNumbers,
		&prefs.StudentRecs, &prefs.TuftsEvents, &prefs.AcademicCalendar,
		&prefs.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		// Return defaults
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data: models.Preferences{
				UserID:           userID,
				BuildingHours:    true,
				EmergencyNumbers: true,
				StudentRecs:      false,
				TuftsEvents:      true,
				AcademicCalendar: true,
			},
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "failed to fetch preferences",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    prefs,
	})
}
