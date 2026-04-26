package cmd

import (
	"fmt"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
)

// resolveProjectID looks up a project by org slug + project slug and returns its ID.
func resolveProjectID(auth *config.Auth, cfg *config.ProjectConfig) (string, error) {
	c := client.New(auth.BaseURL, auth.AccessToken)

	// Get org ID from slug
	var orgs []struct {
		ID   string `json:"id"`
		Slug string `json:"slug"`
	}
	if err := c.Get("/orgs", &orgs); err != nil {
		return "", fmt.Errorf("list orgs: %w", err)
	}
	var orgID string
	for _, o := range orgs {
		if o.Slug == cfg.Org {
			orgID = o.ID
			break
		}
	}
	if orgID == "" {
		return "", fmt.Errorf("org '%s' not found — check .apiforge/config.yaml", cfg.Org)
	}

	// Get project ID from slug
	var projects []struct {
		ID   string `json:"id"`
		Slug string `json:"slug"`
	}
	if err := c.Get(fmt.Sprintf("/orgs/%s/projects", orgID), &projects); err != nil {
		return "", fmt.Errorf("list projects: %w", err)
	}
	for _, p := range projects {
		if p.Slug == cfg.Project {
			return p.ID, nil
		}
	}
	return "", fmt.Errorf("project '%s' not found in org '%s'", cfg.Project, cfg.Org)
}
