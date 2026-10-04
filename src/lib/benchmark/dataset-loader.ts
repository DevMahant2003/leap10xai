import * as fs from "fs";
import * as path from "path";
import { isNotAssessable } from "./metrics";
import type {
  NormalizedDataset,
  NormalizedTranscript,
  NormalizedHumanLabel,
} from "./types";

const DATASET_DIR = path.join(process.cwd(), "dataset");

// ============================================
// MAIN ENTRY
// ============================================
export function loadDataset(): NormalizedDataset {
  if (!fs.existsSync(DATASET_DIR)) {
    throw new Error(
      `Dataset not found at ${DATASET_DIR}. Copy the supplied dataset there.`
    );
  }

  console.log("📂 Loading dataset from", DATASET_DIR);

  // Step 1: Parse agent markdown files
  const agents = loadAgents();
  console.log(`   ${agents.size} agents parsed`);

  // Step 2: Load transcripts (JSON files)
  const transcripts = loadTranscripts(agents);
  console.log(`   ${transcripts.length} transcripts loaded`);

  // Step 3: Load human labels (CSV)
  const humanLabels = loadHumanLabels();
  console.log(`   ${humanLabels.length} human-labelled calls`);

  return { transcripts, humanLabels };
}

// ============================================
// AGENT PARSER (Markdown → structured config)
// ============================================
type ParsedAgent = {
  id: string;
  name: string;
  persona: string;
  goal: string;
  knowledge: { topic: string; detail: string }[];
  guidelines: { rule: string }[];
  hardRules: { rule: string }[];
  passThreshold: number;
  scoringNotes: string;  // NEW
  rubric: {
    criterion: string;
    description: string;
    weight: number;
    max_score: number;
  }[];
};

function loadAgents(): Map<string, ParsedAgent> {
  const agentsDir = path.join(DATASET_DIR, "agents");
  const agents = new Map<string, ParsedAgent>();

  if (!fs.existsSync(agentsDir)) {
    throw new Error("agents/ directory not found in dataset/");
  }

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf-8");
    const agentId = path.basename(file, ".md");
    const parsed = parseAgentMarkdown(content, agentId);
    agents.set(agentId, parsed);
    console.log(`   Agent: ${parsed.name} (${parsed.rubric.length} criteria)`);
  }

  return agents;
}

// Parse a line for criterion-specific hard rule patterns
// Returns null if the line is a general (text) rule
function parseCriterionRule(line: string): {
  rule: string;
  type: "criterion";
  criterion: string;
  operator: "<=" | ">=" | "==";
  threshold: number;
} | null {
  const lower = line.toLowerCase();

  // Must contain "fail" keyword
  if (!/fail/i.test(line)) return null;

  // Pattern: "if [criterion] is [N]" → operator: "=="
  const isMatch = line.match(
    /if\s+(.+?)\s+is\s+(\d+)/i
  );
  if (isMatch) {
    const criterion = isMatch[1].trim();
    const threshold = parseInt(isMatch[2]);
    return {
      rule: `If ${criterion} is ${threshold}, auto-fail`,
      type: "criterion",
      criterion,
      operator: "==",
      threshold,
    };
  }

  // Pattern: "if [criterion] ≤ [N]" or "if [criterion] <= [N]"
  const leMatch = line.match(
    /if\s+(.+?)\s+[≤<]=\s*(\d+)/i
  );
  if (leMatch) {
    const criterion = leMatch[1].trim();
    const threshold = parseInt(leMatch[2]);
    return {
      rule: `If ${criterion} ≤ ${threshold}, auto-fail`,
      type: "criterion",
      criterion,
      operator: "<=",
      threshold,
    };
  }

  // Pattern: "[criterion] ≤ [N]" (without "if" prefix)
  // But only if it contains "fail" somewhere in the line
  const leMatch2 = line.match(
    /([A-Za-z ]+?)\s+[≤<]=\s*(\d+)/
  );
  if (leMatch2 && /fail/i.test(line)) {
    const criterion = leMatch2[1].trim();
    // Skip if criterion looks like a sentence fragment
    if (criterion.length > 60) return null;
    const threshold = parseInt(leMatch2[2]);
    return {
      rule: `If ${criterion} ≤ ${threshold}, auto-fail`,
      type: "criterion",
      criterion,
      operator: "<=",
      threshold,
    };
  }

  // Pattern: "if [criterion] ≥ [N]" or "if [criterion] >= [N]"
  const geMatch = line.match(
    /if\s+(.+?)\s+[≥>]=\s*(\d+)/i
  );
  if (geMatch) {
    const criterion = geMatch[1].trim();
    const threshold = parseInt(geMatch[2]);
    return {
      rule: `If ${criterion} ≥ ${threshold}, auto-fail`,
      type: "criterion",
      criterion,
      operator: ">=",
      threshold,
    };
  }

  return null;
}

