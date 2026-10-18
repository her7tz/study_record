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
      return new Response(JSON.stringify({ version: 4, exported_at: new Date().toISOString(), ...data }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="study-log-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }

    const headers = ["类型", "日期", "内容/兑换奖励", "项目", "项目重要度", "状态", "强度", "积分变动", "备注/简介", "创建时间", "更新时间", "完成日期"];
    const recordRows = data.records.map((record) => [
      record.record_type === "experiment" ? "实验记录" : "学习记录",
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
      "",
    ]);
    const experimentRows = data.experiments.map((experiment) => [
      "项目实验",
      experiment.created_at.slice(0, 10),
      experiment.name,
      experiment.project_name,
      "",
      experiment.status === "todo" ? "待做" : "已完成",
      experiment.intensity_score,
      "",
      experiment.description,
      experiment.created_at,
      experiment.updated_at,
      experiment.completed_at?.slice(0, 10) || "",
    ]);
    const redemptionRows = data.redemptions.map((redemption) => [
      "积分兑换",
      redemption.created_at.slice(0, 10),
      redemption.reward_name,
      "",
      "",
      "",
      "",
      -redemption.points,
      "",
      redemption.created_at,
      redemption.updated_at,
      "",
    ]);
    const csv = `\uFEFF${[headers, ...recordRows, ...experimentRows, ...redemptionRows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
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
