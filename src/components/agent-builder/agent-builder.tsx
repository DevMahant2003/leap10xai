"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Save,
  Bot,
  BookOpen,
  ListChecks,
  Scale,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

// ---------- Types ----------
type KnowledgeEntry = { id: string; topic: string; detail: string };
type Guideline = { id: string; rule: string };
type RubricCriterion = {
  id: string;
  criterion: string;
  description: string;
  weight: number;
  max_score: number;
};
type HardRule = {
  id: string;
  rule: string;
  severity: "fail";
  type?: "text" | "criterion";
  criterion?: string;
  operator?: "<=" | ">=" | "==";
  threshold?: number;
};

// ---------- Helpers ----------
const uid = () => Math.random().toString(36).slice(2, 9);

const STEPS = [
  { label: "Basics", icon: Bot },
  { label: "Knowledge", icon: BookOpen },
  { label: "Guidelines", icon: ListChecks },
  { label: "Rubric", icon: Scale },
  { label: "Hard Rules", icon: AlertTriangle },
  { label: "Settings", icon: Settings },
  { label: "Review", icon: CheckCircle2 },
];

// ---------- Initial State ----------
const initialState = {
  name: "",
  description: "",
  persona: "",
  goal: "",
  knowledge: [{ id: uid(), topic: "", detail: "" }] as KnowledgeEntry[],
  guidelines: [{ id: uid(), rule: "" }] as Guideline[],
  rubric: [
    { id: uid(), criterion: "", description: "", weight: 1, max_score: 5 },
  ] as RubricCriterion[],
  hard_rules: [
    { id: uid(), rule: "", severity: "fail" as const },
  ] as HardRule[],
  pass_threshold: 4.0,
};

