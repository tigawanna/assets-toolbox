package socialinspect

import (
	"math"
	"strconv"
	"strings"
)

type scoringCheck struct {
	label       string
	weight      int
	key         func(checkInput) *string
	level       string
	code        string
	message     string
	name        string
	description string
	html        func(checkInput) string
	prompt      func(checkInput) string
	detail      func(*string) string
}

func mapValue(values map[string]string, key string) *string {
	if value, ok := values[key]; ok {
		return &value
	}
	return nil
}

func withFallback(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	return *value
}

// site is the placeholder used when no target URL is present.
func site(input checkInput) string {
	return withFallback(input.URL, "https://example.com")
}

// assetBase strips trailing slashes so asset paths can be appended.
func assetBase(input checkInput) string {
	return strings.TrimRight(site(input), "/")
}

var checks = []scoringCheck{
	{
		label:       "Page title",
		weight:      20,
		key:         func(in checkInput) *string { return in.Title },
		level:       "error",
		code:        "MISSING_TITLE",
		message:     "Add a <title> or og:title tag.",
		name:        "Give the page a title",
		description: "The title is the main headline in search results and link previews. Keep it under 60 characters and use the same text for og:title.",
		html:        func(checkInput) string { return "<title>Your page title</title>" },
		prompt: func(checkInput) string {
			return "Add a descriptive <title> element to the page's <head>. Keep it under 60 characters and keep it in sync with og:title if that tag exists."
		},
		detail: func(value *string) string { return withFallback(value, "Missing <title> and og:title") },
	},
	{
		label:       "Description",
		weight:      15,
		key:         func(in checkInput) *string { return in.Description },
		level:       "error",
		code:        "MISSING_DESCRIPTION",
		message:     "Add a meta description or og:description tag.",
		name:        "Describe the page",
		description: "A description of 150\u2013160 characters is what search engines and social networks show under the title. Write it for someone who has not visited the page yet.",
		html: func(checkInput) string {
			return `<meta name="description" content="A concise summary of what this page offers." />`
		},
		prompt: func(checkInput) string {
			return "Write a 150\u2013160 character meta description for this page based on its actual content, then add it as <meta name=\"description\"> in <head>. Use plain language and avoid keyword stuffing."
		},
		detail: func(value *string) string { return withFallback(value, "Missing description") },
	},
	{
		label:       "og:title",
		weight:      10,
		key:         func(in checkInput) *string { return mapValue(in.OG, "title") },
		level:       "warning",
		code:        "MISSING_OG_TITLE",
		message:     "Add an og:title tag for social sharing.",
		name:        "Add an Open Graph title",
		description: "Social networks prefer og:title over <title>. It can be slightly punchier, but it should still describe the same page.",
		html: func(checkInput) string {
			return `<meta property="og:title" content="Your page title" />`
		},
		prompt: func(checkInput) string {
			return "Add an og:title meta tag to <head>. Match the page's <title> unless a shorter, more social-friendly variant is more accurate."
		},
		detail: func(value *string) string { return withFallback(value, "Missing og:title") },
	},
	{
		label:       "og:description",
		weight:      10,
		key:         func(in checkInput) *string { return mapValue(in.OG, "description") },
		level:       "warning",
		code:        "MISSING_OG_DESCRIPTION",
		message:     "Add an og:description tag.",
		name:        "Add an Open Graph description",
		description: "This is the summary shown on Facebook, LinkedIn, Slack and most other previews. It usually matches the meta description.",
		html: func(checkInput) string {
			return `<meta property="og:description" content="A concise summary of what this page offers." />`
		},
		prompt: func(checkInput) string {
			return "Add an og:description meta tag to <head>. Reuse the meta description when one exists, otherwise write a 150\u2013160 character summary from the page content."
		},
		detail: func(value *string) string { return withFallback(value, "Missing og:description") },
	},
	{
		label:       "og:image",
		weight:      15,
		key:         func(in checkInput) *string { return mapValue(in.OG, "image") },
		level:       "error",
		code:        "MISSING_OG_IMAGE",
		message:     "Add an og:image so links render with a preview image.",
		name:        "Add a share image",
		description: "An absolute, 1200\u00d7630 image is the safest share image. Use an absolute URL so crawlers on other domains can fetch it.",
		html: func(in checkInput) string {
			return `<meta property="og:image" content="` + assetBase(in) + `/og.png" />`
		},
		prompt: func(in checkInput) string {
			return "Create or reuse a 1200\u00d7630 PNG share image for " + site(in) + ", then add an og:image meta tag with its absolute URL. The image must be publicly reachable without authentication."
		},
		detail: func(value *string) string { return withFallback(value, "Missing og:image") },
	},
	{
		label:  "og:image dimensions",
		weight: 5,
		key: func(in checkInput) *string {
			width := in.OG["image:width"]
			height := in.OG["image:height"]
			if width == "" || height == "" {
				return nil
			}
			value := width + "x" + height
			return &value
		},
		level:       "info",
		code:        "MISSING_OG_DIMENSIONS",
		message:     "Declare og:image:width and og:image:height for consistent previews.",
		name:        "Declare the share image size",
		description: "Stating the dimensions lets crawlers reserve the right space before the image loads, which avoids layout shift in previews.",
		html: func(checkInput) string {
			return "<meta property=\"og:image:width\" content=\"1200\" />\n<meta property=\"og:image:height\" content=\"630\" />"
		},
		prompt: func(checkInput) string {
			return "Add og:image:width and og:image:height meta tags matching the actual pixel dimensions of the og:image file (1200\u00d7630 is recommended)."
		},
		detail: func(value *string) string {
			return withFallback(value, "No og:image:width / og:image:height")
		},
	},
	{
		label:       "og:type",
		weight:      3,
		key:         func(in checkInput) *string { return mapValue(in.OG, "type") },
		level:       "info",
		code:        "MISSING_OG_TYPE",
		message:     "Declare og:type (e.g. website).",
		name:        "Declare the content type",
		description: "og:type tells crawlers what kind of page this is. \"website\" is correct for most pages; articles and products have their own types.",
		html: func(checkInput) string {
			return `<meta property="og:type" content="website" />`
		},
		prompt: func(checkInput) string {
			return "Add an og:type meta tag. Use \"website\" for general pages, or the correct Open Graph type such as \"article\" for blog posts."
		},
		detail: func(value *string) string { return withFallback(value, "Missing og:type") },
	},
	{
		label:       "og:url",
		weight:      3,
		key:         func(in checkInput) *string { return mapValue(in.OG, "url") },
		level:       "info",
		code:        "MISSING_OG_URL",
		message:     "Declare a canonical og:url.",
		name:        "Declare a canonical URL",
		description: "og:url is the permanent address of this page. It stops likes and shares being attributed to a different URL when the page is reached via a redirect or query string.",
		html: func(in checkInput) string {
			return `<meta property="og:url" content="` + site(in) + `" />`
		},
		prompt: func(in checkInput) string {
			return "Add an og:url meta tag pointing to the canonical address of this page (" + site(in) + "). Use an absolute URL with no tracking parameters."
		},
		detail: func(value *string) string { return withFallback(value, "Missing og:url") },
	},
	{
		label:       "Twitter card",
		weight:      8,
		key:         func(in checkInput) *string { return mapValue(in.Twitter, "card") },
		level:       "warning",
		code:        "MISSING_TWITTER_CARD",
		message:     "Add twitter:card for X/Twitter previews.",
		name:        "Choose an X card type",
		description: "twitter:card selects the layout on X. \"summary_large_image\" gives you a full-width image and is the usual choice when a share image exists.",
		html: func(checkInput) string {
			return `<meta name="twitter:card" content="summary_large_image" />`
		},
		prompt: func(checkInput) string {
			return "Add a twitter:card meta tag. Use \"summary_large_image\" when an og:image is available, otherwise \"summary\"."
		},
		detail: func(value *string) string { return withFallback(value, "Missing twitter:card") },
	},
	{
		label:       "Twitter image",
		weight:      5,
		key:         func(in checkInput) *string { return mapValue(in.Twitter, "image") },
		level:       "info",
		code:        "MISSING_TWITTER_IMAGE",
		message:     "Add twitter:image; many platforms fall back to og:image.",
		name:        "Add an X share image",
		description: "X will fall back to og:image, but an explicit twitter:image guarantees the right image is used and lets you tailor it per network.",
		html: func(in checkInput) string {
			return `<meta name="twitter:image" content="` + assetBase(in) + `/og.png" />`
		},
		prompt: func(in checkInput) string {
			return "Add a twitter:image meta tag with an absolute URL to the share image (" + assetBase(in) + "/og.png is a sensible default when og:image already points there)."
		},
		detail: func(value *string) string { return withFallback(value, "Missing twitter:image") },
	},
	{
		label:  "Favicon",
		weight: 6,
		key: func(in checkInput) *string {
			if in.FaviconCount > 0 {
				value := strconv.Itoa(in.FaviconCount) + " found"
				return &value
			}
			return nil
		},
		level:       "warning",
		code:        "MISSING_FAVICON",
		message:     "Add a favicon link so browsers and Google results show an icon.",
		name:        "Add a favicon",
		description: "The favicon appears in browser tabs, bookmarks and Google search results. An SVG icon scales cleanly; keep a PNG fallback for older clients.",
		html: func(checkInput) string {
			return `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
		},
		prompt: func(checkInput) string {
			return "Add a <link rel=\"icon\"> to <head>. Prefer an SVG icon at /favicon.svg and keep a 32\u00d732 PNG fallback. Reuse the brand mark already used elsewhere in the project."
		},
		detail: func(value *string) string { return withFallback(value, "No <link rel=\"icon\"> found") },
	},
}

// Analyze scores a report in place, preserving the exact check order, weights,
// issue strings and verdicts of analyze.ts.
func Analyze(report *Report) {
	if report == nil {
		return
	}
	input := checkInput{
		URL:          &report.FinalURL,
		Title:        report.Title,
		Description:  report.Description,
		FaviconCount: len(report.Favicons),
		OG:           report.OG,
		Twitter:      report.Twitter,
	}

	issues := []Issue{}
	results := make([]Check, 0, len(checks))
	for _, check := range checks {
		value := check.key(input)
		passed := value != nil && *value != ""
		if !passed {
			issues = append(issues, Issue{
				Level:       check.level,
				Code:        check.code,
				Message:     check.message,
				Name:        check.name,
				Description: check.description,
				HTML:        check.html(input),
				Prompt:      check.prompt(input),
			})
		}
		results = append(results, Check{
			Label:  check.label,
			Passed: passed,
			Detail: check.detail(value),
			Weight: check.weight,
		})
	}

	total := 0
	for _, check := range checks {
		total += check.weight
	}
	earned := 0
	for _, result := range results {
		if result.Passed {
			earned += result.Weight
		}
	}
	score := int(math.Round(float64(earned) / float64(total) * 100))

	errors := 0
	for _, issue := range issues {
		if issue.Level == "error" {
			errors++
		}
	}
	verdict := "Good setup \u2014 minor improvements possible."
	if score == 100 {
		verdict = "Excellent! Your Open Graph tags are well-configured."
	} else if errors > 0 {
		verdict = "A few important social tags are missing."
	}

	report.Analysis = Analysis{
		Score:   score,
		Verdict: verdict,
		Issues:  issues,
		Checks:  results,
	}
}
