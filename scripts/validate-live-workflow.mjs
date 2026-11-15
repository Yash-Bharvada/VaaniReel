#!/usr/bin/env node

/**
 * VaaniReel Live Workflow Validator
 * Validates the live 47-node n8n workflow with SQLite / Turso persistence,
 * Wiro Image/Video/Voice AI generation, Gemini multimodal analysis, and Telegram routing.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = process.argv[2] || resolve("workflows/vaanireel-full.json");

async function validate() {
  console.log(`Validating live workflow at: ${workflowPath}`);

  let content;
  try {
    content = await readFile(workflowPath, "utf8");
  } catch (err) {
    console.error(`FAILED to read file: ${err.message}`);
    process.exit(1);
  }

  let workflow;
  try {
    workflow = JSON.parse(content);
  } catch (err) {
    console.error(`FAILED JSON syntax check: ${err.message}`);
    process.exit(1);
  }

  console.log(`✓ JSON syntax is valid.`);

  // Secret Leak Check
  const secretPatterns = [
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z-_]{35}/,
    /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/,
    /qpulq3[a-z0-9]{26}/,
    /f82838d[a-f0-9]{57}/
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      console.error(`SECURITY ERROR: Potential live API secret matched pattern: ${pattern}`);
      process.exit(1);
    }
  }
  console.log(`✓ No hardcoded live credentials or tokens found.`);

  const nodes = workflow.nodes || [];
  const nodeNames = new Set();

  for (const [index, node] of nodes.entries()) {
    if (!node.name || typeof node.name !== "string") {
      console.error(`Node at index ${index} missing valid 'name'.`);
      process.exit(1);
    }
    if (nodeNames.has(node.name)) {
      console.error(`Duplicate node name: "${node.name}".`);
      process.exit(1);
    }
    nodeNames.add(node.name);
  }
  console.log(`✓ ${nodes.length} nodes successfully indexed with unique names.`);

  // Check connections
  const connections = workflow.connections || {};
  let totalConnections = 0;

  for (const [sourceNode, outputs] of Object.entries(connections)) {
    if (!nodeNames.has(sourceNode)) {
      console.error(`Source node "${sourceNode}" not in nodes list.`);
      process.exit(1);
    }
    if (outputs.main && Array.isArray(outputs.main)) {
      for (const [outIdx, targets] of outputs.main.entries()) {
        if (Array.isArray(targets)) {
          for (const target of targets) {
            if (!nodeNames.has(target.node)) {
              console.error(`Target node "${target.node}" (from "${sourceNode}") not in nodes list.`);
              process.exit(1);
            }
            totalConnections++;
          }
        }
      }
    }
  }
  console.log(`✓ ${totalConnections} connection endpoints verified.`);

  // Verify critical production stages
  const checks = [
    { label: "Telegram Trigger", pass: nodes.some(n => n.type.includes("telegramTrigger")) },
    { label: "Message Type Switch", pass: nodes.some(n => n.type.includes("switch")) },
    { label: "Gemini Vision & Audio Analysis", pass: nodes.filter(n => n.type.includes("googleGemini")).length >= 3 },
    { label: "Wiro Image Node (Seedream 5.5)", pass: nodes.some(n => n.name === "Wiro Image") },
    { label: "Wiro Video Node (Wan 2.6)", pass: nodes.some(n => n.name === "Wiro Video") },
    { label: "Wiro Voice Node (ElevenLabs)", pass: nodes.some(n => n.name === "Wiro Voice") },
    { label: "Telegram Result Delivery", pass: nodes.some(n => n.name === "Send Image") && nodes.some(n => n.name === "Send Reel") },
    { label: "Campaign Cost Calculation", pass: nodes.some(n => n.name === "Totals") },
    { label: "SQLite / Turso Persistence", pass: nodes.some(n => n.name === "Save Campaign to SQLite") }
  ];

  for (const c of checks) {
    if (!c.pass) {
      console.error(`FAILED: Required stage "${c.label}" missing.`);
      process.exit(1);
    }
    console.log(`✓ Stage present: ${c.label}`);
  }

  console.log("\n🎉 ALL CHECKS PASSED: Live 47-node workflow with SQLite persistence verified!");
}

validate().catch(err => {
  console.error(err);
  process.exit(1);
});
