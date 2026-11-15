#!/usr/bin/env node

/**
 * VaaniReel Workflow JSON Validator
 * Validates n8n workflow schema, node integrity, connection references, and credential security.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = process.argv[2] || resolve("workflows/vaanireel-full.json");

async function validate() {
  console.log(`Validating workflow at: ${workflowPath}`);
  
  let content;
  try {
    content = await readFile(workflowPath, "utf8");
  } catch (err) {
    console.error(`FAILED to read file: ${err.message}`);
    process.exit(1);
  }

  // 1. JSON Parse
  let workflow;
  try {
    workflow = JSON.parse(content);
  } catch (err) {
    console.error(`FAILED JSON syntax check: ${err.message}`);
    process.exit(1);
  }

  console.log(`✓ JSON syntax is valid.`);

  // 2. Secret Leak Check
  const secretPatterns = [
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z-_]{35}/,
    /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/, // Telegram bot token
    /qpulq3[a-z0-9]{26}/,           // Known test wiro key pattern
    /f82838d[a-f0-9]{57}/            // Known test wiro secret pattern
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      console.error(`SECURITY ERROR: Potential live API secret matched pattern: ${pattern}`);
      process.exit(1);
    }
  }
  console.log(`✓ No hardcoded live credentials or tokens found.`);

  // 3. Node Inventory
  const nodes = workflow.nodes || [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    console.error(`FAILED: 'nodes' must be a non-empty array.`);
    process.exit(1);
  }

  const nodeNames = new Set();
  const nodeIds = new Set();

  for (const [index, node] of nodes.entries()) {
    if (!node.name || typeof node.name !== "string") {
      console.error(`Node at index ${index} missing valid 'name'.`);
      process.exit(1);
    }
    if (nodeNames.has(node.name)) {
      console.error(`Duplicate node name: "${node.name}". Node names must be unique in n8n.`);
      process.exit(1);
    }
    nodeNames.add(node.name);

    if (!node.type || typeof node.type !== "string") {
      console.error(`Node "${node.name}" missing 'type'.`);
      process.exit(1);
    }
    if (node.typeVersion === undefined) {
      console.error(`Node "${node.name}" missing 'typeVersion'.`);
      process.exit(1);
    }
  }

  console.log(`✓ ${nodes.length} nodes successfully indexed with unique names.`);

  // 4. Connection Reference Check
  const connections = workflow.connections || {};
  let totalConnections = 0;

  for (const [sourceNode, outputs] of Object.entries(connections)) {
    if (!nodeNames.has(sourceNode)) {
      console.error(`Connection source node "${sourceNode}" does not exist in nodes list.`);
      process.exit(1);
    }

    if (outputs.main && Array.isArray(outputs.main)) {
      for (const [outputIndex, targets] of outputs.main.entries()) {
        if (Array.isArray(targets)) {
          for (const target of targets) {
            if (!nodeNames.has(target.node)) {
              console.error(`Connection target node "${target.node}" (from "${sourceNode}" output ${outputIndex}) does not exist in nodes list.`);
              process.exit(1);
            }
            totalConnections++;
          }
        }
      }
    }
  }

  console.log(`✓ ${totalConnections} connection endpoints verified. All source and target node names exist.`);

  // 5. Required Stages Verification
  const requiredStages = [
    { label: "Telegram Trigger", match: (n) => n.type.includes("telegramTrigger") },
    { label: "Switch Router", match: (n) => n.type.includes("switch") },
    { label: "Data Table Node", match: (n) => n.type.includes("dataTable") },
    { label: "Telegram Action", match: (n) => n.type.includes("telegram") },
    { label: "Gemini Node", match: (n) => n.type.includes("googleGemini") },
    { label: "Wiro Image Node", match: (n) => n.name.toLowerCase().includes("wiro") && n.type.includes("httpRequest") },
    { label: "Approval Node", match: (n) => n.name.toLowerCase().includes("approval") || n.parameters?.operation === "sendAndWait" },
    { label: "Instagram HTTP Node", match: (n) => n.name.toLowerCase().includes("instagram") && n.type.includes("httpRequest") },
    { label: "Google Sheets Node", match: (n) => n.type.includes("googleSheets") }
  ];

  for (const stage of requiredStages) {
    const found = nodes.some(stage.match);
    if (!found) {
      console.error(`FAILED: Required stage "${stage.label}" was not found in workflow nodes.`);
      process.exit(1);
    }
    console.log(`✓ Required stage "${stage.label}" present.`);
  }

  console.log("\nALL CHECKS PASSED: Workflow JSON is valid and ready for n8n import.");
}

validate().catch((err) => {
  console.error("Validation error:", err);
  process.exit(1);
});
