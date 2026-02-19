package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"jumbonow/models"
)

type ClubsHandler struct {
	DB *sql.DB
}

func NewClubsHandler(db *sql.DB) *ClubsHandler {
	return &ClubsHandler{DB: db}
}

// GET /api/clubs/:id/profile
func (h *ClubsHandler) GetClubProfile(c *gin.Context) {
	clubID := c.Param("id")
	if clubID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "club id is required",
		})
		return
	}

	var club models.ClubProfile
	err := h.DB.QueryRow(`
		SELECT id, name, description, logo_url, banner_url, category, color, member_count, is_verified, created_by, updated_at
		FROM clubs WHERE id = $1
	`, clubID).Scan(
		&club.ID, &club.Name, &club.Description, &club.LogoURL,
		&club.BannerURL, &club.Category, &club.Color,
		&club.MemberCount, &club.IsVerified, &club.CreatedBy, &club.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   "club not found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "failed to fetch club",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    club,
	})
}

// PUT /api/clubs/:id/profile — Update club branding (logo, banner, color, description)
func (h *ClubsHandler) UpdateClubProfile(c *gin.Context) {
	clubID := c.Param("id")

	var update struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		LogoURL     *string `json:"logo_url"`
		BannerURL   *string `json:"banner_url"`
		Color       *string `json:"color"`
		Category    *string `json:"category"`
	}
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
		return
	}

	// Build dynamic update query
	query := `UPDATE clubs SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if update.Name != nil {
		query += `, name = $` + itoa(argIdx)
		args = append(args, *update.Name)
		argIdx++
	}
	if update.Description != nil {
		query += `, description = $` + itoa(argIdx)
		args = append(args, *update.Description)
		argIdx++
	}
	if update.LogoURL != nil {
		query += `, logo_url = $` + itoa(argIdx)
		args = append(args, *update.LogoURL)
		argIdx++
	}
	if update.BannerURL != nil {
		query += `, banner_url = $` + itoa(argIdx)
		args = append(args, *update.BannerURL)
		argIdx++
	}
	if update.Color != nil {
		query += `, color = $` + itoa(argIdx)
		args = append(args, *update.Color)
		argIdx++
	}
	if update.Category != nil {
		query += `, category = $` + itoa(argIdx)
		args = append(args, *update.Category)
		argIdx++
	}

	query += ` WHERE id = $` + itoa(argIdx)
	args = append(args, clubID)

	_, err := h.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "failed to update club profile",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    map[string]string{"message": "club profile updated"},
	})
}

// POST /api/clubs/:id/logo — Upload club logo (accepts multipart form)
func (h *ClubsHandler) UploadClubLogo(c *gin.Context) {
	clubID := c.Param("id")

	file, err := c.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "logo file is required",
		})
		return
	}

	// In production: upload to S3/Supabase Storage and get URL
	// For now, save locally
	path := "./uploads/clubs/" + clubID + "_logo_" + file.Filename
	if err := c.SaveUploadedFile(file, path); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "failed to save logo",
		})
		return
	}

	logoURL := "/uploads/clubs/" + clubID + "_logo_" + file.Filename

	// Update DB
	_, dbErr := h.DB.Exec(`UPDATE clubs SET logo_url = $1, updated_at = NOW() WHERE id = $2`, logoURL, clubID)
	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "failed to update logo in database",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    map[string]string{"logo_url": logoURL},
	})
}

func itoa(i int) string {
	return string(rune('0'+i)) // works for 1-9
}
