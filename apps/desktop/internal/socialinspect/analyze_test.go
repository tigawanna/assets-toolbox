package socialinspect

import (
	"reflect"
	"strings"
	"testing"
)

func expectedIssues() []Issue {
	return []Issue{
		{
			Level: "error", Code: "MISSING_TITLE",
			Message:     "Add a <title> or og:title tag.",
			Name:        "Give the page a title",
			Description: "The title is the main headline in search results and link previews. Keep it under 60 characters and use the same text for og:title.",
			HTML:        "<title>Your page title</title>",
			Prompt:      "Add a descriptive <title> element to the page's <head>. Keep it under 60 characters and keep it in sync with og:title if that tag exists.",
		},
		{
			Level: "error", Code: "MISSING_DESCRIPTION",
			Message:     "Add a meta description or og:description tag.",
			Name:        "Describe the page",
			Description: "A description of 150–160 characters is what search engines and social networks show under the title. Write it for someone who has not visited the page yet.",
			HTML:        `<meta name="description" content="A concise summary of what this page offers." />`,
			Prompt:      `Write a 150–160 character meta description for this page based on its actual content, then add it as <meta name="description"> in <head>. Use plain language and avoid keyword stuffing.`,
		},
		{
			Level: "warning", Code: "MISSING_OG_TITLE",
			Message:     "Add an og:title tag for social sharing.",
			Name:        "Add an Open Graph title",
			Description: "Social networks prefer og:title over <title>. It can be slightly punchier, but it should still describe the same page.",
			HTML:        `<meta property="og:title" content="Your page title" />`,
			Prompt:      "Add an og:title meta tag to <head>. Match the page's <title> unless a shorter, more social-friendly variant is more accurate.",
		},
		{
			Level: "warning", Code: "MISSING_OG_DESCRIPTION",
			Message:     "Add an og:description tag.",
			Name:        "Add an Open Graph description",
			Description: "This is the summary shown on Facebook, LinkedIn, Slack and most other previews. It usually matches the meta description.",
			HTML:        `<meta property="og:description" content="A concise summary of what this page offers." />`,
			Prompt:      "Add an og:description meta tag to <head>. Reuse the meta description when one exists, otherwise write a 150–160 character summary from the page content.",
		},
		{
			Level: "error", Code: "MISSING_OG_IMAGE",
			Message:     "Add an og:image so links render with a preview image.",
			Name:        "Add a share image",
			Description: "An absolute, 1200×630 image is the safest share image. Use an absolute URL so crawlers on other domains can fetch it.",
			HTML:        `<meta property="og:image" content="https://example.com/og.png" />`,
			Prompt:      "Create or reuse a 1200×630 PNG share image for https://example.com/, then add an og:image meta tag with its absolute URL. The image must be publicly reachable without authentication.",
		},
		{
			Level: "info", Code: "MISSING_OG_DIMENSIONS",
			Message:     "Declare og:image:width and og:image:height for consistent previews.",
			Name:        "Declare the share image size",
			Description: "Stating the dimensions lets crawlers reserve the right space before the image loads, which avoids layout shift in previews.",
			HTML:        "<meta property=\"og:image:width\" content=\"1200\" />\n<meta property=\"og:image:height\" content=\"630\" />",
			Prompt:      "Add og:image:width and og:image:height meta tags matching the actual pixel dimensions of the og:image file (1200×630 is recommended).",
		},
		{
			Level: "info", Code: "MISSING_OG_TYPE",
			Message:     "Declare og:type (e.g. website).",
			Name:        "Declare the content type",
			Description: `og:type tells crawlers what kind of page this is. "website" is correct for most pages; articles and products have their own types.`,
			HTML:        `<meta property="og:type" content="website" />`,
			Prompt:      `Add an og:type meta tag. Use "website" for general pages, or the correct Open Graph type such as "article" for blog posts.`,
		},
		{
			Level: "info", Code: "MISSING_OG_URL",
			Message:     "Declare a canonical og:url.",
			Name:        "Declare a canonical URL",
			Description: "og:url is the permanent address of this page. It stops likes and shares being attributed to a different URL when the page is reached via a redirect or query string.",
			HTML:        `<meta property="og:url" content="https://example.com/" />`,
			Prompt:      "Add an og:url meta tag pointing to the canonical address of this page (https://example.com/). Use an absolute URL with no tracking parameters.",
		},
		{
			Level: "warning", Code: "MISSING_TWITTER_CARD",
			Message:     "Add twitter:card for X/Twitter previews.",
			Name:        "Choose an X card type",
			Description: `twitter:card selects the layout on X. "summary_large_image" gives you a full-width image and is the usual choice when a share image exists.`,
			HTML:        `<meta name="twitter:card" content="summary_large_image" />`,
			Prompt:      `Add a twitter:card meta tag. Use "summary_large_image" when an og:image is available, otherwise "summary".`,
		},
		{
			Level: "info", Code: "MISSING_TWITTER_IMAGE",
			Message:     "Add twitter:image; many platforms fall back to og:image.",
			Name:        "Add an X share image",
			Description: "X will fall back to og:image, but an explicit twitter:image guarantees the right image is used and lets you tailor it per network.",
			HTML:        `<meta name="twitter:image" content="https://example.com/og.png" />`,
			Prompt:      "Add a twitter:image meta tag with an absolute URL to the share image (https://example.com/og.png is a sensible default when og:image already points there).",
		},
		{
			Level: "warning", Code: "MISSING_FAVICON",
			Message:     "Add a favicon link so browsers and Google results show an icon.",
			Name:        "Add a favicon",
			Description: "The favicon appears in browser tabs, bookmarks and Google search results. An SVG icon scales cleanly; keep a PNG fallback for older clients.",
			HTML:        `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`,
			Prompt:      "Add a <link rel=\"icon\"> to <head>. Prefer an SVG icon at /favicon.svg and keep a 32×32 PNG fallback. Reuse the brand mark already used elsewhere in the project.",
		},
	}
}

