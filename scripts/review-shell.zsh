# Review-mode shortcuts for Claude Code. Source from ~/.zshrc:
#   source /path/to/tools/scripts/review-shell.zsh
#
#   REVIEW_MODE=browser claude    browser-test guard + Playwright MCP
#   REVIEW_MODE=1 claude          review guard (also REVIEW_MODE=review)
#   claude                        unchanged
#
# An env var alone can't load an MCP config, so this wrapper adds the flags.
# With REVIEW_MODE set it runs from the tools root (in a subshell, so your cwd
# is untouched), because the guard hook only loads with tools/ as the project dir.
# See .claude/hooks/README.md ("Running a review").

# Resolved at source time: inside a function, $0 is the function name.
typeset -g _GRADE_M8_TOOLS_ROOT=${0:A:h:h}

claude() {
  local root=$_GRADE_M8_TOOLS_ROOT
  case $REVIEW_MODE in
    browser)
      ( cd "$root" && command claude \
          --settings "$root/.claude/browser-test.settings.json" \
          --mcp-config "$root/.claude/browser-test.mcp.json" "$@" )
      ;;
    1|review)
      ( cd "$root" && command claude \
          --settings "$root/.claude/review-mode.settings.json" "$@" )
      ;;
    *)
      command claude "$@"
      ;;
  esac
}

agy() {
  local root=$_GRADE_M8_TOOLS_ROOT
  case $REVIEW_MODE in
    browser)
      ( cd "$root" && REVIEW_MODE=browser command agy "$@" )
      ;;
    1|review)
      ( cd "$root" && REVIEW_MODE=1 command agy "$@" )
      ;;
    *)
      command agy "$@"
      ;;
  esac
}
