package models

import "time"

// ── User Preferences ──

type Preferences struct {
	UserID           string `json:"user_id" db:"user_id"`
	BuildingHours    bool   `json:"building_hours" db:"building_hours"`
	EmergencyNumbers bool   `json:"emergency_numbers" db:"emergency_numbers"`
	StudentRecs      bool   `json:"student_recs" db:"student_recs"`
	TuftsEvents      bool   `json:"tufts_events" db:"tufts_events"`
	AcademicCalendar bool   `json:"academic_calendar" db:"academic_calendar"`
	UpdatedAt        string `json:"updated_at,omitempty" db:"updated_at"`
}

// ── Building Hours ──

type BuildingHours struct {
	Name   string `json:"name"`
	Hours  string `json:"hours"`
	Status string `json:"status"` // "open" | "closed"
}

// ── Emergency Contacts ──

type EmergencyContact struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	Type  string `json:"type"` // "police" | "medical" | "security" | "emergency"
}

// ── Academic Calendar ──

type AcademicEvent struct {
	Name      string `json:"name"`
	Date      string `json:"date"`
	Type      string `json:"type"` // "break" | "deadline" | "exam" | "ceremony" | "start"
	Countdown int    `json:"countdown,omitempty"`
}

// ── Tufts Events (from RSS) ──

type TuftsEvent struct {
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Date        string    `json:"date"`
	Location    string    `json:"location,omitempty"`
	Link        string    `json:"link,omitempty"`
	Free        bool      `json:"free"`
	PublishedAt time.Time `json:"published_at,omitempty"`
}

// ── Student Recommendations ──

type Recommendation struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Rating   float64 `json:"rating"`
	Category string  `json:"category"`
	Reviews  int     `json:"reviews"`
	Comment  string  `json:"comment,omitempty"`
}

// ── Club Profile ──

type ClubProfile struct {
	ID          string   `json:"id" db:"id"`
	Name        string   `json:"name" db:"name"`
	Description string   `json:"description" db:"description"`
	LogoURL     string   `json:"logo_url" db:"logo_url"`
	BannerURL   string   `json:"banner_url" db:"banner_url"`
	Category    string   `json:"category" db:"category"`
	Color       string   `json:"color" db:"color"`
	SocialLinks []string `json:"social_links" db:"social_links"`
	MemberCount int      `json:"member_count" db:"member_count"`
	IsVerified  bool     `json:"is_verified" db:"is_verified"`
	CreatedBy   string   `json:"created_by" db:"created_by"`
	UpdatedAt   string   `json:"updated_at" db:"updated_at"`
}

// ── API Responses ──

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
