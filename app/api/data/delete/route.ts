import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { analyticsSnapshots, apiUsage, feedback, followerSnapshots, posts, publishEvents, secureStore, syncCache, xUsageEvents } from "../../../../db/schema";
import { authorizeBrowserMutation, clearXSession } from "../../../../lib/security";

export async function DELETE(request:NextRequest) {
  const denied=await authorizeBrowserMutation(request);if(denied)return denied;
  const db=getDb();
  await db.delete(analyticsSnapshots);
  await db.delete(followerSnapshots);
  await db.delete(feedback);
  await db.delete(publishEvents);
  await db.delete(posts);
  await db.delete(syncCache);
  await db.delete(apiUsage);
  await db.delete(xUsageEvents);
  await db.delete(secureStore);
  const response=NextResponse.json({deleted:true},{headers:{"Cache-Control":"no-store"}});
  clearXSession(response,request.nextUrl.protocol==="https:");
  return response;
}
