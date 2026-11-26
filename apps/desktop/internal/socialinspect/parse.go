package socialinspect

import (
	"strings"
	"unicode"

	"golang.org/x/net/html"
)

// trimJS mirrors String.prototype.trim(), including the BOM which Go's
// unicode.IsSpace does not treat as whitespace.
func trimJS(value string) string {
	return strings.TrimFunc(value, func(r rune) bool {
		return unicode.IsSpace(r) || r == '\uFEFF'
	})
}

// collectRawTags walks the whole document (not just <head>) in document order
// and reduces every meta/link/title element to lower-cased attributes.
func collectRawTags(root *html.Node) []MetaTag {
	tags := []MetaTag{}
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode {
			switch node.Data {
			case "meta", "link", "title":
				attrs := make(map[string]string, len(node.Attr))
				for _, attr := range node.Attr {
					attrs[strings.ToLower(attr.Key)] = attr.Val
				}
				tags = append(tags, MetaTag{TagName: node.Data, Attrs: attrs})
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return tags
}

// first returns the trimmed content of the *first* matching tag. As in the
// TypeScript implementation it does not continue when that tag has no content
// attribute: an empty result is final.
func first(tags []MetaTag, match func(map[string]string) bool) *string {
	for _, tag := range tags {
		if match(tag.Attrs) {
			content, ok := tag.Attrs["content"]
			if !ok {
				return nil
			}
			value := trimJS(content)
			return &value
		}
	}
	return nil
}

func textContent(node *html.Node) string {
	var out strings.Builder
	var walk func(*html.Node)
	walk = func(current *html.Node) {
		if current.Type == html.TextNode {
			out.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return out.String()
}

// firstTitleText returns the trimmed text of the first <title> element. Only
// the first element is considered; an empty title is not replaced by a later
// one, matching $("title").first().text().trim() || undefined.
func firstTitleText(root *html.Node) *string {
	// Locate the first title separately so an empty one is not skipped.
	var find func(*html.Node) *html.Node
	find = func(node *html.Node) *html.Node {
		if node.Type == html.ElementNode && node.Data == "title" {
			return node
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			if found := find(child); found != nil {
				return found
			}
		}
		return nil
	}
	title := find(root)
	if title == nil {
		return nil
	}
	value := trimJS(textContent(title))
	if value == "" {
		return nil
	}
	return &value
}

func hasIconRel(rel string) bool {
	tokens := strings.FieldsFunc(rel, func(r rune) bool {
		return unicode.IsSpace(r) || r == '\uFEFF'
	})
	for _, token := range tokens {
		switch token {
		case "icon", "shortcut", "apple-touch-icon", "mask-icon":
			return true
		}
	}
	return false
}

// ParseDocument turns raw HTML into normalized metadata. Status codes outside
// the 2xx range are still parsed, just like the TypeScript implementation.
func ParseDocument(finalURL string, status int, responseTimeMs int64, fetchedAt string, htmlBytes []byte) Report {
	root, err := html.Parse(strings.NewReader(string(htmlBytes)))
	if err != nil {
		root = &html.Node{Type: html.DocumentNode}
	}
	rawTags := collectRawTags(root)

	title := first(rawTags, func(attrs map[string]string) bool {
		return strings.ToLower(attrs["property"]) == "og:title"
	})
	if title == nil {
		title = firstTitleText(root)
	}
	description := first(rawTags, func(attrs map[string]string) bool {
		return strings.ToLower(attrs["property"]) == "og:description"
	})
	if description == nil {
		description = first(rawTags, func(attrs map[string]string) bool {
			return strings.ToLower(attrs["name"]) == "description"
		})
	}

	og := map[string]string{}
	twitter := map[string]string{}
	other := map[string]string{}

	for _, tag := range rawTags {
		content, ok := tag.Attrs["content"]
		if !ok {
			continue
		}
		content = trimJS(content)
		if content == "" {
			continue
		}
		property := strings.ToLower(tag.Attrs["property"])
		name := strings.ToLower(tag.Attrs["name"])
		itemprop := strings.ToLower(tag.Attrs["itemprop"])

		switch {
		case strings.HasPrefix(property, "og:"):
			og[property[3:]] = content
		case strings.HasPrefix(name, "og:"):
			og[name[3:]] = content
		case strings.HasPrefix(name, "twitter:"):
			twitter[name[8:]] = content
		case strings.HasPrefix(property, "twitter:"):
			twitter[property[8:]] = content
		case itemprop != "":
			other[itemprop] = content
		case name != "" && name != "description" && name != "keywords" && name != "viewport":
			other[name] = content
		}
	}

	var keywords *[]string
	if raw := first(rawTags, func(attrs map[string]string) bool {
		return strings.ToLower(attrs["name"]) == "keywords"
	}); raw != nil {
		words := []string{}
		for _, word := range strings.Split(*raw, ",") {
			if trimmed := trimJS(word); trimmed != "" {
				words = append(words, trimmed)
			}
		}
		keywords = &words
	}

	favicons := []Favicon{}
	seenIcons := map[string]bool{}
	for _, tag := range rawTags {
		if tag.TagName != "link" {
			continue
		}
		relValue, ok := tag.Attrs["rel"]
		if !ok {
			continue
		}
		rel := strings.ToLower(relValue)
		if !hasIconRel(rel) {
			continue
		}
		href := resolveAsset(finalURL, tag.Attrs["href"])
		if href == nil || seenIcons[*href] {
			continue
		}
		seenIcons[*href] = true
		icon := Favicon{URL: *href, Rel: rel}
		if sizes, ok := tag.Attrs["sizes"]; ok {
			value := sizes
			icon.Sizes = &value
		}
		if iconType, ok := tag.Attrs["type"]; ok {
			value := iconType
			icon.Type = &value
		}
		favicons = append(favicons, icon)
	}

	var canonical *string
	for _, tag := range rawTags {
		if tag.TagName != "link" || tag.Attrs["rel"] != "canonical" {
			continue
		}
		if href, ok := tag.Attrs["href"]; ok && href != "" {
			canonical = resolveAsset(finalURL, href)
		}
		break
	}

	var themeColor *string
	if value := first(rawTags, func(attrs map[string]string) bool {
		return strings.ToLower(attrs["name"]) == "theme-color"
	}); value != nil {
		themeColor = value
	}

	return Report{
		URL:            "",
		FinalURL:       finalURL,
		Status:         status,
		ResponseTimeMs: responseTimeMs,
		HTMLSizeBytes:  len(string(htmlBytes)),
		FetchedAt:      fetchedAt,
		Title:          title,
		Description:    description,
		Canonical:      canonical,
		ThemeColor:     themeColor,
		Keywords:       keywords,
		OG:             og,
		Twitter:        twitter,
		Other:          other,
		Favicons:       favicons,
		RawTags:        rawTags,
		Analysis:       Analysis{Issues: []Issue{}, Checks: []Check{}},
	}
}