function parseAgentMarkdown(
  content: string,
  agentId: string
): ParsedAgent {
  // Extract agent name from "# Agent: ..."
  const nameMatch = content.match(/^#\s+Agent:\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : agentId;

  // Extract sections by ## headers
  const sections = extractMarkdownSections(content);

  // Persona
  const persona =
    (sections.get("Persona") || sections.get("Persona the agent plays") || "").trim() ||
    "AI support agent";

  // Goal
  const goal = (sections.get("Goal") || "").trim() || "Help the customer";

  // Knowledge from "Product facts" or "Conversation guidelines"
  const factsText =
    sections.get("Product facts (source of truth)") || "";
  const knowledge = parseBulletPoints(factsText).map((b) => ({
    topic: b.split(/[:–-]/)[0].trim(),
    detail: b,
  }));

  // Guidelines from "Conversation guidelines"
  const guidelinesText = sections.get("Conversation guidelines") || "";
  const guidelines = parseNumberedPoints(guidelinesText).map((r) => ({
    rule: r,
  }));

  // Parse scoring notes FIRST (needed before scanning for hard rules)
  const scoringNotesMatch = content.match(
    /\*\*Scoring notes:\*\*\s*\n([\s\S]*?)(?=\n\*\*[^*]|\n##|$)/
  );
  const scoringNotes = scoringNotesMatch
    ? scoringNotesMatch[1].trim()
    : "";

  // Hard rules — parse both general and criterion-specific
  const hardRules: {
    rule: string;
    type?: "text" | "criterion";
    criterion?: string;
    operator?: "<=" | ">=" | "==";
    threshold?: number;
  }[] = [];

  // From **Hard rule:** line
  const hardRuleMatch = content.match(
    /\*\*Hard rule:\*\*\s*(.+?)(?:\n|$)/
  );
  if (hardRuleMatch) {
    const ruleText = hardRuleMatch[1].trim();
    const parsed = parseCriterionRule(ruleText);
    if (parsed) {
      hardRules.push(parsed);
    } else {
      hardRules.push({ rule: ruleText, type: "text" });
    }
  }

  // From "Policy the agent must follow" section
  const policyText = sections.get("Policy the agent must follow") || "";
  for (const bullet of parseBulletPoints(policyText)) {
    if (/never|must not|automatic fail/i.test(bullet)) {
      const parsed = parseCriterionRule(bullet);
      if (parsed) {
        hardRules.push(parsed);
      } else {
        hardRules.push({ rule: bullet, type: "text" });
      }
    }
  }

  // Also scan scoring notes for criterion-specific hard rules
  if (scoringNotes) {
    const notesText = scoringNotes;
    for (const line of notesText.split("\n")) {
      const trimmed = line.trim();
      if (/fail|auto.?fail/i.test(trimmed)) {
        const parsed = parseCriterionRule(trimmed);
        if (parsed) {
          const exists = hardRules.some(
            (r) =>
              r.criterion?.toLowerCase() ===
                parsed.criterion?.toLowerCase() &&
              r.operator === parsed.operator &&
              r.threshold === parsed.threshold
          );
          if (!exists) {
            hardRules.push(parsed);
          }
        }
      }
    }
  }

  // Pass threshold
  const passMatch = content.match(
    /\*\*Pass threshold:\*\*\s*[^0-9]*(\d+\.?\d*)/
  );
  const passThreshold = passMatch ? parseFloat(passMatch[1]) : 4.0;

  // Rubric table
  const rubric = parseRubricTable(content);

  return {
    id: agentId,
    name,
    persona,
    goal,
    knowledge,
    guidelines,
    hardRules,
    passThreshold,
    scoringNotes,
    rubric,
  };
}

function extractMarkdownSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (currentSection) {
        sections.set(currentSection, currentContent.join("\n").trim());
      }
      currentSection = headerMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  if (currentSection) {
    sections.set(currentSection, currentContent.join("\n").trim());
  }

  return sections;
}

function parseBulletPoints(text: string): string[] {
  const bullets: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^-\s+(.+)/);
    if (match) {
      bullets.push(match[1].replace(/\*\*/g, "").trim());
    }
  }
  return bullets;
}

function parseNumberedPoints(text: string): string[] {
  const points: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\d+\.\s+(.+)/);
    if (match) {
      points.push(match[1].replace(/\*\*/g, "").trim());
    }
  }
  return points;
}

