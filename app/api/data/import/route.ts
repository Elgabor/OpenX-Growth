import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { analyticsSnapshots, feedback, posts } from "../../../../db/schema";
import { importPayloadSchema, validationIssues } from "../../../../lib/post-validation";
import { authorizeBrowserOrApiMutation } from "../../../../lib/security";

export async function POST(request:NextRequest) {
  const denied=await authorizeBrowserOrApiMutation(request);if(denied)return denied;
  let raw:unknown; try { raw=await request.json(); } catch { return NextResponse.json({error:"INVALID_JSON"},{status:400}); }
  const parsed=importPayloadSchema(Date.now()).safeParse(raw);
  if(!parsed.success)return NextResponse.json({error:"INVALID_IMPORT",issues:validationIssues(parsed.error)},{status:400});
  const db=getDb(); const input=parsed.data;
  for(const row of input.posts)await db.insert(posts).values({...row,id:row.id??crypto.randomUUID(),status:row.scheduledAt&&row.scheduledAt>Date.now()?"scheduled":"draft",publishedAt:null,xPostId:null,publishedIdsJson:null,publishReceiptsJson:null,claimToken:null,claimExpiresAt:null,deliveryState:"idle",attempts:0,lastError:null}).onConflictDoNothing();
  for(const row of input.feedback)await db.insert(feedback).values({...row,id:row.id??crypto.randomUUID()}).onConflictDoNothing();
  for(const row of input.analytics)await db.insert(analyticsSnapshots).values(row).onConflictDoNothing();
  return NextResponse.json({ok:true,imported:{posts:input.posts.length,feedback:input.feedback.length,analytics:input.analytics.length}});
}
