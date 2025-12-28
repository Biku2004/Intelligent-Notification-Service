export interface NotificationEvent {
  type: 'LIKE' | 'COMMENT' | 'FOLLOW'; // Add more types as needed
  actorId: string;
  targetId: string;
  metadata: Record<string, unknown>; // Safer than 'any', allows generic objects
  timestamp?: string;
}