package handlers

import (
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
)

type AcademicHandler struct{}

func NewAcademicHandler() *AcademicHandler {
	return &AcademicHandler{}
}

// GET /api/academic/calendar?semester=spring2026
func (h *AcademicHandler) GetCalendar(c *gin.Context) {
	semester := c.DefaultQuery("semester", "spring2026")

	var events []models.AcademicEvent

	switch semester {
	case "spring2026":
		events = []models.AcademicEvent{
			{Name: "Martin Luther King Jr. Day (No Classes)", Date: "2026-01-19", Type: "break"},
			{Name: "Spring Semester Classes Begin", Date: "2026-01-21", Type: "start"},
			{Name: "Add/Drop Deadline", Date: "2026-02-04", Type: "deadline"},
			{Name: "Presidents' Day (No Classes)", Date: "2026-02-16", Type: "break"},
			{Name: "Spring Break", Date: "2026-03-14", Type: "break"},
			{Name: "Spring Break Ends", Date: "2026-03-22", Type: "start"},
			{Name: "Withdrawal Deadline", Date: "2026-04-06", Type: "deadline"},
			{Name: "Patriots' Day (No Classes)", Date: "2026-04-20", Type: "break"},
			{Name: "Last Day of Classes", Date: "2026-04-28", Type: "deadline"},
			{Name: "Reading Period", Date: "2026-04-29", Type: "exam"},
			{Name: "Final Exams Begin", Date: "2026-05-01", Type: "exam"},
			{Name: "Final Exams End", Date: "2026-05-08", Type: "exam"},
			{Name: "Commencement", Date: "2026-05-17", Type: "ceremony"},
			{Name: "Summer Session I Begins", Date: "2026-05-26", Type: "start"},
		}
	case "fall2026":
		events = []models.AcademicEvent{
			{Name: "Fall Semester Classes Begin", Date: "2026-09-02", Type: "start"},
			{Name: "Add/Drop Deadline", Date: "2026-09-16", Type: "deadline"},
			{Name: "Indigenous Peoples' Day (No Classes)", Date: "2026-10-12", Type: "break"},
			{Name: "Withdrawal Deadline", Date: "2026-11-02", Type: "deadline"},
			{Name: "Thanksgiving Break", Date: "2026-11-25", Type: "break"},
			{Name: "Last Day of Classes", Date: "2026-12-09", Type: "deadline"},
			{Name: "Final Exams Begin", Date: "2026-12-11", Type: "exam"},
			{Name: "Final Exams End", Date: "2026-12-18", Type: "exam"},
		}
	default:
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "unknown semester: " + semester,
		})
		return
	}

	// Add countdowns
	now := time.Now()
	for i := range events {
		eventDate, err := time.Parse("2006-01-02", events[i].Date)
		if err == nil {
			days := int(math.Ceil(eventDate.Sub(now).Hours() / 24))
			events[i].Countdown = days
		}
	}

	c.JSON(http.StatusOK, events)
}
