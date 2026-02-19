package rss

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"jumbonow/models"
)

// RSS feed structures
type Feed struct {
	XMLName xml.Name `xml:"rss"`
	Channel Channel  `xml:"channel"`
}

type Channel struct {
	Title       string `xml:"title"`
	Description string `xml:"description"`
	Items       []Item `xml:"item"`
}

type Item struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	Category    string `xml:"category"`
	GUID        string `xml:"guid"`
}

type Parser struct {
	client *http.Client
}

func NewParser() *Parser {
	return &Parser{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ParseTuftsEvents fetches and parses the Tufts events RSS feed
func (p *Parser) ParseTuftsEvents(feedURL string) ([]models.TuftsEvent, error) {
	resp, err := p.client.Get(feedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch RSS feed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RSS feed returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read RSS response: %w", err)
	}

	var feed Feed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("failed to parse RSS XML: %w", err)
	}

	var events []models.TuftsEvent
	for _, item := range feed.Channel.Items {
		event := models.TuftsEvent{
			Title:       cleanHTML(item.Title),
			Description: truncate(cleanHTML(item.Description), 200),
			Link:        item.Link,
			Free:        isFree(item),
		}

		// Parse publication date
		pubDate, err := parseRSSDate(item.PubDate)
		if err == nil {
			event.PublishedAt = pubDate
			event.Date = pubDate.Format("2006-01-02")
		}

		// Extract location from description if available
		event.Location = extractLocation(item.Description)

		events = append(events, event)
	}

	return events, nil
}

// cleanHTML strips basic HTML tags from a string
func cleanHTML(s string) string {
	s = strings.ReplaceAll(s, "<br>", " ")
	s = strings.ReplaceAll(s, "<br/>", " ")
	s = strings.ReplaceAll(s, "<br />", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "&quot;", "\"")

	// Strip remaining HTML tags
	var result strings.Builder
	inTag := false
	for _, c := range s {
		if c == '<' {
			inTag = true
			continue
		}
		if c == '>' {
			inTag = false
			continue
		}
		if !inTag {
			result.WriteRune(c)
		}
	}
	return strings.TrimSpace(result.String())
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func isFree(item Item) bool {
	lower := strings.ToLower(item.Title + " " + item.Description + " " + item.Category)
	return strings.Contains(lower, "free") || !strings.Contains(lower, "$")
}

func extractLocation(desc string) string {
	// Simple heuristic: look for "Location:" or "Where:" patterns
	lower := strings.ToLower(desc)
	for _, prefix := range []string{"location:", "where:", "venue:"} {
		idx := strings.Index(lower, prefix)
		if idx >= 0 {
			rest := strings.TrimSpace(desc[idx+len(prefix):])
			// Take until newline or period
			for i, c := range rest {
				if c == '\n' || c == '.' || c == '<' {
					return strings.TrimSpace(rest[:i])
				}
			}
			if len(rest) > 60 {
				return rest[:60]
			}
			return rest
		}
	}
	return ""
}

func parseRSSDate(dateStr string) (time.Time, error) {
	formats := []string{
		time.RFC1123Z,
		time.RFC1123,
		time.RFC822Z,
		time.RFC822,
		"Mon, 02 Jan 2006 15:04:05 -0700",
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	}

	for _, format := range formats {
		t, err := time.Parse(format, dateStr)
		if err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse date: %s", dateStr)
}
