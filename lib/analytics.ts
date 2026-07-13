export type SnapshotMetrics = {
  postId: string;
  recordedAt: number;
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
};

export function summarizeLatestSnapshots<T extends SnapshotMetrics>(snapshots: T[]) {
  const latest = new Map<string,T>();

  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.postId);
    if (!current || snapshot.recordedAt > current.recordedAt) latest.set(snapshot.postId,snapshot);
  }

  const totals = [...latest.values()].reduce((sum,snapshot)=>({
    impressions:sum.impressions+snapshot.impressions,
    likes:sum.likes+snapshot.likes,
    replies:sum.replies+snapshot.replies,
    reposts:sum.reposts+snapshot.reposts,
  }),{impressions:0,likes:0,replies:0,reposts:0});

  return {latest,totals};
}
