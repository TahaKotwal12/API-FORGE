// Package cmd contains all forge CLI commands.
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "forge",
	Short: "APIForge CLI — manage your API specs from the terminal",
	Long: `forge is the official CLI for APIForge.

It lets you push/pull spec changes, lint locally, open merge requests,
and generate SDKs — all without leaving your terminal.

Run 'forge login' to authenticate, then 'forge init' in your project directory.`,
}

// Execute is the entry point called from main.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(
		loginCmd,
		logoutCmd,
		whoamiCmd,
		initCmd,
		pullCmd,
		pushCmd,
		lintCmd,
		diffCmd,
		mrCmd,
	)
}