func expectedChecks() []Check {
	return []Check{
		{Label: "Page title", Passed: false, Detail: "Missing <title> and og:title", Weight: 20},
		{Label: "Description", Passed: false, Detail: "Missing description", Weight: 15},
		{Label: "og:title", Passed: false, Detail: "Missing og:title", Weight: 10},
		{Label: "og:description", Passed: false, Detail: "Missing og:description", Weight: 10},
		{Label: "og:image", Passed: false, Detail: "Missing og:image", Weight: 15},
		{Label: "og:image dimensions", Passed: false, Detail: "No og:image:width / og:image:height", Weight: 5},
		{Label: "og:type", Passed: false, Detail: "Missing og:type", Weight: 3},
		{Label: "og:url", Passed: false, Detail: "Missing og:url", Weight: 3},
		{Label: "Twitter card", Passed: false, Detail: "Missing twitter:card", Weight: 8},
		{Label: "Twitter image", Passed: false, Detail: "Missing twitter:image", Weight: 5},
		{Label: "Favicon", Passed: false, Detail: `No <link rel="icon"> found`, Weight: 6},
	}
}

func TestAnalyzeExactEmptyReport(t *testing.T) {
	report := Report{FinalURL: "https://example.com/", OG: map[string]string{}, Twitter: map[string]string{}}
	Analyze(&report)
	if report.Analysis.Score != 0 {
		t.Fatalf("score = %d, want 0", report.Analysis.Score)
	}
	if report.Analysis.Verdict != "A few important social tags are missing." {
		t.Fatalf("verdict = %q", report.Analysis.Verdict)
	}
	if !reflect.DeepEqual(report.Analysis.Issues, expectedIssues()) {
		t.Fatalf("issues mismatch:\ngot  %#v\nwant %#v", report.Analysis.Issues, expectedIssues())
	}
	if !reflect.DeepEqual(report.Analysis.Checks, expectedChecks()) {
		t.Fatalf("checks mismatch:\ngot  %#v\nwant %#v", report.Analysis.Checks, expectedChecks())
	}

	data, err := marshalJSON(report.Analysis)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	if !strings.HasPrefix(text, `{"score":0,"verdict":"A few important social tags are missing.","issues":[{"level":"error","code":"MISSING_TITLE"`) {
		t.Fatalf("unexpected analysis JSON prefix: %s", text)
	}
	if strings.Contains(text, "null") {
		t.Fatalf("analysis JSON must not contain null: %s", text)
	}
}

