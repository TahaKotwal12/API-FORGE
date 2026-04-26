package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a new .apiforge/config.yaml in the current directory",
	RunE: func(cmd *cobra.Command, args []string) error {
		auth, _ := config.LoadAuth()

		reader := bufio.NewReader(os.Stdin)

		prompt := func(label, fallback string) string {
			if fallback != "" {
				fmt.Printf("%s [%s]: ", label, fallback)
			} else {
				fmt.Printf("%s: ", label)
			}
			line, _ := reader.ReadString('\n')
			line = strings.TrimSpace(line)
			if line == "" {
				return fallback
			}
			return line
		}

		baseURL := ""
		if auth != nil {
			baseURL = auth.BaseURL
		}
		baseURL = prompt("Backend URL", baseURL)
		org := prompt("Org slug", "")
		project := prompt("Project slug", "")
		branch := prompt("Default branch", "main")
		specFile := prompt("Spec file", "openapi.yaml")

		cfg := &config.ProjectConfig{
			Version:       1,
			Org:           org,
			Project:       project,
			DefaultBranch: branch,
			SpecFile:      specFile,
			BaseURL:       baseURL,
		}
		if err := config.SaveProject(cfg); err != nil {
			return fmt.Errorf("save config: %w", err)
		}

		fmt.Printf("✓ Initialized .apiforge/config.yaml (org=%s project=%s)\n", org, project)
		return nil
	},
}
