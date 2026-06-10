/** Extract @username handles from group chat message bodies. */
export function parseMentionUsernames(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]{2,32})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

export function highlightMentions(text: string, currentUsername?: string | null): string {
  if (!text.includes("@")) return text;
  return text.replace(/@([a-zA-Z0-9_]{2,32})/g, (full, user) => {
    if (currentUsername && user.toLowerCase() === currentUsername.toLowerCase()) {
      return `**${full}**`;
    }
    return full;
  });
}
