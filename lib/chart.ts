export function buildChartCoordinates(values:number[],width=640,bottom=160,top=20) {
  if(values.length<2)return "";
  const minimum=Math.min(...values),maximum=Math.max(...values),span=Math.max(1,maximum-minimum);
  return values.map((value,index)=>`${(index/(values.length-1))*width},${bottom-((value-minimum)/span)*(bottom-top)}`).join(" ");
}
