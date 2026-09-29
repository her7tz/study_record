import { getChatGPTUser } from "@/app/chatgpt-auth";
import { todayString } from "@/lib/date";
import { getExportData } from "@/lib/export-data";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format") || "csv";
  if (format !== "csv" && format !== "json") return Response.json({ error: "请选择 CSV 或 JSON 格式。" }, { status: 400 });

  try {
    const data = await getExportData(user.userId);
    const date = todayString();
    if (format === "json") {
      return new Response(JSON.stringify({ version: 1, exported_at: new Date().toISOString(), ...data }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="study-log-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }

    const headers = ["日期", "学习内容", "项目", "项目重要度", "项目状态", "强度", "积分", "备注", "创建时间", "更新时间"];
    const rows = data.records.map((record) => [
      record.study_date,
      record.subject,
      record.project_name,
      record.project_importance,
      record.project_status,
      record.intensity_score,
      record.points,
      record.note,
      record.created_at,
      record.updated_at,
    ]);
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="study-log-${date}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("export:get", error);
    return Response.json({ error: "数据导出失败，请稍后再试。" }, { status: 503 });
  }
}