func TestAnalyzePerfectReport(t *testing.T) {
	title := "Title"
	description := "Description"
	report := Report{
		FinalURL:    "https://example.com/page/",
		Title:       &title,
		Description: &description,
		Favicons:    []Favicon{{URL: "https://example.com/favicon.ico", Rel: "icon"}},
		OG: map[string]string{
			"title":       "OG title",
			"description": "OG description",
			"image":       "https://example.com/og.png",
			"image:width": "1200", "image:height": "630",
			"type": "website", "url": "https://example.com/page/",
		},
		Twitter: map[string]string{"card": "summary_large_image", "image": "https://example.com/og.png"},
	}
	Analyze(&report)
	if report.Analysis.Score != 100 {
		t.Fatalf("score = %d, want 100", report.Analysis.Score)
	}
	if report.Analysis.Verdict != "Excellent! Your Open Graph tags are well-configured." {
		t.Fatalf("verdict = %q", report.Analysis.Verdict)
	}
	if len(report.Analysis.Issues) != 0 {
		t.Fatalf("issues = %#v, want none", report.Analysis.Issues)
	}
	for _, check := range report.Analysis.Checks {
		if !check.Passed {
			t.Errorf("check %q should pass", check.Label)
		}
	}
	data, err := marshalJSON(report.Analysis)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"issues":[]`) {
		t.Fatalf("issues should be an empty array: %s", data)
	}
}

func TestAnalyzePartialScoreAndEmptyValueDetail(t *testing.T) {
	title := "Title"
	description := "" // present but empty: detail is empty, not the fallback
	report := Report{
		FinalURL:    "https://example.com/",
		Title:       &title,
		Description: &description,
		Favicons:    []Favicon{{URL: "https://example.com/favicon.ico", Rel: "icon"}},
		OG:          map[string]string{},
		Twitter:     map[string]string{},
	}
	Analyze(&report)
	if report.Analysis.Score != 26 { // 20 (title) + 6 (favicon); empty description fails
		t.Fatalf("score = %d, want 26", report.Analysis.Score)
	}
	if report.Analysis.Verdict != "A few important social tags are missing." {
		t.Fatalf("verdict = %q", report.Analysis.Verdict)
	}
	if len(report.Analysis.Issues) != 9 {
		t.Fatalf("issues = %d, want 9", len(report.Analysis.Issues))
	}
	if report.Analysis.Checks[1].Passed || report.Analysis.Checks[1].Detail != "" {
		t.Fatalf("empty description check = %#v", report.Analysis.Checks[1])
	}
	foundDescriptionIssue := false
	for _, issue := range report.Analysis.Issues {
		if issue.Code == "MISSING_DESCRIPTION" {
			foundDescriptionIssue = true
		}
	}
	if !foundDescriptionIssue {
		t.Fatal("empty description must still emit the issue")
	}
}

func TestAnalyzeGoodSetupVerdict(t *testing.T) {
	title := "Title"
	description := "Description"
	image := "https://example.com/og.png"
	report := Report{
		FinalURL:    "https://example.com/",
		Title:       &title,
		Description: &description,
		OG:          map[string]string{"image": image},
		Twitter:     map[string]string{},
	}
	Analyze(&report)
	if report.Analysis.Score != 50 {
		t.Fatalf("score = %d, want 50", report.Analysis.Score)
	}
	if report.Analysis.Verdict != "Good setup — minor improvements possible." {
		t.Fatalf("verdict = %q", report.Analysis.Verdict)
	}
}
