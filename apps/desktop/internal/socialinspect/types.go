// Package socialinspect implements the Social Inspect backend used by the
// desktop app. It is a Go port of the TypeScript package at
// packages/social-inspect and deliberately keeps its JSON shape and scoring
// behaviour identical to that implementation.
package socialinspect

// MetaTag is a meta/link/title element reduced to the attributes the inspector
// cares about. Attribute names are lower-cased, as in the TypeScript version.
type MetaTag struct {
	TagName string            `json:"tagName"`
	Attrs   map[string]string `json:"attrs"`
}

// Favicon describes one deduplicated icon link found on the page.
type Favicon struct {
	URL   string  `json:"url"`
	Sizes *string `json:"sizes,omitempty"`
	Type  *string `json:"type,omitempty"`
	Rel   string  `json:"rel"`
}

// Issue is one actionable fix, readable by a human and copyable by an agent.
type Issue struct {
	Level       string `json:"level"`
	Code        string `json:"code"`
	Message     string `json:"message"`
	Name        string `json:"name"`
	Description string `json:"description"`
	HTML        string `json:"html"`
	Prompt      string `json:"prompt"`
}

// Check records the outcome of one weighted scoring rule.
type Check struct {
	Label  string `json:"label"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail"`
	Weight int    `json:"weight"`
}

// Analysis is the result of scoring a page.
type Analysis struct {
	Score   int     `json:"score"`
	Verdict string  `json:"verdict"`
	Issues  []Issue `json:"issues"`
	Checks  []Check `json:"checks"`
}

// ImageInfo holds best-effort metadata for the share image. Every field is
// optional: a failed fetch serializes as {}, and a successfully fetched image
// with unknown dimensions still keeps its byte count and content type.
type ImageInfo struct {
	Width  *int    `json:"width,omitempty"`
	Height *int    `json:"height,omitempty"`
	Bytes  *int64  `json:"bytes,omitempty"`
	Type   *string `json:"type,omitempty"`
}

// Report is the JSON-compatible InspectReport returned by Inspect.
type Report struct {
	URL            string            `json:"url"`
	FinalURL       string            `json:"finalUrl"`
	Status         int               `json:"status"`
	ResponseTimeMs int64             `json:"responseTimeMs"`
	HTMLSizeBytes  int               `json:"htmlSizeBytes"`
	FetchedAt      string            `json:"fetchedAt"`
	Title          *string           `json:"title,omitempty"`
	Description    *string           `json:"description,omitempty"`
	Canonical      *string           `json:"canonical,omitempty"`
	ThemeColor     *string           `json:"themeColor,omitempty"`
	Keywords       *[]string         `json:"keywords,omitempty"`
	OG             map[string]string `json:"og"`
	Twitter        map[string]string `json:"twitter"`
	Other          map[string]string `json:"other"`
	Favicons       []Favicon         `json:"favicons"`
	RawTags        []MetaTag         `json:"rawTags"`
	Analysis       Analysis          `json:"analysis"`
	OGImageInfo    *ImageInfo        `json:"ogImageInfo,omitempty"`
}

// checkInput is the flattened view of a Report used by the scoring rules.
// Pointers preserve the difference between "missing" and "present but empty",
// which matters because the TypeScript implementation uses ?? rather than ||.
type checkInput struct {
	URL          *string
	Title        *string
	Description  *string
	FaviconCount int
	OG           map[string]string
	Twitter      map[string]string
}
