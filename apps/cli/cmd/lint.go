package cmd

import (
	"fmt"
	"os"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
)

var lintCmd = &cobra.Command{
	Use:   "lint [spec-file]",
	Short: "Lint the spec against APIForge rules",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		auth, err := config.LoadAuth()
		if err != nil {
			return err
		}
		cfg, err := config.LoadProject()
		if err != nil {
			return err
		}

		specPath := cfg.SpecFile
		if len(args) > 0 {
			specPath = args[0]
		}

		content, err := os.ReadFile(specPath)
		if err != nil {
			return fmt.Errorf("read %s: %w", specPath, err)
		}

		projectID, err := resolveProjectID(auth, cfg)
		if err != nil {
			return err
		}

		branch := cfg.DefaultBranch
		if b, _ := cmd.Flags().GetString("branch"); b != "" {
			branch = b
		}
		ruleset, _ := cmd.Flags().GetString("ruleset")

		c := client.New(auth.BaseURL, auth.AccessToken)

		// Import first so the branch has latest state
		_ = c.Post(
			fmt.Sprintf("/projects/%s/branches/%s/spec/import", projectID, branch),
			map[string]string{"content": string(content)},
			nil,
		)

		var result struct {
			ErrorCount int `json:"errorCount"`
			WarnCount  int `json:"warnCount"`
			Passed     bool `json:"passed"`
			Issues     []struct {
				Code     string   `json:"code"`
				Message  string   `json:"message"`
				Severity string   `json:"severity"`
				Path     []string `json:"path"`
			} `json:"issues"`
		}
		if err := c.Post(
			fmt.Sprintf("/projects/%s/branches/%s/lint", projectID, branch),
			map[string]string{"ruleset": ruleset},
			&result,
		); err != nil {
			return fmt.Errorf("lint: %w", err)
		}

		for _, issue := range result.Issues {
			icon := "⚠"
			if issue.Severity == "error" {
				icon = "✖"
			}
			fmt.Printf("%s [%s] %s  path: %v\n", icon, issue.Code, issue.Message, issue.Path)
		}

		if result.Passed {
			fmt.Printf("\n✓ Lint passed (%d warnings)\n", result.WarnCount)
			return nil
		}

		fmt.Printf("\n✖ Lint failed: %d errors, %d warnings\n", result.ErrorCount, result.WarnCount)
		os.Exit(3)
		return nil
	},
}

func init() {
	lintCmd.Flags().StringP("branch", "b", "", "Branch to lint against")
	lintCmd.Flags().String("ruleset", "recommended", "Ruleset: recommended | strict")
}
