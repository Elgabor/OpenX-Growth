export const D1_MAX_BOUND_PARAMETERS = 100;

export function chunkForD1Insert<T>(rows:readonly T[],boundParametersPerRow:number):T[][] {
  if (!Number.isInteger(boundParametersPerRow) || boundParametersPerRow < 1 || boundParametersPerRow > D1_MAX_BOUND_PARAMETERS) {
    throw new Error("INVALID_D1_BOUND_PARAMETER_COUNT");
  }
  const rowsPerStatement = Math.floor(D1_MAX_BOUND_PARAMETERS / boundParametersPerRow);
  const batches:T[][] = [];
  for (let index=0;index<rows.length;index+=rowsPerStatement) batches.push(rows.slice(index,index+rowsPerStatement));
  return batches;
}
