export type IndexHistoryValue = {
  value: string | number;
};

/**
 * Small floating-point differences can arise when a persisted decimal is read
 * through JavaScript. Treat changes below one hundredth of an index point as
 * unchanged source pricing rather than a meaningful market movement.
 */
export const MATERIAL_INDEX_MOVEMENT_POINTS = 0.01;

export function hasMaterialIndexMovement(
  points: readonly IndexHistoryValue[],
  threshold: number = MATERIAL_INDEX_MOVEMENT_POINTS,
): boolean {
  const values = points
    .map(point => Number(point.value))
    .filter(value => Number.isFinite(value));

  if (values.length < 2 || !Number.isFinite(threshold) || threshold < 0) {
    return false;
  }

  const range = Math.max(...values) - Math.min(...values);
  const comparisonTolerance = Number.EPSILON * Math.max(1, ...values.map(value => Math.abs(value)), Math.abs(threshold));
  return range + comparisonTolerance >= threshold;
}

export function isFlatIndexHistory(
  points: readonly IndexHistoryValue[],
  threshold: number = MATERIAL_INDEX_MOVEMENT_POINTS,
): boolean {
  const values = points
    .map(point => Number(point.value))
    .filter(value => Number.isFinite(value));

  return values.length >= 2 && !hasMaterialIndexMovement(values.map(value => ({ value })), threshold);
}
