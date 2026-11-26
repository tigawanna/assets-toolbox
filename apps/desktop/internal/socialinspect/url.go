package socialinspect

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/net/idna"
)

var schemePattern = regexp.MustCompile(`(?i)^[a-z][a-z0-9+.-]*://`)

// urlTarget mirrors the TypeScript UrlTarget. Input is kept for error messages
// and IsLocal drives the private-network guard.
type urlTarget struct {
	Input   string
	URL     string
	IsLocal bool
}

var localHosts = map[string]bool{
	"localhost": true,
	"127.0.0.1": true,
	"::1":       true,
	"[::1]":     true,
	"0.0.0.0":   true,
}

// looksPrivate ports the looksPrivate() predicate from url.ts.
func looksPrivate(host string) bool {
	if host == "" {
		return false
	}
	if localHosts[host] {
		return true
	}
	if privateIPv4(host) {
		return true
	}
	lower := strings.ToLower(host)
	for _, prefix := range []string{"fc", "fd", "fe80"} {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return strings.HasSuffix(lower, ".local") || strings.HasSuffix(lower, ".localhost")
}

// privateIPv4 matches /^(10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|0)\./
func privateIPv4(host string) bool {
	parts := strings.Split(host, ".")
	if len(parts) < 2 {
		return false
	}
	switch parts[0] {
	case "10", "127", "0":
		return true
	case "169":
		return parts[1] == "254"
	case "192":
		return parts[1] == "168"
	case "172":
		second, err := strconv.Atoi(parts[1])
		return err == nil && second >= 16 && second <= 31
	default:
		return false
	}
}

// NormalizeURL accepts a bare host, a host with a path, or a full URL. Bare
// inputs default to https, fragments are removed, and the result is a
// browser-style URL string.
func NormalizeURL(input string) (string, error) {
	target, err := normalizeTarget(input)
	if err != nil {
		return "", err
	}
	return target.URL, nil
}

func normalizeTarget(input string) (*urlTarget, error) {
	trimmed := trimJS(input)
	if trimmed == "" {
		return nil, errors.New("URL is empty")
	}

	candidate := trimmed
	if match := schemePattern.FindStringIndex(trimmed); match != nil {
		// The WHATWG parser collapses extra slashes after the scheme.
		rest := strings.TrimLeft(trimmed[match[1]:], "/\\")
		candidate = trimmed[:match[1]] + rest
	} else {
		candidate = "https://" + trimmed
	}

	parsed, err := url.Parse(candidate)
	if err != nil || parsed.Host == "" {
		return nil, fmt.Errorf("Invalid URL: %s", input)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("Unsupported protocol: %s:", parsed.Scheme)
	}

	hostName := parsed.Hostname()
	if !validHost(hostName) {
		return nil, fmt.Errorf("Invalid URL: %s", input)
	}
	hostName = strings.ToLower(hostName)
	if needsIDNA(hostName) {
		ascii, idnaErr := idna.Lookup.ToASCII(hostName)
		if idnaErr != nil {
			return nil, fmt.Errorf("Invalid URL: %s", input)
		}
		hostName = ascii
	}

	// A URL created by the browser lower-cases the host and drops the default
	// port for the http/https schemes.
	port := parsed.Port()
	host := hostName
	if port != "" {
		if (parsed.Scheme == "https" && port == "443") || (parsed.Scheme == "http" && port == "80") {
			// default port is omitted below
		} else {
			host = hostName + ":" + port
		}
	}
	if strings.HasPrefix(parsed.Host, "[") {
		// Hostname() removes the brackets of an IPv6 literal; put them back.
		if port != "" && host != hostName {
			host = "[" + hostName + "]:" + port
		} else {
			host = "[" + hostName + "]"
		}
	}
	parsed.Host = host

	if parsed.Path == "" {
		parsed.Path = "/"
	}
	parsed.Fragment = ""
	parsed.RawFragment = ""

	rawHost := strings.Trim(parsed.Hostname(), "[]")
	return &urlTarget{
		Input:   trimmed,
		URL:     parsed.String(),
		IsLocal: looksPrivate(rawHost),
	}, nil
}

func validHost(host string) bool {
	if host == "" {
		return false
	}
	for _, r := range host {
		if r <= 0x20 || r == 0x7f || unicode.IsSpace(r) {
			return false
		}
		switch r {
		case '#', '/', '?', '@', '<', '>', '\\', '^', '|', '[', ']':
			return false
		}
	}
	return true
}

func needsIDNA(host string) bool {
	for _, r := range host {
		if r > 0x7f {
			return true
		}
	}
	return false
}

// assertFetchAllowed guards against fetching internal services.
func assertFetchAllowed(target *urlTarget, allowPrivate bool) error {
	if !allowPrivate && target.IsLocal {
		return fmt.Errorf(
			"Refusing to fetch private/local address %s. Pass allowPrivate: true to override.",
			target.URL,
		)
	}
	return nil
}

// resolveAsset resolves a possibly-relative asset URL against its page.
func resolveAsset(base, value string) *string {
	if value == "" {
		return nil
	}
	// The WHATWG URL parser strips leading/trailing C0 controls and spaces.
	value = strings.TrimFunc(value, func(r rune) bool { return r <= 0x20 })
	baseURL, err := url.Parse(base)
	if err != nil {
		return nil
	}
	resolved, err := baseURL.Parse(value)
	if err != nil {
		return nil
	}
	result := resolved.String()
	return &result
}