function parseRubricTable(content: string): {
  criterion: string;
  description: string;
  weight: number;
  max_score: number;
}[] {
  const criteria: {
    criterion: string;
    description: string;
    weight: number;
    max_score: number;
  }[] = [];

  const lines = content.split("\n");
  let inTable = false;
  let skipSeparator = false;

  for (const line of lines) {
    // Detect table header with "Criterion" and "Weight"
    if (line.includes("|") && line.toLowerCase().includes("criterion") && line.toLowerCase().includes("weight")) {
      inTable = true;
      skipSeparator = true;
      continue;
    }

    // Skip separator row (|---|---|)
    if (inTable && skipSeparator && line.match(/^\|[-\s|]+\|/)) {
      skipSeparator = false;
      continue;
    }

    // Parse data rows
    if (inTable && !skipSeparator && line.startsWith("|")) {
      const cols = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cols.length >= 4) {
        const criterion = cols[0].replace(/\*\*/g, "").trim();
        const weightStr = cols[1].replace("%", "").replace(/\*\*/g, "").trim();
        const weight = parseFloat(weightStr) || 1;
        const fiveLooksLike = cols[2].replace(/\*\*/g, "").trim();
        const oneLooksLike = cols[3].replace(/\*\*/g, "").trim();

        // Skip if this is the OVERALL row or empty
        if (criterion.toLowerCase().includes("overall") || !criterion) {
          continue;
        }

        criteria.push({
          criterion,
          description: `5: ${fiveLooksLike} | 1: ${oneLooksLike}`,
          weight,
          max_score: 5,
        });
      }
    }

    // End of table
    if (inTable && !line.startsWith("|") && line.trim().length > 0) {
      inTable = false;
    }
  }

  return criteria;
}

// ============================================
// TRANSCRIPT LOADER (JSON files)
// ============================================
function loadTranscripts(
  agentMap: Map<string, ParsedAgent>
): NormalizedTranscript[] {
  const transcriptsDir = path.join(DATASET_DIR, "transcripts");
  const transcripts: NormalizedTranscript[] = [];

  if (!fs.existsSync(transcriptsDir)) {
    throw new Error("transcripts/ directory not found in dataset/");
  }

  const files = fs
    .readdirSync(transcriptsDir)
    .filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(transcriptsDir, file), "utf-8")
    );

    const callId = raw.call_id || path.basename(file, ".json");
    const agentId = raw.agent_id;
    const agent = agentMap.get(agentId);

    if (!agent) {
      console.warn(
        `⚠️ Agent "${agentId}" not found for transcript ${callId}. Skipping.`
      );
      continue;
    }

    // Convert turns to normalized format
    // Dataset: speaker = "agent" | "user", idx = 0-indexed
    // Normalized: role = "agent" | "customer", turn_no = 1-indexed
    const transcript = (raw.turns || []).map(
      (t: { idx?: number; speaker: string; text: string }, i: number) => ({
        role: (t.speaker === "agent" ? "agent" : "customer") as
          | "agent"
          | "customer",
        text: t.text,
        turn_no: (t.idx ?? i) + 1, // 1-indexed
      })
    );

    transcripts.push({
      id: callId,
      agentName: agent.name,
      agentConfig: {
        persona: agent.persona,
        goal: agent.goal,
        knowledge: agent.knowledge,
        guidelines: agent.guidelines,
        rubric: agent.rubric,
        hard_rules: agent.hardRules,
        pass_threshold: agent.passThreshold,
        scoring_notes: agent.scoringNotes,  // NEW
      },
      transcript,
    });
  }

  return transcripts;
}

// ============================================
// HUMAN LABELS LOADER (CSV)
// ============================================
function loadHumanLabels(): NormalizedHumanLabel[] {
  // Try: dataset/labels/dev-labels.csv
  const labelsPath = path.join(DATASET_DIR, "labels", "dev-labels.csv");
  if (fs.existsSync(labelsPath)) {
    const text = fs.readFileSync(labelsPath, "utf-8");
    return parseLabelsCSV(text);
  }

  // Try: dataset/human_labels.csv
  const altPath = path.join(DATASET_DIR, "human_labels.csv");
  if (fs.existsSync(altPath)) {
    const text = fs.readFileSync(altPath, "utf-8");
    return parseLabelsCSV(text);
  }

  throw new Error(
    "Labels file not found. Expected at dataset/labels/dev-labels.csv"
  );
}

function parseLabelsCSV(text: string): NormalizedHumanLabel[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]);
  const labelMap = new Map<string, NormalizedHumanLabel>();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = parseCSVRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cols[j] || "";
    });

    const callId = row.call_id;
    if (!callId) continue;

    if (!labelMap.has(callId)) {
      labelMap.set(callId, {
        conversationId: callId,
        scores: [],
        passFail: "PASS",
        evaluatorName: "Human Expert",
      });
    }

    const label = labelMap.get(callId)!;
    const criterion = row.criterion || "";

    // Check for OVERALL row
    if (criterion.toLowerCase().includes("overall")) {
      const score = (row.score || "").toLowerCase().trim();
      label.passFail = score === "fail" ? "FAIL" : "PASS";
      if (row.notes) {
        label.notes = row.notes;
      }
      continue;
    }

    // Regular criterion row
    if (criterion) {
      const scoreStr = (row.score || "").trim();
      const isNA =
        scoreStr.toLowerCase() === "na" ||
        scoreStr.toLowerCase() === "n/a" ||
        scoreStr === "" ||
        isNotAssessable(scoreStr);

      label.scores.push({
        criterion: criterion.trim(),
        score: isNA ? null : parseFloat(scoreStr),
        max_score: 5,
      });
    }
  }

  return Array.from(labelMap.values());
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map((s) => s.trim());
}