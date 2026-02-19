package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
)

type EmergencyHandler struct{}

func NewEmergencyHandler() *EmergencyHandler {
	return &EmergencyHandler{}
}

// GET /api/emergency/contacts
func (h *EmergencyHandler) GetContacts(c *gin.Context) {
	// Static data from emergency.tufts.edu
	contacts := []models.EmergencyContact{
		{Name: "Emergency (Police/Fire/Ambulance)", Phone: "911", Type: "emergency"},
		{Name: "Tufts University Police (TUPD)", Phone: "(617) 627-3030", Type: "police"},
		{Name: "TUPD Non-Emergency", Phone: "(617) 627-3912", Type: "police"},
		{Name: "Counseling & Mental Health", Phone: "(617) 627-3360", Type: "medical"},
		{Name: "Health Service", Phone: "(617) 627-3350", Type: "medical"},
		{Name: "Campus Safety Escort", Phone: "(617) 627-3030", Type: "security"},
		{Name: "Facilities Services (Emergency)", Phone: "(617) 627-3366", Type: "security"},
		{Name: "Poison Control Center", Phone: "(800) 222-1222", Type: "medical"},
		{Name: "National Suicide Prevention", Phone: "988", Type: "medical"},
		{Name: "Title IX Coordinator", Phone: "(617) 627-3298", Type: "security"},
		{Name: "Dean of Students", Phone: "(617) 627-3158", Type: "security"},
	}

	typeFilter := c.Query("type")
	if typeFilter != "" {
		var filtered []models.EmergencyContact
		for _, contact := range contacts {
			if contact.Type == typeFilter {
				filtered = append(filtered, contact)
			}
		}
		c.JSON(http.StatusOK, filtered)
		return
	}

	c.JSON(http.StatusOK, contacts)
}
