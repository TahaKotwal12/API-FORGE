package cmd

import (
	"fmt"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
)

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Print the currently authenticated user",
	RunE: func(cmd *cobra.Command, args []string) error {
		auth, err := config.LoadAuth()
		if err != nil {
			return err
		}

		c := client.New(auth.BaseURL, auth.AccessToken)
		var me struct {
			ID    string `json:"id"`
			Email string `json:"email"`
			Name  string `json:"name"`
		}
		if err := c.Get("/auth/me", &me); err != nil {
			return fmt.Errorf("fetch profile: %w", err)
		}

		fmt.Printf("User:  %s (%s)\n", me.Name, me.Email)
		fmt.Printf("Host:  %s\n", auth.BaseURL)
		return nil
	},
}
