package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"

	"github.com/apiforge/forge/internal/client"
	"github.com/apiforge/forge/internal/config"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with an APIForge backend",
	RunE: func(cmd *cobra.Command, args []string) error {
		baseURL, _ := cmd.Flags().GetString("host")
		if baseURL == "" {
			baseURL = "http://localhost:4000"
		}

		reader := bufio.NewReader(os.Stdin)

		fmt.Print("Email: ")
		email, _ := reader.ReadString('\n')
		email = strings.TrimSpace(email)

		fmt.Print("Password: ")
		var password string
		if term.IsTerminal(int(syscall.Stdin)) {
			pw, err := term.ReadPassword(int(syscall.Stdin))
			fmt.Println()
			if err != nil {
				return fmt.Errorf("read password: %w", err)
			}
			password = string(pw)
		} else {
			pw, _ := reader.ReadString('\n')
			password = strings.TrimSpace(pw)
		}

		c := client.New(baseURL, "")
		var resp struct {
			AccessToken  string `json:"accessToken"`
			RefreshToken string `json:"refreshToken"`
		}
		if err := c.Post("/auth/login", map[string]string{"email": email, "password": password}, &resp); err != nil {
			return fmt.Errorf("login failed: %w", err)
		}

		auth := &config.Auth{
			AccessToken:  resp.AccessToken,
			RefreshToken: resp.RefreshToken,
			Email:        email,
			BaseURL:      baseURL,
		}
		if err := config.SaveAuth(auth); err != nil {
			return fmt.Errorf("save credentials: %w", err)
		}

		fmt.Printf("✓ Logged in as %s\n", email)
		return nil
	},
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Log out and remove stored credentials",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := config.ClearAuth(); err != nil {
			return err
		}
		fmt.Println("✓ Logged out")
		return nil
	},
}

func init() {
	loginCmd.Flags().String("host", "", "Backend base URL (default: http://localhost:4000)")
}
