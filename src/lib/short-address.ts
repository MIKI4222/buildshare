export function shortAddress(addr: string, prefix = 4, suffix = 4): string {
  if (addr.length <= prefix + suffix + 1) return addr;
  return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}`;
}
