package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
)

var diffCmd = &cobra.Command{
	Use:   "diff <from-sha> <to-sha>",
	Short: "Show the spec diff between two commit snapshots",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		auth, err := config.LoadAuth()
		if err != nil {
			return err
		}
		cfg, err := config.LoadProject()
		if err != nil {
			return err
		}

		projectID, err := resolveProjectID(auth, cfg)
		if err != nil {
			return err
		}

		branch := cfg.DefaultBranch
		if b, _ := cmd.Flags().GetString("branch"); b != "" {
			branch = b
		}

		fromSha := args[0]
		toSha := args[1]

		c := client.New(auth.BaseURL, auth.AccessToken)
		var result struct {
			From    string        `json:"from"`
			To      string        `json:"to"`
			Changes []interface{} `json:"changes"`
		}
		if err := c.Get(
			fmt.Sprintf("/projects/%s/branches/%s/commits/diff?from=%s&to=%s", projectID, branch, fromSha, toSha),
			&result,
		); err != nil {
			return fmt.Errorf("diff: %w", err)
		}

		if len(result.Changes) == 0 {
			fmt.Println("No differences")
			return nil
		}

		fmt.Printf("Diff %s..%s (%d changes)\n\n", fromSha[:8], toSha[:8], len(result.Changes))
		for _, change := range result.Changes {
			b, _ := json.MarshalIndent(change, "", "  ")
			fmt.Println(string(b))
		}
		return nil
	},
}

func init() {
	diffCmd.Flags().StringP("branch", "b", "", "Branch context")
}
