package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var pullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Pull the latest spec from APIForge to the local spec file",
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

		// Resolve project ID
		projectID, err := resolveProjectID(auth, cfg)
		if err != nil {
			return err
		}

		c := client.New(auth.BaseURL, auth.AccessToken)
		var spec map[string]interface{}
		if err := c.Get(fmt.Sprintf("/projects/%s/branches/%s/spec", projectID, branch), &spec); err != nil {
			return fmt.Errorf("fetch spec: %w", err)
		}

		format, _ := cmd.Flags().GetString("format")
		var out []byte

		switch format {
		case "json":
			out, err = json.MarshalIndent(spec, "", "  ")
		default:
			out, err = yaml.Marshal(spec)
		}
		if err != nil {
			return fmt.Errorf("serialize: %w", err)
		}

		if err := os.WriteFile(cfg.SpecFile, out, 0644); err != nil {
			return fmt.Errorf("write %s: %w", cfg.SpecFile, err)
		}

		fmt.Printf("✓ Pulled spec from branch '%s' → %s\n", branch, cfg.SpecFile)
		return nil
	},
}

func init() {
	pullCmd.Flags().StringP("branch", "b", "", "Branch to pull from (default: project default_branch)")
	pullCmd.Flags().String("format", "yaml", "Output format: yaml | json")
}
