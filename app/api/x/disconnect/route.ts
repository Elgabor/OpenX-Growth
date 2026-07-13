import { NextRequest, NextResponse } from "next/server";
import { authorizeBrowserMutation, clearXSession } from "../../../../lib/security";
import { deleteXCache } from "../../../../lib/data";
import { deleteXSession } from "../../../../lib/session-store";
export async function POST(request:NextRequest) {
  const denied=await authorizeBrowserMutation(request);if(denied)return denied;
  await Promise.all([deleteXSession(),deleteXCache()]); const response = NextResponse.json({connected:false}); clearXSession(response,request.nextUrl.protocol==="https:"); return response;
}
