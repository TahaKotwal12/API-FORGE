package cmd

import (
	"fmt"
	"os"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
)

var pushCmd = &cobra.Command{
	Use:   "push",
	Short: "Push the local spec file as a new commit on APIForge",
	RunE: func(cmd *cobra.Command, args []string) error {
		auth, err := config.LoadAuth()
		if err != nil {
			return err
		}
		cfg, err := config.LoadProject()
		if err != nil {
			return err
		}

		branch := cfg.DefaultBranch
		if b, _ := cmd.Flags().GetString("branch"); b != "" {
			branch = b
		}

		msg, _ := cmd.Flags().GetString("message")
		if msg == "" {
			msg = "chore: push from forge CLI"
		}

		content, err := os.ReadFile(cfg.SpecFile)
		if err != nil {
			return fmt.Errorf("read %s: %w", cfg.SpecFile, err)
		}

		projectID, err := resolveProjectID(auth, cfg)
		if err != nil {
			return err
		}

		c := client.New(auth.BaseURL, auth.AccessToken)

		// Import the spec
		var importResult struct {
			Imported int `json:"imported"`
			Schemas  int `json:"schemas"`
		}
		if err := c.Post(
			fmt.Sprintf("/projects/%s/branches/%s/spec/import", projectID, branch),
			map[string]string{"content": string(content)},
			&importResult,
		); err != nil {
			return fmt.Errorf("import spec: %w", err)
		}

		// Create a commit
		var commit struct {
			ID      string `json:"id"`
			Message string `json:"message"`
		}
		if err := c.Post(
			fmt.Sprintf("/projects/%s/branches/%s/commits", projectID, branch),
			map[string]string{"message": msg},
			&commit,
		); err != nil {
			return fmt.Errorf("create commit: %w", err)
		}

		fmt.Printf("✓ Pushed %s → branch '%s'\n", cfg.SpecFile, branch)
		fmt.Printf("  commit: %s\n", commit.ID)
		fmt.Printf("  endpoints: %d, schemas: %d\n", importResult.Imported, importResult.Schemas)
		return nil
	},
}

func init() {
	pushCmd.Flags().StringP("branch", "b", "", "Target branch (default: project default_branch)")
	pushCmd.Flags().StringP("message", "m", "", "Commit message")
}
