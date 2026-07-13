import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { posts } from "../../../../db/schema";
import { patchPostInputSchema, validationIssues } from "../../../../lib/post-validation";
import { authorizeBrowserOrApiMutation } from "../../../../lib/security";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const denied=await authorizeBrowserOrApiMutation(request);if(denied)return denied;
  const {id}=await params; const current=await getDb().select().from(posts).where(eq(posts.id,id)).get(); if(!current)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  if(current.status==="publishing"||current.status==="published"||current.status==="needs_review")return NextResponse.json({error:"IMMUTABLE_POST"},{status:409});
  let raw:unknown;try{raw=await request.json();}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
  const now=Date.now();const parsed=patchPostInputSchema(current,now).safeParse(raw);
  if(!parsed.success)return NextResponse.json({error:"INVALID_POST",issues:validationIssues(parsed.error)},{status:400});
  const input=parsed.data;
  const values={text:input.text,threadJson:input.threadJson,scheduledAt:input.scheduledAt,status:input.status,evergreen:input.evergreen,evergreenIntervalDays:input.evergreenIntervalDays,topic:input.topic,format:input.format,hook:input.hook,generated:input.generated,updatedAt:now};
  const updated=await getDb().update(posts).set(values).where(and(eq(posts.id,id),inArray(posts.status,["draft","scheduled","failed"]))).returning().get();
  if(!updated)return NextResponse.json({error:"IMMUTABLE_POST"},{status:409});
  return NextResponse.json({ok:true});
}

export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const denied=await authorizeBrowserOrApiMutation(request);if(denied)return denied;
  const {id}=await params;
  const deleted=await getDb().delete(posts).where(and(eq(posts.id,id),inArray(posts.status,["draft","scheduled","failed","published"]))).returning().get();
  if(deleted)return NextResponse.json({ok:true});
  const current=await getDb().select({id:posts.id}).from(posts).where(eq(posts.id,id)).get();
  return current?NextResponse.json({error:"IMMUTABLE_POST"},{status:409}):NextResponse.json({error:"NOT_FOUND"},{status:404});
}
