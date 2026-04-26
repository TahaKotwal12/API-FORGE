// Package config manages ~/.config/forge/auth.json and .apiforge/config.yaml.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Auth struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	Email        string `json:"email"`
	BaseURL      string `json:"base_url"`
}

type ProjectConfig struct {
	Version       int    `yaml:"version"`
	Org           string `yaml:"org"`
	Project       string `yaml:"project"`
	DefaultBranch string `yaml:"default_branch"`
	SpecFile      string `yaml:"spec_file"`
	BaseURL       string `yaml:"base_url"`
}

func authPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "forge", "auth.json"), nil
}

func LoadAuth() (*Auth, error) {
	p, err := authPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, errors.New("not logged in — run 'forge login' first")
		}
		return nil, err
	}
	var a Auth
	if err := json.Unmarshal(data, &a); err != nil {
		return nil, err
	}
	return &a, nil
}

func SaveAuth(a *Auth) error {
	p, err := authPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(a, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0600)
}

func ClearAuth() error {
	p, err := authPath()
	if err != nil {
		return err
	}
	return os.Remove(p)
}

const projectConfigFile = ".apiforge/config.yaml"

func LoadProject() (*ProjectConfig, error) {
	data, err := os.ReadFile(projectConfigFile)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, errors.New("no .apiforge/config.yaml found — run 'forge init' first")
		}
		return nil, err
	}
	var cfg ProjectConfig
	if err := parseYAML(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.DefaultBranch == "" {
		cfg.DefaultBranch = "main"
	}
	if cfg.SpecFile == "" {
		cfg.SpecFile = "openapi.yaml"
	}
	return &cfg, nil
}

func SaveProject(cfg *ProjectConfig) error {
	if err := os.MkdirAll(".apiforge", 0755); err != nil {
		return err
	}
	content := formatYAML(cfg)
	return os.WriteFile(projectConfigFile, []byte(content), 0644)
}

func formatYAML(cfg *ProjectConfig) string {
	return fmt.Sprintf("version: %d\norg: %s\nproject: %s\ndefault_branch: %s\nspec_file: %s\nbase_url: %s\n",
		cfg.Version, cfg.Org, cfg.Project, cfg.DefaultBranch, cfg.SpecFile, cfg.BaseURL)
}

func parseYAML(data []byte, out *ProjectConfig) error {
	lines := splitLines(string(data))
	for _, line := range lines {
		if len(line) == 0 || line[0] == '#' {
			continue
		}
		key, val, ok := cutColon(line)
		if !ok {
			continue
		}
		switch key {
		case "version":
			fmt.Sscanf(val, "%d", &out.Version)
		case "org":
			out.Org = val
		case "project":
			out.Project = val
		case "default_branch":
			out.DefaultBranch = val
		case "spec_file":
			out.SpecFile = val
		case "base_url":
			out.BaseURL = val
		}
	}
	return nil
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, strings.TrimSpace(s[start:i]))
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, strings.TrimSpace(s[start:]))
	}
	return lines
}

func cutColon(s string) (string, string, bool) {
	for i := 0; i < len(s); i++ {
		if s[i] == ':' {
			return strings.TrimSpace(s[:i]), strings.TrimSpace(s[i+1:]), true
		}
	}
	return "", "", false
}
