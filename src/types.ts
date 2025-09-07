export interface PostStats {
  type: string;
  serverId: number;
  userId: number;
  channel: number;
  link: string;
  timestamp: Date;
  user: number;
  isFirst: boolean;
  imageCount: number;
  videoCount: number;
  gifCount: number;
}

export interface PostStreak {
  serverId: number;
  userId: number;
  maxStreak: number;
  currentStreak: number;
  lastPost: Date;
}
