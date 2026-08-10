import { handleRemoteMcpRequest } from "@/lib/mcp-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return handleRemoteMcpRequest(request);
}

export async function POST(request: Request) {
  return handleRemoteMcpRequest(request);
}

export async function PUT(request: Request) {
  return handleRemoteMcpRequest(request);
}

export async function PATCH(request: Request) {
  return handleRemoteMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleRemoteMcpRequest(request);
}

export async function HEAD(request: Request) {
  return handleRemoteMcpRequest(request);
}

export async function OPTIONS(request: Request) {
  return handleRemoteMcpRequest(request);
}
