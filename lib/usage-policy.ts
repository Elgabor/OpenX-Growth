export function syncPageSize(remainingResources:number) {
  const available=Math.max(0,Math.trunc(remainingResources));
  const pageSize=Math.min(50,Math.floor(available/2));
  return pageSize>=5?pageSize:null;
}
