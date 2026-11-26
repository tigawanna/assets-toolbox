package socialinspect

import (
	"testing"
)

func TestNormalizeURL(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		want    string
		wantErr string
	}{
		{name: "bare host", input: "example.com", want: "https://example.com/"},
		{name: "bare host path", input: "example.com/path?q=1", want: "https://example.com/path?q=1"},
		{name: "fragment removed", input: "http://localhost:3000/foo#frag", want: "http://localhost:3000/foo"},
		{name: "case normalized", input: "HTTP://Example.COM", want: "http://example.com/"},
		{name: "default https port", input: "https://example.com:443/x", want: "https://example.com/x"},
		{name: "default http port", input: "http://example.com:80", want: "http://example.com/"},
		{name: "custom port", input: "http://example.com:8080", want: "http://example.com:8080/"},
		{name: "ipv6", input: "http://[::1]:3000/", want: "http://[::1]:3000/"},
		{name: "extra slashes", input: "https:////example.com/path", want: "https://example.com/path"},
		{name: "empty", input: "   ", wantErr: "URL is empty"},
		{name: "unsupported protocol", input: "ftp://example.com", wantErr: "Unsupported protocol: ftp:"},
		{name: "invalid host", input: "https://bad host", wantErr: "Invalid URL: https://bad host"},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			got, err := NormalizeURL(test.input)
			if test.wantErr != "" {
				if err == nil || err.Error() != test.wantErr {
					t.Fatalf("error = %v, want %q", err, test.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != test.want {
				t.Fatalf("NormalizeURL(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestIsLocalAndPrivateGuard(t *testing.T) {
	cases := []struct {
		input string
		local bool
	}{
		{"http://localhost:3000/", true},
		{"http://127.0.0.1/", true},
		{"http://[::1]/", true},
		{"http://0.0.0.0/", true},
		{"http://10.1.2.3/", true},
		{"http://169.254.1.1/", true},
		{"http://172.16.0.1/", true},
		{"http://172.31.0.1/", true},
		{"http://172.15.0.1/", false},
		{"http://192.168.1.1/", true},
		{"http://0.1.2.3/", true},
		{"http://[fd00::1]/", true},
		{"http://api.example.local/", true},
		{"http://api.example.localhost/", true},
		{"https://example.com/", false},
	}
	for _, test := range cases {
		target, err := normalizeTarget(test.input)
		if err != nil {
			t.Fatalf("normalizeTarget(%q): %v", test.input, err)
		}
		if target.IsLocal != test.local {
			t.Errorf("IsLocal(%q) = %v, want %v", test.input, target.IsLocal, test.local)
		}
	}

	target, _ := normalizeTarget("http://localhost/")
	err := assertFetchAllowed(target, false)
	if err == nil {
		t.Fatal("expected private fetch to be refused")
	}
	want := "Refusing to fetch private/local address http://localhost/. Pass allowPrivate: true to override."
	if err.Error() != want {
		t.Fatalf("error = %q, want %q", err.Error(), want)
	}
	if err := assertFetchAllowed(target, true); err != nil {
		t.Fatalf("allowPrivate=true should succeed: %v", err)
	}
}

func TestResolveAsset(t *testing.T) {
	base := "http://example.com/dir/page"
	cases := []struct {
		value string
		want  string
	}{
		{"", ""},
		{"/img.png", "http://example.com/img.png"},
		{"img.png", "http://example.com/dir/img.png"},
		{"https://cdn.example/x.png", "https://cdn.example/x.png"},
		{"//cdn.example/x.png", "http://cdn.example/x.png"},
	}
	for _, test := range cases {
		got := resolveAsset(base, test.value)
		if test.want == "" {
			if got != nil {
				t.Errorf("resolveAsset(%q) = %q, want nil", test.value, *got)
			}
			continue
		}
		if got == nil || *got != test.want {
			t.Errorf("resolveAsset(%q) = %v, want %q", test.value, got, test.want)
		}
	}
	if got := resolveAsset(base, "http://%zz"); got != nil {
		t.Errorf("invalid asset URL should resolve to nil, got %q", *got)
	}
}
