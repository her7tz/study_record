import { clearEmailSessionCookieHeader } from "@/app/chatgpt-auth";

export async function GET(request: Request) {
  const destination = new URL("/signout-with-chatgpt?return_to=%2Flogin", request.url);
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      "Set-Cookie": clearEmailSessionCookieHeader(),
      "Cache-Control": "no-store",
    },
  });
}
