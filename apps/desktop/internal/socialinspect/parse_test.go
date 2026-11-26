package socialinspect

import (
	"encoding/json"
	"strings"
	"testing"
)

func strPtr(value string) *string { return &value }

func TestParseDocumentQuirks(t *testing.T) {
	htmlBody := `<html><body>
<title>  Fallback Title  </title>
<meta property="OG:title" content="  First OG  ">
<meta property="og:title" content="Second OG">
<meta name="description" content="  A description  ">
<meta property="og:description" content="  OG description  ">
<meta name="keywords" content=" one, two , ,three ">
<meta name="theme-color" content=" #fff ">
<link rel="canonical" href="/canonical?x=1">
<link rel="SHORTCUT ICON" href="/icon.png" sizes="32x32" type="image/png">
<link rel="icon" href="/icon.png">
<link rel="apple-touch-icon" href="icon2.png">
<link rel="stylesheet" href="/style.css">
<meta property="og:image" content="/img.png">
<meta property="twitter:card" content="summary">
<meta name="twitter:image" content="https://cdn.example/t.png">
<meta itemprop="author" content="Alice">
<meta name="robots" content="index">
</body></html>`

	report := ParseDocument("http://example.com/dir/page", 404, 12, "2026-01-02T03:04:05.000Z", []byte(htmlBody))

	if report.Status != 404 || report.ResponseTimeMs != 12 {
		t.Fatalf("status/time = %d/%d", report.Status, report.ResponseTimeMs)
	}
	if report.FetchedAt != "2026-01-02T03:04:05.000Z" {
		t.Fatalf("fetchedAt = %q", report.FetchedAt)
	}
	if report.HTMLSizeBytes != len(htmlBody) {
		t.Fatalf("htmlSizeBytes = %d, want %d", report.HTMLSizeBytes, len(htmlBody))
	}
	if report.Title == nil || *report.Title != "First OG" {
		t.Fatalf("title = %v, want First OG (first property wins)", report.Title)
	}
	if report.Description == nil || *report.Description != "OG description" {
		t.Fatalf("description = %v, want OG description", report.Description)
	}
	// The title field uses the first tag; the og map keeps the last non-empty value.
	if report.OG["title"] != "Second OG" || report.OG["description"] != "OG description" || report.OG["image"] != "/img.png" {
		t.Fatalf("og = %#v", report.OG)
	}
	if report.Twitter["card"] != "summary" || report.Twitter["image"] != "https://cdn.example/t.png" {
		t.Fatalf("twitter = %#v", report.Twitter)
	}
	if report.Other["author"] != "Alice" || report.Other["robots"] != "index" {
		t.Fatalf("other = %#v", report.Other)
	}
	if _, ok := report.Other["description"]; ok {
		t.Fatal("description must not be copied into other")
	}
	if report.Keywords == nil || len(*report.Keywords) != 3 || (*report.Keywords)[0] != "one" || (*report.Keywords)[2] != "three" {
		t.Fatalf("keywords = %#v", report.Keywords)
	}
	if report.ThemeColor == nil || *report.ThemeColor != "#fff" {
		t.Fatalf("themeColor = %v", report.ThemeColor)
	}
	if report.Canonical == nil || *report.Canonical != "http://example.com/canonical?x=1" {
		t.Fatalf("canonical = %v", report.Canonical)
	}
	if len(report.Favicons) != 2 {
		t.Fatalf("favicons = %#v, want 2 after dedupe", report.Favicons)
	}
	first := report.Favicons[0]
	if first.URL != "http://example.com/icon.png" || first.Rel != "shortcut icon" {
		t.Fatalf("first favicon = %#v", first)
	}
	if first.Sizes == nil || *first.Sizes != "32x32" || first.Type == nil || *first.Type != "image/png" {
		t.Fatalf("favicon attributes = %#v", first)
	}
	second := report.Favicons[1]
	if second.URL != "http://example.com/dir/icon2.png" || second.Rel != "apple-touch-icon" {
		t.Fatalf("second favicon = %#v", second)
	}
	if len(report.RawTags) != 17 {
		t.Fatalf("rawTags count = %d, want 17", len(report.RawTags))
	}
	foundLowercased := false
	for _, tag := range report.RawTags {
		if tag.TagName == "meta" && tag.Attrs["property"] == "og:title" {
			foundLowercased = true
		}
	}
	if !foundLowercased {
		t.Fatal("raw tag attribute names were not lowercased")
	}
}

func TestParseDocumentFirstMatchAndLastWins(t *testing.T) {
	// The first matching tag has no content: fall back to <title>.
	report := ParseDocument("https://example.com/", 200, 0, "", []byte(`<title> From title </title><meta property="og:title">`))
	if report.Title == nil || *report.Title != "From title" {
		t.Fatalf("title = %v, want From title", report.Title)
	}

	// A present-but-empty content is not replaced by a later tag.
	report = ParseDocument("https://example.com/", 200, 0, "", []byte(`<meta property="og:title" content="   "><meta property="og:title" content="Later"><title>Fallback</title>`))
	if report.Title == nil || *report.Title != "" {
		t.Fatalf("title = %v, want present empty string", report.Title)
	}

	// Normalized keys keep the last non-empty value; name/itemprop work too.
	report = ParseDocument("https://example.com/", 200, 0, "", []byte(`<meta name="og:title" content="One"><meta property="og:title" content="Two"><meta property="og:title" content="   "><meta name="og:description" content="Named description"><meta itemprop="author" content="Via itemprop">`))
	if report.OG["title"] != "Two" {
		t.Fatalf("og.title = %q, want Two", report.OG["title"])
	}
	if report.OG["description"] != "Named description" {
		t.Fatalf("og.description = %q, want Named description", report.OG["description"])
	}
	if report.Other["author"] != "Via itemprop" {
		t.Fatalf("other[author] = %q, want Via itemprop", report.Other["author"])
	}
}

func TestParseDocumentEmptyContainers(t *testing.T) {
	report := ParseDocument("https://example.com/", 200, 0, "", nil)
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, fragment := range []string{`"og":{}`, `"twitter":{}`, `"other":{}`, `"favicons":[]`, `"rawTags":[]`, `"issues":[]`, `"checks":[]`} {
		if !strings.Contains(text, fragment) {
			t.Errorf("JSON missing %s: %s", fragment, text)
		}
	}
	if strings.Contains(text, `"keywords"`) {
		t.Errorf("absent keywords should be omitted: %s", text)
	}

	// A keywords tag with only separators produces an explicit empty array.
	report = ParseDocument("https://example.com/", 200, 0, "", []byte(`<meta name="keywords" content=" , ">`))
	data, err = json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"keywords":[]`) {
		t.Fatalf("empty keywords array should be preserved: %s", data)
	}
}

func TestParseDocumentUTF8ByteLength(t *testing.T) {
	body := []byte(`<title>café ☕</title>`)
	report := ParseDocument("https://example.com/", 200, 0, "", body)
	if report.HTMLSizeBytes != len(body) {
		t.Fatalf("htmlSizeBytes = %d, want %d", report.HTMLSizeBytes, len(body))
	}
	if report.Title == nil || *report.Title != "café ☕" {
		t.Fatalf("title = %v", report.Title)
	}
}
