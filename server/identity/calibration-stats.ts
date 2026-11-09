/**
 * Metrics for the local face calibration.
 *
 * Face comparisons are not independent Bernoulli trials when several probes
 * come from the same person or the same claimed/impostor pair. The raw
 * proportion is reported for transparency, but the validation bounds use one
 * cluster per genuine subject and one cluster per unordered impostor pair.
 * A cluster is a failure if any comparison in it fails, which is conservative.
 */
export type CalibrationComparison = {
  genuine: boolean;
  group: string;
  score: number;
  claimedId: string;
  subjectId: string;
  enrollmentSession: string;
  probeSession: string;
};

export type CalibrationMetrics = {
  comparisons: number;
  genuine: number;
  impostors: number;
  falseAccepts: number;
  falseRejects: number;
  FAR: number | null;
  FRR: number | null;
  FAR_upper_95_one_sided: number | null;
  FRR_upper_95_one_sided: number | null;
  independentGenuineClusters: number;
  independentImpostorClusters: number;
  clusterFalseAccepts: number;
  clusterFalseRejects: number;
  FAR_upper_95_cluster_one_sided: number | null;
  FRR_upper_95_cluster_one_sided: number | null;
};

/** One-sided 95% Wilson score upper bound. */
export function wilsonUpper(successes: number, n: number, zScore = 1.6448536269514722): number | null {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || n <= 0 || successes < 0 || successes > n) return null;
  const p = successes / n;
  const denominator = 1 + (zScore * zScore) / n;
  const centre = p + (zScore * zScore) / (2 * n);
  const margin = zScore * Math.sqrt((p * (1 - p)) / n + (zScore * zScore) / (4 * n * n));
  return Math.min(1, (centre + margin) / denominator);
}

function clusterKey(item: CalibrationComparison): string {
  // A genuine comparison is clustered by the person; an impostor comparison
  // by the unordered pair. This prevents repeated photos of one pair from
  // being reported as independent evidence.
  return item.genuine
    ? `genuine:${item.subjectId}`
    : `impostor:${[item.claimedId, item.subjectId].sort().join("|")}`;
}

function clusters(set: CalibrationComparison[]): Map<string, CalibrationComparison[]> {
  const result = new Map<string, CalibrationComparison[]>();
  for (const item of set) {
    const key = clusterKey(item);
    const current = result.get(key);
    if (current) current.push(item);
    else result.set(key, [item]);
  }
  return result;
}

export function measure(set: CalibrationComparison[], threshold: number): CalibrationMetrics {
  const genuine = set.filter((item) => item.genuine);
  const impostors = set.filter((item) => !item.genuine);
  const falseAccepts = impostors.filter((item) => item.score <= threshold).length;
  const falseRejects = genuine.filter((item) => item.score > threshold).length;

  const genuineClusters = clusters(genuine);
  const impostorClusters = clusters(impostors);
  const clusterFalseAccepts = [...impostorClusters.values()].filter((items) =>
    items.some((item) => item.score <= threshold),
  ).length;
  const clusterFalseRejects = [...genuineClusters.values()].filter((items) =>
    items.some((item) => item.score > threshold),
  ).length;

  return {
    comparisons: set.length,
    genuine: genuine.length,
    impostors: impostors.length,
    falseAccepts,
    falseRejects,
    FAR: impostors.length ? falseAccepts / impostors.length : null,
    FRR: genuine.length ? falseRejects / genuine.length : null,
    FAR_upper_95_one_sided: wilsonUpper(falseAccepts, impostors.length),
    FRR_upper_95_one_sided: wilsonUpper(falseRejects, genuine.length),
    independentGenuineClusters: genuineClusters.size,
    independentImpostorClusters: impostorClusters.size,
    clusterFalseAccepts,
    clusterFalseRejects,
    FAR_upper_95_cluster_one_sided: wilsonUpper(clusterFalseAccepts, impostorClusters.size),
    FRR_upper_95_cluster_one_sided: wilsonUpper(clusterFalseRejects, genuineClusters.size),
  };
}
