package cmd

import (
	"fmt"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
)

var mrCmd = &cobra.Command{
	Use:   "mr",
	Short: "Manage merge requests",
}

var mrCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Open a new merge request",
	RunE: func(cmd *cobra.Command, args []string) error {
		auth, err := config.LoadAuth()
		if err != nil {
			return err
		}
		cfg, err := config.LoadProject()
		if err != nil {
			return err
		}

		source, _ := cmd.Flags().GetString("from")
		target, _ := cmd.Flags().GetString("into")
		title, _ := cmd.Flags().GetString("title")
		description, _ := cmd.Flags().GetString("description")

		if source == "" {
			return fmt.Errorf("--from is required")
		}
		if title == "" {
			return fmt.Errorf("--title is required")
		}
		if target == "" {
			target = cfg.DefaultBranch
		}

		projectID, err := resolveProjectID(auth, cfg)
		if err != nil {
			return err
		}

		c := client.New(auth.BaseURL, auth.AccessToken)
		var mr struct {
			ID          string `json:"id"`
			Title       string `json:"title"`
			Status      string `json:"status"`
			SourceBranch string `json:"sourceBranch"`
			TargetBranch string `json:"targetBranch"`
		}
		if err := c.Post(
			fmt.Sprintf("/projects/%s/merge-requests", projectID),
			map[string]string{
				"sourceBranch": source,
				"targetBranch": target,
				"title":        title,
				"description":  description,
			},
			&mr,
		); err != nil {
			return fmt.Errorf("create MR: %w", err)
		}

		fmt.Printf("✓ Merge request created\n")
		fmt.Printf("  ID:     %s\n", mr.ID)
		fmt.Printf("  Title:  %s\n", mr.Title)
		fmt.Printf("  %s → %s\n", mr.SourceBranch, mr.TargetBranch)
		return nil
	},
}

var mrListCmd = &cobra.Command{
	Use:   "list",
	Short: "List merge requests",
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

		status, _ := cmd.Flags().GetString("status")
		c := client.New(auth.BaseURL, auth.AccessToken)

		path := fmt.Sprintf("/projects/%s/merge-requests", projectID)
		if status != "" {
			path += "?status=" + status
		}

		var mrs []struct {
			ID           string `json:"id"`
			Title        string `json:"title"`
			Status       string `json:"status"`
			SourceBranch string `json:"sourceBranch"`
			TargetBranch string `json:"targetBranch"`
			Author       struct {
				Name string `json:"name"`
			} `json:"author"`
		}
		if err := c.Get(path, &mrs); err != nil {
			return fmt.Errorf("list MRs: %w", err)
		}

		if len(mrs) == 0 {
			fmt.Println("No merge requests found")
			return nil
		}
		for _, mr := range mrs {
			statusIcon := "●"
			if mr.Status == "MERGED" {
				statusIcon = "⊛"
			} else if mr.Status == "CLOSED" {
				statusIcon = "✕"
			}
			fmt.Printf("%s [%s] %s  (%s → %s)  by %s\n",
				statusIcon, mr.ID[:8], mr.Title, mr.SourceBranch, mr.TargetBranch, mr.Author.Name)
		}
		return nil
	},
}

func init() {
	mrCreateCmd.Flags().String("from", "", "Source branch (required)")
	mrCreateCmd.Flags().String("into", "", "Target branch (default: project default_branch)")
	mrCreateCmd.Flags().StringP("title", "t", "", "MR title (required)")
	mrCreateCmd.Flags().StringP("description", "d", "", "MR description")

	mrListCmd.Flags().String("status", "OPEN", "Filter by status: OPEN | MERGED | CLOSED")

	mrCmd.AddCommand(mrCreateCmd, mrListCmd)
}