// ---------- Component ----------
export function AgentBuilder({ agent }: { agent?: Agent } = {}) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    if (agent) {
      return {
        name: agent.name,
        description: agent.description || "",
        persona: agent.persona,
        goal: agent.goal,
        knowledge:
          (agent.knowledge as KnowledgeEntry[]).length > 0
            ? (agent.knowledge as KnowledgeEntry[]).map((k) => ({ ...k }))
            : [{ id: uid(), topic: "", detail: "" }],
        guidelines:
          (agent.guidelines as Guideline[]).length > 0
            ? (agent.guidelines as Guideline[]).map((g) => ({ ...g }))
            : [{ id: uid(), rule: "" }],
        rubric:
          (agent.rubric as RubricCriterion[]).length > 0
            ? (agent.rubric as RubricCriterion[]).map((r) => ({ ...r }))
            : [
                {
                  id: uid(),
                  criterion: "",
                  description: "",
                  weight: 1,
                  max_score: 5,
                },
              ],
        hard_rules:
          (agent.hard_rules as HardRule[]).length > 0
            ? (agent.hard_rules as HardRule[]).map((r) => ({ ...r }))
            : [{ id: uid(), rule: "", severity: "fail" as const }],
        pass_threshold: agent.pass_threshold,
      };
    }
    return initialState;
  });

  const update = (key: keyof typeof form, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSave = async () => {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    if (!form.name.trim()) {
      toast.error("Name is required");
      setStep(0);
      setSaving(false);
      return;
    }
    if (!form.persona.trim()) {
      toast.error("Persona is required");
      setStep(0);
      setSaving(false);
      return;
    }
    if (!form.goal.trim()) {
      toast.error("Goal is required");
      setStep(0);
      setSaving(false);
      return;
    }

    const knowledge = form.knowledge.filter(
      (k) => k.topic.trim() && k.detail.trim()
    );
    const guidelines = form.guidelines.filter((g) => g.rule.trim());
    const rubric = form.rubric.filter(
      (r) => r.criterion.trim() && r.description.trim()
    );
    const hard_rules = form.hard_rules.filter((r) => r.rule.trim());

    if (rubric.length === 0) {
      toast.error("At least one rubric criterion is required");
      setStep(3);
      setSaving(false);
      return;
    }

    if (agent) {
      const { error } = await supabase
        .from("agents")
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          persona: form.persona.trim(),
          goal: form.goal.trim(),
          knowledge,
          guidelines,
          rubric,
          hard_rules,
          pass_threshold: form.pass_threshold,
        })
        .eq("id", agent.id)
        .eq("user_id", user.id);

      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }

      toast.success("Agent updated!");
      router.push(`/agents/${agent.id}`);
      router.refresh();
    } else {
      const { data, error } = await supabase
        .from("agents")
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          persona: form.persona.trim(),
          goal: form.goal.trim(),
          knowledge,
          guidelines,
          rubric,
          hard_rules,
          pass_threshold: form.pass_threshold,
        })
        .select("id")
        .single();

      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }

      toast.success("Agent created!");
      router.push(`/agents/${data.id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {agent ? "Edit AI Agent" : "Create AI Agent"}
        </h1>
        <p className="text-muted-foreground">
          Build an AI employee with persona, knowledge, rubric, and hard rules.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center">
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
                  step === i
                    ? "bg-primary text-primary-foreground"
                    : i < step
                    ? "bg-muted text-muted-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="w-4 h-px bg-border mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === 0 && <BasicsStep form={form} update={update} />}
      {step === 1 && <KnowledgeStep form={form} update={update} />}
      {step === 2 && <GuidelinesStep form={form} update={update} />}
      {step === 3 && <RubricStep form={form} update={update} />}
      {step === 4 && <HardRulesStep form={form} update={update} />}
      {step === 5 && <SettingsStep form={form} update={update} />}
      {step === 6 && <ReviewStep form={form} />}

      {/* Footer Nav */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="ghost" onClick={back} disabled={step === 0}>
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving..." : agent ? "Update Agent" : "Save Agent"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP 0: BASICS
// ============================================
function BasicsStep({
  form,
  update,
}: {
  form: typeof initialState;
  update: (key: keyof typeof form, value: unknown) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Basics</CardTitle>
        <CardDescription>
          Name, persona, and goal of your AI employee.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="Nimbus Broadband Support"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="Customer support agent for broadband issues"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="persona">Persona *</Label>
          <Textarea
            id="persona"
            rows={3}
            placeholder="Helpful customer-support executive. Polite, concise, empathetic. Uses simple language."
            value={form.persona}
            onChange={(e) => update("persona", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Describe how the agent should sound and behave.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal">Goal *</Label>
          <Textarea
            id="goal"
            rows={3}
            placeholder="Solve broadband problems efficiently — diagnose, resolve, or escalate."
            value={form.goal}
            onChange={(e) => update("goal", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// STEP 1: KNOWLEDGE
// ============================================
function KnowledgeStep({
  form,
  update,
}: {
  form: typeof initialState;
  update: (key: keyof typeof form, value: unknown) => void;
}) {
  const add = () =>
    update("knowledge", [
      ...form.knowledge,
      { id: uid(), topic: "", detail: "" },
    ]);
  const remove = (id: string) =>
    update(
      "knowledge",
      form.knowledge.filter((k) => k.id !== id)
    );
  const change = (id: string, field: "topic" | "detail", value: string) =>
    update(
      "knowledge",
      form.knowledge.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge Base</CardTitle>
        <CardDescription>
          Facts the agent should know to handle conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {form.knowledge.map((k, i) => (
          <div key={k.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Knowledge {i + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(k.id)}
                disabled={form.knowledge.length === 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Topic (e.g. LOS light)"
                value={k.topic}
                onChange={(e) => change(k.id, "topic", e.target.value)}
              />
              <Input
                className="md:col-span-2"
                placeholder="Detail (e.g. Red LOS light = fibre fault)"
                value={k.detail}
                onChange={(e) => change(k.id, "detail", e.target.value)}
              />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={add} className="w-full">
          <Plus className="size-4" />
          Add Knowledge
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// STEP 2: GUIDELINES
// ============================================
function GuidelinesStep({
  form,
  update,
}: {
  form: typeof initialState;
  update: (key: keyof typeof form, value: unknown) => void;
}) {
  const add = () =>
    update("guidelines", [...form.guidelines, { id: uid(), rule: "" }]);
  const remove = (id: string) =>
    update(
      "guidelines",
      form.guidelines.filter((g) => g.id !== id)
    );
  const change = (id: string, value: string) =>
    update(
      "guidelines",
      form.guidelines.map((g) => (g.id === id ? { ...g, rule: value } : g))
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guidelines</CardTitle>
        <CardDescription>
          Behavioral rules the agent should follow (soft rules — used for
          scoring, not for fail override).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {form.guidelines.map((g, i) => (
          <div key={g.id} className="flex gap-2">
            <Input
              placeholder={`Rule ${i + 1} (e.g. Always greet customer by name)`}
              value={g.rule}
              onChange={(e) => change(g.id, e.target.value)}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => remove(g.id)}
              disabled={form.guidelines.length === 1}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={add} className="w-full">
          <Plus className="size-4" />
          Add Guideline
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// STEP 3: RUBRIC (with AI Suggest)
// ============================================
function RubricStep({
  form,
  update,
}: {
  form: typeof initialState;
  update: (key: keyof typeof form, value: unknown) => void;
}) {
  const [suggesting, setSuggesting] = useState(false);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/suggest-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: form.persona,
          goal: form.goal,
          knowledge: form.knowledge
            .map((k) => `${k.topic}: ${k.detail}`)
            .join("\n"),
          guidelines: form.guidelines.map((g) => g.rule).join("\n"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate rubric");
      }

      const data = await res.json();

      if (data.criteria && Array.isArray(data.criteria)) {
        const newRubric = data.criteria.map(
          (c: {
            criterion: string;
            description: string;
            weight: number;
            max_score: number;
          }) => ({
            id: uid(),
            criterion: c.criterion,
            description: c.description,
            weight: c.weight || 1,
            max_score: c.max_score || 5,
          })
        );
        update("rubric", newRubric);
        toast.success(`Generated ${newRubric.length} criteria!`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate rubric"
      );
    } finally {
      setSuggesting(false);
    }
  };

  const add = () =>
    update("rubric", [
      ...form.rubric,
      { id: uid(), criterion: "", description: "", weight: 1, max_score: 5 },
    ]);
  const remove = (id: string) =>
    update(
      "rubric",
      form.rubric.filter((r) => r.id !== id)
    );
  const change = (
    id: string,
    field: keyof RubricCriterion,
    value: unknown
  ) =>
    update(
      "rubric",
      form.rubric.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Evaluation Rubric</CardTitle>
            <CardDescription>
              Criteria the evaluator will score the agent on (1–5 scale).
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={suggesting || !form.persona}
          >
            {suggesting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Suggest Rubric
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {form.rubric.map((r, i) => (
          <div key={r.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Criterion {i + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(r.id)}
                disabled={form.rubric.length === 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Input
              placeholder="Criterion name (e.g. Diagnosis)"
              value={r.criterion}
              onChange={(e) => change(r.id, "criterion", e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="What to evaluate (e.g. Did the agent correctly identify the customer's issue?)"
              value={r.description}
              onChange={(e) => change(r.id, "description", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Weight</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.5}
                  value={r.weight}
                  onChange={(e) =>
                    change(r.id, "weight", parseFloat(e.target.value) || 1)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Score</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={r.max_score}
                  onChange={(e) =>
                    change(r.id, "max_score", parseInt(e.target.value) || 5)
                  }
                />
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={add} className="w-full">
          <Plus className="size-4" />
          Add Criterion
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// STEP 4: HARD RULES (with criterion-specific support)
// ============================================
function HardRulesStep({
  form,
  update,
}: {
  form: typeof initialState;
  update: (key: keyof typeof form, value: unknown) => void;
}) {
  const addText = () =>
    update("hard_rules", [
      ...form.hard_rules,
      { id: uid(), rule: "", severity: "fail" as const, type: "text" as const },
    ]);

  const addCriterion = () => {
    const criteria = form.rubric.filter((r) => r.criterion.trim());
    const firstCriterion = criteria[0]?.criterion || "";
    update("hard_rules", [
      ...form.hard_rules,
      {
        id: uid(),
        rule: `If ${firstCriterion} ≤ 2, auto-fail`,
        severity: "fail" as const,
        type: "criterion" as const,
        criterion: firstCriterion,
        operator: "<=" as const,
        threshold: 2,
      },
    ]);
  };

  const remove = (id: string) =>
    update(
      "hard_rules",
      form.hard_rules.filter((r) => r.id !== id)
    );

  const change = (id: string, field: string, value: unknown) => {
    update(
      "hard_rules",
      form.hard_rules.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Auto-generate rule text for criterion-specific rules
        if (
          updated.type === "criterion" &&
          updated.criterion &&
          updated.operator &&
          updated.threshold !== undefined
        ) {
          const opText =
            updated.operator === "=="
              ? "is"
              : updated.operator === "<="
              ? "≤"
              : "≥";
          updated.rule = `If ${updated.criterion} ${opText} ${updated.threshold}, auto-fail`;
        }
        return updated;
      })
    );
  };

  const criteriaOptions = form.rubric
    .filter((r) => r.criterion.trim())
    .map((r) => r.criterion);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          Hard Rules (Auto-Fail)
        </CardTitle>
        <CardDescription>
          If the agent violates any of these, the call auto-fails regardless of
          average score. Two types: general rules (text) and criterion-specific
          rules (if a criterion scores below a threshold).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {form.hard_rules.map((r, i) => {
          if (r.type === "criterion") {
            return (
              <div
                key={r.id}
                className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Criterion Rule {i + 1}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(r.id)}
                    disabled={form.hard_rules.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <Select
                    value={r.criterion || ""}
                    onValueChange={(v) =>
                      change(r.id, "criterion", v ?? "")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select criterion" />
                    </SelectTrigger>
                    <SelectContent>
                      {criteriaOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={r.operator || "<="}
                    onValueChange={(v) =>
                      change(r.id, "operator", v ?? "<=")
                    }
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="≤">≤</SelectItem>
                      <SelectItem value="≥">≥</SelectItem>
                      <SelectItem value="=">=</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={r.threshold ?? 2}
                    onChange={(e) =>
                      change(r.id, "threshold", parseInt(e.target.value) || 2)
                    }
                    className="w-16"
                  />
                </div>
                <div className="rounded border-l-4 border-amber-400 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-amber-800">
                    {r.rule}
                  </p>
                </div>
                {criteriaOptions.length === 0 && (
                  <p className="text-xs text-red-500">
                    No rubric criteria found. Add criteria in the Rubric step
                    first.
                  </p>
                )}
              </div>
            );
          }

          // Text rule (existing UI)
          return (
            <div key={r.id} className="flex gap-2">
              <Input
                placeholder={`Rule ${i + 1} (e.g. Must not promise refunds)`}
                value={r.rule}
                onChange={(e) => change(r.id, "rule", e.target.value)}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(r.id)}
                disabled={form.hard_rules.length === 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}

        <div className="flex gap-2">
          <Button variant="outline" onClick={addText} className="flex-1">
            <Plus className="size-4" />
            Add General Rule
          </Button>
          <Button
            variant="outline"
            onClick={addCriterion}
            className="flex-1"
            disabled={criteriaOptions.length === 0}
          >
            <Plus className="size-4" />
            Add Criterion Rule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// STEP 5: SETTINGS
// ============================================
function SettingsStep({
  form,
  update,
}: {
  form: typeof initialState;
  update: (key: keyof typeof form, value: unknown) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pass/Fail Settings</CardTitle>
        <CardDescription>
          The minimum average score required for a PASS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="threshold">Pass Threshold</Label>
          <Input
            id="threshold"
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={form.pass_threshold}
            onChange={(e) =>
              update("pass_threshold", parseFloat(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            Example: If set to 4.0, an agent scoring 4.2 passes, 3.8 fails.
            Hard rule violations always override this to FAIL.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// STEP 6: REVIEW
// ============================================
function ReviewStep({ form }: { form: typeof initialState }) {
  const knowledge = form.knowledge.filter(
    (k) => k.topic.trim() && k.detail.trim()
  );
  const guidelines = form.guidelines.filter((g) => g.rule.trim());
  const rubric = form.rubric.filter(
    (r) => r.criterion.trim() && r.description.trim()
  );
  const hardRules = form.hard_rules.filter((r) => r.rule.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Save</CardTitle>
        <CardDescription>
          Verify everything looks correct before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section title="Name" value={form.name || "—"} />
        <Section title="Description" value={form.description || "—"} />
        <Separator />
        <Section title="Persona" value={form.persona || "—"} multiline />
        <Section title="Goal" value={form.goal || "—"} multiline />
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2">
            Knowledge ({knowledge.length})
          </h4>
          {knowledge.length > 0 ? (
            <ul className="space-y-1">
              {knowledge.map((k) => (
                <li key={k.id} className="text-sm text-muted-foreground">
                  • <strong className="text-foreground">{k.topic}:</strong>{" "}
                  {k.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No knowledge entries
            </p>
          )}
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2">
            Guidelines ({guidelines.length})
          </h4>
          {guidelines.length > 0 ? (
            <ul className="space-y-1">
              {guidelines.map((g) => (
                <li key={g.id} className="text-sm text-muted-foreground">
                  • {g.rule}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No guidelines</p>
          )}
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2">
            Rubric ({rubric.length})
          </h4>
          <div className="space-y-2">
            {rubric.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-2 rounded border p-2"
              >
                <div>
                  <div className="text-sm font-medium">{r.criterion}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.description}
                  </div>
                </div>
                <Badge variant="secondary">
                  Weight {r.weight} · /{r.max_score}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <AlertTriangle className="size-4 text-amber-500" />
            Hard Rules ({hardRules.length})
          </h4>
          {hardRules.length > 0 ? (
            <ul className="space-y-1">
              {hardRules.map((r) => (
                <li key={r.id} className="text-sm text-muted-foreground">
                  • {r.rule}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hard rules</p>
          )}
        </div>
        <Separator />
        <Section title="Pass Threshold" value={`${form.pass_threshold} / 5`} />
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  value,
  multiline = false,
}: {
  title: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <p
        className={`text-sm text-muted-foreground ${
          multiline ? "whitespace-pre-wrap" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}