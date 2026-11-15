/**
 * VaaniReel — Update live n8n workflow to add SQLite (Turso) persistence
 */

import { readFileSync, writeFileSync } from "node:fs";

const token = process.env.N8N_MCP_TOKEN || "YOUR_N8N_MCP_TOKEN";
const workflowId = "i6fhjzixwvS6YQsI";

const TURSO_TOKEN = process.env.TURSO_DB_TOKEN || "YOUR_TURSO_DB_TOKEN";
const TURSO_URL = process.env.TURSO_DB_URL || "https://voxdesk-yash-bharvada.aws-ap-northeast-1.turso.io/v2/pipeline";

const newSqliteNode = {
  name: "Save Campaign to SQLite",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [7296, 320],
  parameters: {
    method: "POST",
    url: TURSO_URL,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: "Authorization",
          value: `Bearer ${TURSO_TOKEN}`
        },
        {
          name: "Content-Type",
          value: "application/json"
        }
      ]
    },
    sendBody: true,
    specifyBody: "json",
    jsonBody: `={\n  "requests": [\n    {\n      "type": "execute",\n      "stmt": {\n        "sql": "INSERT INTO vaanireel_posts (chat_id, language, offer, caption, hashtags, image_url, audio_url, video_url, total_cost_usd, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')",\n        "args": [\n          { "type": "text", "value": String($json.chat_id) },\n          { "type": "text", "value": String($json.language || 'en') },\n          { "type": "text", "value": String($json.offer || '') },\n          { "type": "text", "value": String($json.caption || '') },\n          { "type": "text", "value": JSON.stringify($json.hashtags || []) },\n          { "type": "text", "value": String($json.image_url || '') },\n          { "type": "text", "value": String($json.audio_url || '') },\n          { "type": "text", "value": String($json.video_url || '') },\n          { "type": "float", "value": Number($json.total_cost_usd || 0) }\n        ]\n      }\n    },\n    { "type": "close" }\n  ]\n}`
  },
  notes: "Persists final campaign metadata, media URLs, and billed costs to SQLite (Turso cloud instance)."
};

async function main() {
  console.log("🚀 Calling n8n MCP update_workflow...");

  const mcpPayload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: "update_workflow",
      arguments: {
        workflowId,
        versionName: "Add SQLite Turso persistence for campaign and media",
        versionDescription: "Adds 'Save Campaign to SQLite' node to persist all campaign metadata, image URL, video URL, audio URL and costs to SQLite table vaanireel_posts.",
        operations: [
          {
            type: "addNode",
            node: newSqliteNode
          },
          {
            type: "addConnection",
            source: "Totals",
            target: "Save Campaign to SQLite",
            sourceIndex: 0,
            targetIndex: 0,
            connectionType: "main"
          }
        ]
      }
    }
  };

  const resp = await fetch("https://yashbharvada1234.app.n8n.cloud/mcp-server/http", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify(mcpPayload)
  });

  const raw = await resp.text();
  const dataLine = raw.split("\n").find(l => l.startsWith("data: "));
  if (!dataLine) {
    console.error("❌ Unexpected response:", raw);
    return;
  }
  const result = JSON.parse(dataLine.slice(6));
  console.log("Result:", JSON.stringify(result, null, 2));

  // Now re-fetch the complete workflow to update local files
  console.log("\n📥 Pulling updated workflow JSON from n8n cloud...");
  const fetchPayload = {
    jsonrpc: "2.0",
    id: Date.now() + 1,
    method: "tools/call",
    params: {
      name: "get_workflow_details",
      arguments: { workflowId, detailLevel: "full" }
    }
  };

  const fetchResp = await fetch("https://yashbharvada1234.app.n8n.cloud/mcp-server/http", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify(fetchPayload)
  });

  const fetchRaw = await fetchResp.text();
  const fetchDataLine = fetchRaw.split("\n").find(l => l.startsWith("data: "));
  const fetchResult = JSON.parse(fetchDataLine.slice(6));
  const innerJson = JSON.parse(fetchResult.result.content[0].text);

  const cleanWf = {
    name: innerJson.workflow.name,
    nodes: innerJson.workflow.nodes,
    connections: innerJson.workflow.connections,
    settings: innerJson.workflow.settings,
    pinData: {}
  };

  const formatted = JSON.stringify(cleanWf, null, 2);
  writeFileSync("D:/VanniReel/VaaniReel/workflows/vaanireel-full.json", formatted, "utf8");
  writeFileSync("D:/VanniReel/workflows/vaanireel-full.json", formatted, "utf8");

  console.log(`✅ Success! Updated local workflow with ${cleanWf.nodes.length} nodes!`);
}

main().catch(console.error);
