export function opportunityAccepting(deadline: string | null, now = new Date()) {
  return !deadline || new Date(deadline).getTime() > now.getTime();
}
