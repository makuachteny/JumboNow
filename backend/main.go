package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	"jumbonow/handlers"
	"jumbonow/middleware"
)

func main() {
	// Configuration from environment
	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/jumbonow?sslmode=disable")

	// Connect to PostgreSQL
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("Warning: Could not connect to database: %v", err)
		log.Println("Running in offline mode with static data only")
	} else {
		defer db.Close()
		if err := db.Ping(); err != nil {
			log.Printf("Warning: Database ping failed: %v", err)
			db = nil
		} else {
			log.Println("Connected to PostgreSQL")
			initDB(db)
		}
	}

	// Initialize Gin
	r := gin.Default()

	// Middleware
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.RequestLogger())
	r.Use(middleware.RateLimiter(120))

	// Serve uploaded files
	r.Static("/uploads", "./uploads")

	// ── Initialize handlers ──
	prefsHandler := handlers.NewPreferencesHandler(db)
	buildingsHandler := handlers.NewBuildingsHandler()
	emergencyHandler := handlers.NewEmergencyHandler()
	academicHandler := handlers.NewAcademicHandler()
	eventsHandler := handlers.NewEventsHandler()
	recsHandler := handlers.NewRecommendationsHandler(db)
	clubsHandler := handlers.NewClubsHandler(db)

	// ── API Routes ──
	api := r.Group("/api")
	{
		// Customization preferences
		api.POST("/customization/preferences", prefsHandler.SavePreferences)
		api.GET("/customization/preferences/:userId", prefsHandler.GetPreferences)

		// Data endpoints
		api.GET("/buildings/hours", buildingsHandler.GetBuildingHours)
		api.GET("/emergency/contacts", emergencyHandler.GetContacts)
		api.GET("/academic/calendar", academicHandler.GetCalendar)
		api.GET("/events", eventsHandler.GetEvents)
		api.GET("/recommendations", recsHandler.GetRecommendations)

		// Club profile management
		api.GET("/clubs/:id/profile", clubsHandler.GetClubProfile)
		api.PUT("/clubs/:id/profile", clubsHandler.UpdateClubProfile)
		api.POST("/clubs/:id/logo", clubsHandler.UploadClubLogo)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		status := "ok"
		if db == nil {
			status = "degraded (no database)"
		} else if err := db.Ping(); err != nil {
			status = "degraded (database unreachable)"
		}
		c.JSON(200, gin.H{"status": status, "service": "jumbonow-api"})
	})

	log.Printf("JumboNow API server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func initDB(db *sql.DB) {
	schema := `
	CREATE TABLE IF NOT EXISTS user_preferences (
		user_id TEXT PRIMARY KEY,
		building_hours BOOLEAN DEFAULT true,
		emergency_numbers BOOLEAN DEFAULT true,
		student_recs BOOLEAN DEFAULT false,
		tufts_events BOOLEAN DEFAULT true,
		academic_calendar BOOLEAN DEFAULT true,
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS recommendations (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		rating REAL DEFAULT 0,
		category TEXT NOT NULL,
		reviews INT DEFAULT 0,
		comment TEXT,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS clubs (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT DEFAULT '',
		logo_url TEXT DEFAULT '',
		banner_url TEXT DEFAULT '',
		category TEXT DEFAULT '',
		color TEXT DEFAULT '#452477',
		member_count INT DEFAULT 0,
		is_verified BOOLEAN DEFAULT false,
		created_by TEXT DEFAULT '',
		social_links TEXT[] DEFAULT '{}',
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS club_members (
		club_id TEXT REFERENCES clubs(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL,
		role TEXT DEFAULT 'member',
		joined_at TIMESTAMPTZ DEFAULT NOW(),
		PRIMARY KEY (club_id, user_id)
	);
	`

	if _, err := db.Exec(schema); err != nil {
		log.Printf("Warning: schema init error: %v", err)
	} else {
		log.Println("Database schema initialized")
	}

	// Seed recommendations if empty
	var count int
	db.QueryRow("SELECT COUNT(*) FROM recommendations").Scan(&count)
	if count == 0 {
		seedSQL := `
		INSERT INTO recommendations (id, name, rating, category, reviews, comment) VALUES
			('1', 'Tamper Café', 4.8, 'Coffee', 142, 'Best espresso near campus'),
			('2', 'Danish Pastry House', 4.7, 'Bakery', 87, 'Amazing croissants and pastries'),
			('3', 'Hotung Café', 4.5, 'Study Spot', 98, 'Great late-night study vibes'),
			('4', 'Tisch Roof Garden', 4.6, 'Hidden Gem', 64, 'Secret rooftop with amazing views'),
			('5', 'Hodgdon Good-To-Go', 4.3, 'Quick Eats', 112, 'Fastest grab-and-go on campus')
		ON CONFLICT (id) DO NOTHING;
		`
		db.Exec(seedSQL)
		log.Println("Seeded default recommendations")
	}

	// Create uploads directory
	os.MkdirAll("./uploads/clubs", 0755)

	fmt.Println("Database initialized successfully")
}
